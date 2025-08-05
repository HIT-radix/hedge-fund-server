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
import { Snapshot } from "@/database/entities/snapshot.entity";
import { SnapshotAccount } from "@/database/entities/snapshot-account.entity";
import { NFTHoldersList, EventEmitter } from "@/interfaces/types.interface";
import { SnapshotState } from "@/interfaces/enum";
import { RADIX_CONFIG } from "@/config/radix.config";
import {
  DAPP_DEFINITION_ADDRESS,
  NODE_STAKING_COMPONENT_ADDRESS,
  NODE_STAKING_USER_BADGE_ADDRESS,
  HIT_FOMO_NODE_LSU_ADDRESS,
} from "@/constants/address";
import { checkResourceInUsersFungibleAssets } from "@/utils/helpers";

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);
  private readonly gatewayApi: GatewayApiClient;

  constructor(
    @InjectRepository(NftHolder)
    private nftHolderRepository: Repository<NftHolder>,
    @InjectRepository(LedgerState)
    private ledgerStateRepository: Repository<LedgerState>,
    @InjectRepository(Snapshot)
    private snapshotRepository: Repository<Snapshot>,
    @InjectRepository(SnapshotAccount)
    private snapshotAccountRepository: Repository<SnapshotAccount>,
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
      throw error;
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

  /**
   * Get LSU amounts for NFT holders at a specific date
   * @param date The date to get the snapshot for
   * @returns Object containing usersWithResourceAmount and totalAmount
   */
  async getLSUAmountsAtDate(date: Date): Promise<{
    usersWithResourceAmount: Record<string, string>;
    totalAmount: string;
  } | null> {
    try {
      this.logger.log(`Getting LSU amounts for date: ${date.toISOString()}`);

      // First, update NFT holders to get the latest data
      const updatedHolders = await this.updateNftHolders();

      if (!updatedHolders) {
        this.logger.warn("Failed to update NFT holders");
        return null;
      }

      // Get the list of NFT holder addresses
      const nftHolderAddresses = Object.keys(updatedHolders.nft_holders);

      if (nftHolderAddresses.length === 0) {
        this.logger.warn("No NFT holders found");
        return {
          usersWithResourceAmount: {},
          totalAmount: "0",
        };
      }

      this.logger.log(`Found ${nftHolderAddresses.length} NFT holders`);

      // Get LSU amounts for all NFT holder addresses at the latest state
      const result = await checkResourceInUsersFungibleAssets(
        nftHolderAddresses,
        HIT_FOMO_NODE_LSU_ADDRESS,
        this.gatewayApi,
        {
          timestamp: date,
        }
      );

      this.logger.log(
        `Found LSU amounts for ${
          Object.keys(result.usersWithResourceAmount).length
        } addresses, ` + `total amount: ${result.totalAmount}`
      );

      return result;
    } catch (error) {
      this.logger.error("Error getting LSU amounts at date:", error);
      throw error;
    }
  }

  /**
   * Save a snapshot and its associated account data to the database
   * @param date The date of the snapshot
   * @param state The state of the snapshot (default: UNLOCK_STARTED)
   * @param claimNftId Optional claim NFT ID
   * @param accountsData Object containing LSU amounts for each account
   * @returns Promise<Snapshot | null> The saved snapshot or null if failed
   */
  async saveSnapshot(
    date: Date,
    accountsData: Record<string, string>,
    state: SnapshotState = SnapshotState.UNLOCK_STARTED,
    claimNftId?: string | null
  ): Promise<Snapshot | null> {
    try {
      this.logger.log(`Saving snapshot for date: ${date.toISOString()}`);

      return await this.dataSource.transaction(async (manager) => {
        const snapshotRepo = manager.getRepository(Snapshot);
        const snapshotAccountRepo = manager.getRepository(SnapshotAccount);

        // Check if snapshot already exists for this date
        const existingSnapshot = await snapshotRepo.findOne({
          where: { date },
        });

        let snapshot: Snapshot;

        if (existingSnapshot) {
          // Update existing snapshot
          existingSnapshot.state = state;
          if (claimNftId !== undefined) {
            existingSnapshot.claim_nft_id = claimNftId;
          }
          snapshot = await snapshotRepo.save(existingSnapshot);
          this.logger.log(
            `Updated existing snapshot for date: ${date.toISOString()}`
          );

          // Remove existing snapshot accounts for this date
          await snapshotAccountRepo.delete({ date });
          this.logger.log(
            `Removed existing snapshot accounts for date: ${date.toISOString()}`
          );
        } else {
          // Create new snapshot
          snapshot = snapshotRepo.create({
            date,
            state,
            claim_nft_id: claimNftId || null,
          });
          snapshot = await snapshotRepo.save(snapshot);
          this.logger.log(
            `Created new snapshot for date: ${date.toISOString()}`
          );
        }

        // Create snapshot account entries
        const snapshotAccounts: SnapshotAccount[] = [];

        for (const [accountAddress, lsuAmount] of Object.entries(
          accountsData
        )) {
          this.logger.log(
            `Creating snapshot account for address: ${accountAddress}, LSU amount: ${lsuAmount}`
          );
          const snapshotAccount = snapshotAccountRepo.create({
            date,
            account: accountAddress,
            lsu_amount: lsuAmount,
            fund_units_sent: false, // Default to false
            snapshot,
          });
          snapshotAccounts.push(snapshotAccount);
        }

        // Batch save all snapshot accounts
        if (snapshotAccounts.length > 0) {
          await snapshotAccountRepo.insert(snapshotAccounts);
          this.logger.log(
            `Saved ${
              snapshotAccounts.length
            } snapshot accounts for date: ${date.toISOString()}`
          );
        }

        this.logger.log(
          `Successfully saved snapshot with ${snapshotAccounts.length} accounts`
        );
        return snapshot;
      });
    } catch (error) {
      this.logger.error("Error saving snapshot:", error);
      throw error;
    }
  }

  /**
   * Create and save a snapshot using LSU amounts from a specific date
   * @param date The date to create the snapshot for
   * @param state The state of the snapshot (default: UNLOCK_STARTED)
   * @param claimNftId Optional claim NFT ID
   * @returns Promise<Snapshot | null> The created snapshot or null if failed
   */
  async createSnapshotAtDate(
    date: Date,
    state: SnapshotState = SnapshotState.UNLOCK_STARTED,
    claimNftId?: string | null
  ): Promise<Snapshot | null> {
    try {
      this.logger.log(`Creating snapshot at date: ${date.toISOString()}`);

      // Get LSU amounts for the specified date
      const lsuData = await this.getLSUAmountsAtDate(date);

      if (!lsuData) {
        this.logger.warn(`No LSU data found for date: ${date.toISOString()}`);
        return null;
      }

      // Save the snapshot with the LSU data
      const snapshot = await this.saveSnapshot(
        date,
        lsuData.usersWithResourceAmount,
        state,
        claimNftId
      );

      if (snapshot) {
        this.logger.log(
          `Successfully created snapshot at ${date.toISOString()} with total LSU amount: ${
            lsuData.totalAmount
          }`
        );
      }

      return snapshot;
    } catch (error) {
      this.logger.error("Error creating snapshot at date:", error);
      throw error;
    }
  }
}
