import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, LessThan, IsNull, In } from "typeorm";
import { GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";
import { NftHolder } from "@/database/entities/nft-holder.entity";
import { LedgerState } from "@/database/entities/ledger-state.entity";
import { Snapshot } from "@/database/entities/snapshot.entity";
import { SnapshotAccount } from "@/database/entities/snapshot-account.entity";
import { SnapshotState } from "@/interfaces/enum";
import { RADIX_CONFIG } from "@/config/radix.config";
import {
  DAPP_DEFINITION_ADDRESS,
  HIT_FOMO_NODE_LSU_ADDRESS,
} from "@/constants/address";
import Decimal from "decimal.js";

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
   * Get all holders of the Node LSU token
   * @returns Promise<Record<string, { address: string; amount: string }>> Object of holders with their LSU amounts
   */
  async getNodeLSUholder() {
    try {
      this.logger.log(
        `Fetching all holders of Node LSU token: ${HIT_FOMO_NODE_LSU_ADDRESS}`
      );

      const holders: Record<string, string> = {};
      let nextCursor: string | undefined = undefined;
      let totalProcessed = 0;
      let totalAmount = "0";

      do {
        const response =
          await this.gatewayApi.extensions.innerClient.resourceHoldersPage({
            resourceHoldersRequest: {
              resource_address: HIT_FOMO_NODE_LSU_ADDRESS,
              limit_per_page: 1000,
              cursor: nextCursor,
            },
          });

        // Process items from the current page
        for (const item of response.items) {
          if (
            item.type === "FungibleResource" &&
            item.holder_address.startsWith("account")
          ) {
            holders[item.holder_address] = item.amount;
            totalAmount = new Decimal(totalAmount).add(item.amount).toString();
          }
        }

        // Update for next iteration
        totalProcessed += response.items.length;
        nextCursor = response.next_cursor;

        this.logger.log(
          `Processed ${totalProcessed}/${response.total_count} Node LSU holders`
        );
      } while (nextCursor);

      this.logger.log(
        `Found ${Object.keys(holders).length} Node LSU holders in total`
      );
      return {
        usersWithResourceAmount: holders,
        totalAmount,
      };
    } catch (error) {
      this.logger.error("Error fetching Node LSU holders:", error);
      throw error;
    }
  }

  /**
   * Save a snapshot and its associated account data to the database
   * @param date The date of the snapshot
   * @param accountsData Object containing LSU amounts for each account
   * @param state The state of the snapshot (default: UNLOCK_STARTED)
   * @param claimNftId Optional claim NFT ID
   * @param updateAccounts Whether to update/create associated accounts (default: true)
   * @returns Promise<Snapshot | null> The saved snapshot or null if failed
   */
  async saveSnapshot(
    date: Date,
    accountsData: Record<string, string>,
    state: SnapshotState = SnapshotState.UNLOCK_STARTED,
    claimNftId?: string | null,
    updateAccounts: boolean = true
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
          existingSnapshot.date = date;
          if (claimNftId !== undefined) {
            existingSnapshot.claim_nft_id = claimNftId;
          }
          snapshot = await snapshotRepo.save(existingSnapshot);
          this.logger.log(
            `Updated existing snapshot for date: ${date.toISOString()}`
          );

          // Remove existing snapshot accounts for this date only if updateAccounts is true
          if (updateAccounts) {
            await snapshotAccountRepo.delete({ date });
            this.logger.log(
              `Removed existing snapshot accounts for date: ${date.toISOString()}`
            );
          }
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

        // Create snapshot account entries only if updateAccounts is true
        if (updateAccounts) {
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
        } else {
          this.logger.log(
            `Successfully saved snapshot without updating accounts`
          );
        }
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
  async createSnapshot(
    date: Date,
    state: SnapshotState = SnapshotState.UNLOCK_STARTED,
    claimNftId?: string | null
  ) {
    try {
      this.logger.log(`Creating snapshot at date: ${date.toISOString()}`);

      // Get LSU amounts for the specified date
      const lsuData = await this.getNodeLSUholder();

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

  /**
   * Fetch snapshots that are older than 29 days from the current time
   * @returns Promise<Snapshot[]> Array of snapshots older than 29 days
   */
  async getSnapshotsFromDb(options?: {
    exactDate?: Date; // fetch snapshots exactly at this date (overrides other filters)
    beforeDate?: Date; // explicit cutoff date (exclusive)
    daysAgo?: number; // number of days to subtract from "now" to form cutoff (exclusive)
    claimNftId?: string | null; // optional filter on claim_nft_id (null means snapshots where claim_nft_id IS NULL)
    state?: SnapshotState | SnapshotState[]; // optional state filter (single or multiple)
  }): Promise<Snapshot[]> {
    try {
      const { exactDate, beforeDate, daysAgo, claimNftId, state } =
        options || {};

      // Build where clause
      const where: any = {};

      if (exactDate) {
        // Exact date match has precedence
        where.date = exactDate;
        this.logger.log(
          `Fetching snapshots for exact date ${exactDate.toISOString()}$${
            claimNftId !== undefined ? ` with claim_nft_id ${claimNftId}` : ""
          }`
        );
      } else {
        // Determine cutoff date precedence: explicit beforeDate > daysAgo > default(29)
        let cutoff: Date;
        if (beforeDate) {
          cutoff = beforeDate;
        } else if (typeof daysAgo === "number" && !isNaN(daysAgo)) {
          cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - daysAgo);
        } else {
          cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 29);
        }

        where.date = LessThan(cutoff);
        this.logger.log(
          `Fetching snapshots older than cutoff ${cutoff.toISOString()} (${
            daysAgo ?? (beforeDate ? "explicit" : 29)
          } days reference)$${
            claimNftId !== undefined ? ` with claim_nft_id ${claimNftId}` : ""
          }`
        );
      }

      if (claimNftId !== undefined) {
        where.claim_nft_id = claimNftId === null ? IsNull() : claimNftId;
      }

      if (state !== undefined) {
        if (Array.isArray(state)) {
          where.state = In(state);
        } else {
          where.state = state;
        }
      }

      const snapshots = await this.snapshotRepository.find({
        where,
        order: { date: "DESC" },
      });

      this.logger.log(
        `Found ${snapshots.length} snapshots for criteria (exactDate=$${
          exactDate ? exactDate.toISOString() : "none"
        }, claimFilter=$${
          claimNftId === undefined
            ? "none"
            : claimNftId === null
            ? "NULL"
            : claimNftId
        }, stateFilter=$${
          state === undefined
            ? "none"
            : Array.isArray(state)
            ? state.join(",")
            : state
        })`
      );

      return snapshots;
    } catch (error) {
      this.logger.error("Error fetching snapshots:", error);
      throw error;
    }
  }

  /**
   * Fetch snapshots with state UNSTAKE_STARTED that are at least 7 days old
   * @returns Promise<Snapshot[]> Array of matching snapshots
   */
  async getUnstakeStartedSnapshotsOlderThanSevenDays(): Promise<Snapshot[]> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      this.logger.log(
        `Fetching snapshots with state UNSTAKE_STARTED older than 7 days (before ${sevenDaysAgo.toISOString()})`
      );

      const snapshots = await this.snapshotRepository.find({
        where: {
          state: SnapshotState.UNSTAKE_STARTED,
          date: LessThan(sevenDaysAgo),
        },
        order: { date: "DESC" },
      });

      this.logger.log(
        `Found ${snapshots.length} snapshots with state UNSTAKE_STARTED older than 7 days`
      );

      return snapshots;
    } catch (error) {
      this.logger.error(
        "Error fetching UNSTAKE_STARTED snapshots older than 7 days:",
        error
      );
      throw error;
    }
  }

  /**
   * Fetch snapshot accounts with optional filters.
   * If no filters are provided, returns all snapshot accounts.
   * @param walletAddress (optional) filter by a specific wallet/account address
   * @param fundSent (optional) filter by fund_units_sent flag
   * @returns Promise<SnapshotAccount[]> list of snapshot account rows
   */
  async getSnapshotAccounts(options?: {
    date?: Date; // exact snapshot date to filter
    walletAddress?: string;
    fundSent?: boolean;
  }): Promise<SnapshotAccount[]> {
    try {
      const { date, walletAddress, fundSent } = options || {};

      const where: any = {};
      if (date) {
        where.date = date;
      }
      if (walletAddress) {
        where.account = walletAddress;
      }
      if (fundSent !== undefined) {
        where.fund_units_sent = fundSent;
      }

      this.logger.log(
        `Fetching snapshot accounts with filters date=$${
          date ? date.toISOString() : "*"
        }, walletAddress=$${walletAddress || "*"}, fundSent=$${
          fundSent === undefined ? "*" : fundSent
        }`
      );

      const accounts = await this.snapshotAccountRepository.find({
        where,
        order: { date: "DESC" },
      });

      this.logger.log(`Found ${accounts.length} snapshot accounts`);
      return accounts;
    } catch (error) {
      this.logger.error("Error fetching snapshot accounts:", error);
      throw error;
    }
  }

  /**
   * Delete a snapshot and its related snapshot accounts from the database
   * @param date The date of the snapshot to delete
   * @param claimNftId Optional claim NFT ID filter - if provided, only delete snapshot with matching claim_nft_id
   * @returns Promise<{ success: boolean; deletedAccountsCount: number; message: string }> Result of the deletion operation
   */
  async deleteSnapshot(
    date: Date,
    claimNftId?: string | null
  ): Promise<{
    success: boolean;
    deletedAccountsCount: number;
    message: string;
  }> {
    try {
      this.logger.log(
        `Attempting to delete snapshot for date: ${date.toISOString()}${
          claimNftId !== undefined ? ` with claim_nft_id: ${claimNftId}` : ""
        }`
      );

      return await this.dataSource.transaction(async (manager) => {
        const snapshotRepo = manager.getRepository(Snapshot);
        const snapshotAccountRepo = manager.getRepository(SnapshotAccount);

        // Build where clause for snapshot
        const snapshotWhere: any = { date };
        if (claimNftId !== undefined) {
          snapshotWhere.claim_nft_id =
            claimNftId === null ? IsNull() : claimNftId;
        }

        // Check if snapshot exists
        const existingSnapshot = await snapshotRepo.findOne({
          where: snapshotWhere,
        });

        if (!existingSnapshot) {
          const message = `No snapshot found for date: ${date.toISOString()}${
            claimNftId !== undefined ? ` with claim_nft_id: ${claimNftId}` : ""
          }`;
          this.logger.warn(message);
          return {
            success: false,
            deletedAccountsCount: 0,
            message,
          };
        }

        // First, delete all related snapshot accounts
        const deleteAccountsResult = await snapshotAccountRepo.delete({ date });
        const deletedAccountsCount = deleteAccountsResult.affected || 0;

        this.logger.log(
          `Deleted ${deletedAccountsCount} snapshot accounts for date: ${date.toISOString()}`
        );

        // Then, delete the snapshot itself
        const deleteSnapshotResult = await snapshotRepo.delete(snapshotWhere);
        const deletedSnapshotsCount = deleteSnapshotResult.affected || 0;

        if (deletedSnapshotsCount === 0) {
          const message = `Failed to delete snapshot for date: ${date.toISOString()}${
            claimNftId !== undefined ? ` with claim_nft_id: ${claimNftId}` : ""
          }`;
          this.logger.error(message);
          return {
            success: false,
            deletedAccountsCount,
            message,
          };
        }

        const successMessage = `Successfully deleted snapshot for date: ${date.toISOString()}${
          claimNftId !== undefined ? ` with claim_nft_id: ${claimNftId}` : ""
        } and ${deletedAccountsCount} related snapshot accounts`;

        this.logger.log(successMessage);

        return {
          success: true,
          deletedAccountsCount,
          message: successMessage,
        };
      });
    } catch (error) {
      const errorMessage = `Error deleting snapshot for date: ${date.toISOString()}${
        claimNftId !== undefined ? ` with claim_nft_id: ${claimNftId}` : ""
      }`;
      this.logger.error(errorMessage, error);
      throw error;
    }
  }
}
