import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  CommittedTransactionInfo,
  GatewayApiClient,
  StreamTransactionsResponse,
} from "@radixdlt/babylon-gateway-api-sdk";
import { NftHolder } from "@/database/entities/nft-holder.entity";
import { LedgerState } from "@/database/entities/ledger-state.entity";
import { NFTHoldersList, EventEmitter } from "@/interfaces/types.interface";
import { RADIX_CONFIG } from "@/config/radix.config";
import {
  DAPP_DEFINITION_ADDRESS,
  NODE_STAKING_COMPONENT_ADDRESS,
  NODE_STAKING_USER_BADGE_ADDRESS,
} from "@/constants/address";

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);
  private readonly gatewayApi: GatewayApiClient;

  constructor(
    @InjectRepository(NftHolder)
    private nftHolderRepository: Repository<NftHolder>,
    @InjectRepository(LedgerState)
    private ledgerStateRepository: Repository<LedgerState>,
    private dataSource: DataSource
  ) {
    this.gatewayApi = GatewayApiClient.initialize({
      networkId: RADIX_CONFIG.NETWORK_ID,
      applicationName: RADIX_CONFIG.APPLICATION_NAME,
      applicationVersion: RADIX_CONFIG.APPLICATION_VERSION,
      applicationDappDefinitionAddress: DAPP_DEFINITION_ADDRESS,
    });
  }

  /**
   * Get the last stored ledger state from the database
   */
  async getLastLedgerState(): Promise<LedgerState | null> {
    try {
      const lastState = await this.ledgerStateRepository.findOne({
        where: {},
        order: { state_version: "DESC" },
      });
      return lastState;
    } catch (error) {
      this.logger.error("Error fetching last ledger state:", error);
      return null;
    }
  }

  /**
   * Update or create ledger state entry
   */
  private async upsertLedgerState(
    manager: any,
    newLedgerState: any
  ): Promise<void> {
    const ledgerStateRepo = manager.getRepository(LedgerState);

    // Check if any ledger state exists
    const existingState = await ledgerStateRepo.findOne({
      where: {},
      order: { state_version: "DESC" },
    });

    if (existingState) {
      // Update the existing entry
      await ledgerStateRepo.update(existingState.id, {
        epoch: newLedgerState.epoch,
        network: newLedgerState.network,
        proposer_round_timestamp: newLedgerState.proposer_round_timestamp,
        round: newLedgerState.round,
        state_version: newLedgerState.state_version,
      });
      this.logger.log(
        `Updated ledger state with version: ${newLedgerState.state_version}`
      );
    } else {
      // Create new entry
      const ledgerState = ledgerStateRepo.create({
        epoch: newLedgerState.epoch,
        network: newLedgerState.network,
        proposer_round_timestamp: newLedgerState.proposer_round_timestamp,
        round: newLedgerState.round,
        state_version: newLedgerState.state_version,
      });
      await ledgerStateRepo.save(ledgerState);
      this.logger.log(
        `Created new ledger state with version: ${newLedgerState.state_version}`
      );
    }
  }

  /**
   * Fetch NFT data from the Radix Gateway API
   */
  private async fetchNFTsInfo(
    fromStateVersion?: number
  ): Promise<NFTHoldersList | null> {
    try {
      this.logger.log(
        `Fetching NFTs from state version: ${fromStateVersion || "genesis"}`
      );

      let response: StreamTransactionsResponse;
      let allItems: CommittedTransactionInfo[] = [];
      let nextCursor = undefined;

      do {
        response = await this.gatewayApi.stream.innerClient.streamTransactions({
          streamTransactionsRequest: {
            affected_global_entities_filter: [
              NODE_STAKING_COMPONENT_ADDRESS,
              NODE_STAKING_USER_BADGE_ADDRESS,
            ],
            opt_ins: { receipt_events: true },
            cursor: nextCursor,
            order: "Asc",
            from_ledger_state: fromStateVersion
              ? {
                  state_version: fromStateVersion,
                }
              : undefined,
          },
        });

        allItems = allItems.concat(response.items);
        nextCursor = response.next_cursor;
      } while (nextCursor);

      const nodeStakingNftHolders: Record<string, string> = {};
      const ledgerStateVersion = response.ledger_state;

      allItems.forEach((transaction) => {
        let userAddress = "";
        let userNFTid: string | undefined;

        transaction.receipt?.events?.forEach((txEvent) => {
          if (
            txEvent.name === "NewUserNftEvent" &&
            txEvent.data.kind === "Tuple" &&
            txEvent.data.fields[0].kind === "U64"
          ) {
            userNFTid = `#${txEvent.data.fields[0].value}#`;
          } else if (txEvent.name === "DepositEvent") {
            const address = (txEvent.emitter as EventEmitter)?.entity
              ?.entity_address;
            if (address?.startsWith("account")) {
              userAddress = address;
            }
          }
        });

        if (userNFTid && userAddress && !nodeStakingNftHolders[userAddress]) {
          nodeStakingNftHolders[userAddress] = userNFTid;
        }
      });

      this.logger.log(
        `Fetched ${Object.keys(nodeStakingNftHolders).length} NFT holders`
      );

      return {
        ledger_state: ledgerStateVersion,
        nft_holders: nodeStakingNftHolders,
      };
    } catch (error) {
      this.logger.error("Error in fetchNFTsInfo:", error);
      return null;
    }
  }

  /**
   * Update NFT holders by fetching new data and storing in database
   */
  async updateNftHolders(): Promise<NFTHoldersList | null> {
    try {
      // Get the last stored ledger state
      const lastLedgerState = await this.getLastLedgerState();
      const fromStateVersion = lastLedgerState?.state_version
        ? Number(lastLedgerState.state_version)
        : undefined;

      this.logger.log(
        `Starting NFT update from state version: ${
          fromStateVersion || "genesis"
        }`
      );

      // Fetch new NFT data
      const newHolders = await this.fetchNFTsInfo(fromStateVersion);

      // Fetch all existing holders before transaction
      const allHolders = await this.nftHolderRepository.find();
      const allHoldersMap: Record<string, string> = {};

      // Create map from existing holders for quick lookup
      allHolders.forEach((holder) => {
        allHoldersMap[holder.wallet_address] = holder.nft_id;
      });

      if (!newHolders) {
        this.logger.warn("No new NFT data fetched");
        return null;
      }

      // Use transaction to ensure data consistency
      await this.dataSource.transaction(async (manager) => {
        // Update or create ledger state entry
        await this.upsertLedgerState(manager, newHolders.ledger_state);

        // Save or update NFT holders
        if (Object.keys(newHolders.nft_holders).length > 0) {
          const nftHolderRepo = manager.getRepository(NftHolder);

          const holdersToAdd: NftHolder[] = [];

          // Process new holders
          for (const [walletAddress, nftId] of Object.entries(
            newHolders.nft_holders
          )) {
            const existingHolder = allHoldersMap[walletAddress];

            if (!existingHolder) {
              // Create new holder only if it doesn't exist
              const newHolder = nftHolderRepo.create({
                wallet_address: walletAddress,
                nft_id: nftId,
              });
              holdersToAdd.push(newHolder);

              // Update the allHoldersMap with the new holder
              allHoldersMap[walletAddress] = nftId;

              this.logger.log(
                `Created NFT holder: ${walletAddress} -> ${nftId}`
              );
            }
            // Skip existing holders as NFT ID never changes
          }

          // Batch save new holders
          if (holdersToAdd.length > 0) {
            await nftHolderRepo.save(holdersToAdd);
          }
        }
      });

      this.logger.log("NFT holders update completed successfully");

      // Return all holders with the updated ledger state
      return {
        ledger_state: newHolders.ledger_state,
        nft_holders: allHoldersMap,
      };
    } catch (error) {
      this.logger.error("Error updating NFT holders:", error);
      throw error;
    }
  }
}
