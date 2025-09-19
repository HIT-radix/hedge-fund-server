import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, LessThan, IsNull, In } from "typeorm";
import { GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";
import { Cron } from "@nestjs/schedule";
import { NftHolder } from "@/database/entities/nft-holder.entity";
import { LedgerState } from "@/database/entities/ledger-state.entity";
import { Snapshot } from "@/database/entities/snapshot.entity";
import { SnapshotAccount } from "@/database/entities/snapshot-account.entity";
import { SnapshotState } from "@/interfaces/enum";
import { RADIX_CONFIG } from "@/config/radix.config";
import {
  DAPP_DEFINITION_ADDRESS,
  HIT_FOMO_NODE_LSU_ADDRESS,
  VALIDATOR_ADDRESS,
  XRD_RESOURCE_ADDRESS,
} from "@/constants/address";
import Decimal from "decimal.js";
import { executeTransactionManifest } from "@/utils/helpers";
import {
  get_finish_unstake_manifest,
  get_fund_units_distribution_manifest,
  get_start_unlock_owner_stake_units_manifest,
  get_start_unstake_manifest,
} from "@/utils/manifests";
import {
  fetchValidatorInfo,
  getEventKeyValuesFromTransaction,
} from "radix-utils";
import {
  getPriceDataFromMorpherOracle,
  priceMsgToMorpherString,
} from "@/utils/oracle";
import { MorpherPriceData } from "@/interfaces/types.interface";

// Tracks the last lifecycle state of the scheduled trigger pipeline
enum LastTriggeringState {
  STEP1_START = "STEP1_START",
  STEP1_END = "STEP1_END",
  STEP2_START = "STEP2_START",
  STEP2_END = "STEP2_END",
  STEP3_START = "STEP3_START",
  STEP3_END = "STEP3_END",
}

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);
  private readonly gatewayApi: GatewayApiClient;
  // Last triggering state across the 3-step scheduled pipeline.
  // Initialized to STEP3_END so STEP 1 is allowed to start first.
  private lastTriggeringState: LastTriggeringState =
    LastTriggeringState.STEP3_END;

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
   * Execute a database operation with connection retry logic
   * @param operation Function that performs the database operation
   * @param maxRetries Maximum number of retry attempts
   * @returns Result of the operation
   */
  private async withDbRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check connection health on retries
        if (attempt > 1) {
          this.logger.log(
            `DB operation retry attempt ${attempt}/${maxRetries}`
          );

          try {
            // Verify connection with simple query
            await this.dataSource.query("SELECT 1");
            this.logger.log("Database connection verified");
          } catch (pingError) {
            this.logger.warn(
              "Database connection check failed, reconnecting:",
              pingError
            );

            // Force reconnection if needed
            if (!this.dataSource.isInitialized) {
              await this.dataSource.initialize();
              this.logger.log("Database connection reinitialized");
            } else {
              // Try to get a fresh connection from the pool
              const queryRunner = this.dataSource.createQueryRunner();
              await queryRunner.connect();
              await queryRunner.release();
              this.logger.log("Database connection refreshed");
            }
          }
        }

        return await operation();
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `DB operation failed (attempt ${attempt}/${maxRetries}):`,
          error
        );

        if (attempt < maxRetries) {
          // Exponential backoff with max 3 second delay
          const delay = Math.min(100 * Math.pow(2, attempt), 3000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(
      `DB operation failed after ${maxRetries} attempts:`,
      lastError
    );
    throw lastError;
  }

  /**
   * Simple method to test database connectivity
   * @returns Promise<boolean> True if the database is connected
   */
  async testDbConnection(): Promise<boolean> {
    try {
      await this.withDbRetry(async () => {
        await this.dataSource.query("SELECT 1 AS dbConnected");
        this.logger.log("Database connection verified");
        return true;
      });
      return true;
    } catch (error) {
      this.logger.error("Database connection test failed:", error);
      throw error;
    }
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

      return await this.withDbRetry(async () => {
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
            if (Boolean(claimNftId)) {
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

      // Save the snapshot with the LSU data using the retry mechanism
      return await this.withDbRetry(async () => {
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
      });
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
        }
        // else {
        //   cutoff = new Date();
        //   cutoff.setDate(cutoff.getDate() - 29);
        // }

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

      const snapshots = await this.withDbRetry(async () => {
        return await this.snapshotRepository.find({
          where,
          order: { date: "DESC" },
        });
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

      const accounts = await this.withDbRetry(async () => {
        return await this.snapshotAccountRepository.find({
          where,
          order: { date: "DESC" },
        });
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

      return await this.withDbRetry(async () => {
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
              claimNftId !== undefined
                ? ` with claim_nft_id: ${claimNftId}`
                : ""
            }`;
            this.logger.warn(message);
            return {
              success: false,
              deletedAccountsCount: 0,
              message,
            };
          }

          // First, delete all related snapshot accounts
          const deleteAccountsResult = await snapshotAccountRepo.delete({
            date,
          });
          const deletedAccountsCount = deleteAccountsResult.affected || 0;

          this.logger.log(
            `Deleted ${deletedAccountsCount} snapshot accounts for date: ${date.toISOString()}`
          );

          // Then, delete the snapshot itself
          const deleteSnapshotResult = await snapshotRepo.delete(snapshotWhere);
          const deletedSnapshotsCount = deleteSnapshotResult.affected || 0;

          if (deletedSnapshotsCount === 0) {
            const message = `Failed to delete snapshot for date: ${date.toISOString()}${
              claimNftId !== undefined
                ? ` with claim_nft_id: ${claimNftId}`
                : ""
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
      });
    } catch (error) {
      const errorMessage = `Error deleting snapshot for date: ${date.toISOString()}${
        claimNftId !== undefined ? ` with claim_nft_id: ${claimNftId}` : ""
      }`;
      this.logger.error(errorMessage, error);
      throw error;
    }
  }

  async testFetchValidatorInfo() {
    const nodeInfo = await fetchValidatorInfo(
      this.gatewayApi,
      VALIDATOR_ADDRESS
    );
    return nodeInfo;
  }

  async pingFundManagerToStartUnlockOperation(availableLockedLSUs: string) {
    const manifest = await get_start_unlock_owner_stake_units_manifest(
      availableLockedLSUs
    );
    return await executeTransactionManifest(manifest, 10);
  }

  async pingFundManagerToStartUnstakeOperation() {
    const manifest = await get_start_unstake_manifest();
    return await executeTransactionManifest(manifest, 10);
  }

  async pingFundManagerToFinishUnstakeOperation(
    claimNftId: string,
    morpherData: MorpherPriceData
  ) {
    const morpherMessage = priceMsgToMorpherString(morpherData);
    const morpherSignature = morpherData.signature;
    const manifest = await get_finish_unstake_manifest(claimNftId, [
      {
        coinAddress: XRD_RESOURCE_ADDRESS,
        message: morpherMessage,
        signature: morpherSignature,
      },
    ]);
    return await executeTransactionManifest(manifest, 10);
  }

  async pingFundManagerToDistributeFundsUnitsOperation(
    fundsDistribution: { address: string; amount: string }[],
    snapshotDate: Date
  ): Promise<string[]> {
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(fundsDistribution.length / BATCH_SIZE);
    const successfulAddresses: string[] = [];

    this.logger.log(
      `Starting fund distribution for ${fundsDistribution.length} recipients in ${totalBatches} batches`
    );

    for (let i = 0; i < totalBatches; i++) {
      const startIndex = i * BATCH_SIZE;
      const endIndex = Math.min(
        startIndex + BATCH_SIZE,
        fundsDistribution.length
      );
      const batch = fundsDistribution.slice(startIndex, endIndex);
      const isLastBatch = i === totalBatches - 1;
      const moreLeft = !isLastBatch;

      this.logger.log(
        `Processing batch ${i + 1}/${totalBatches} with ${
          batch.length
        } recipients (moreLeft: ${moreLeft})`
      );

      try {
        const manifest = await get_fund_units_distribution_manifest(
          batch,
          moreLeft
        );

        const result = await executeTransactionManifest(manifest, 10);

        if (!result.success) {
          this.logger.error(
            `Failed to execute batch ${i + 1}/${totalBatches}:`,
            result.error
          );
          throw new Error(`Batch ${i + 1} failed: ${result.error}`);
        }

        // Add successful addresses from this batch
        const batchAddresses = batch.map((item) => item.address);

        try {
          const updateResult = await this.snapshotAccountRepository.update(
            {
              date: snapshotDate,
              account: In(batchAddresses),
            },
            { fund_units_sent: true }
          );

          this.logger.log(
            `Successfully updated ${
              updateResult.affected || 0
            } snapshot accounts as fund_units_sent for batch ${
              i + 1
            }/${totalBatches}`
          );
        } catch (updateError) {
          this.logger.error(
            `Failed to update snapshot accounts for batch ${
              i + 1
            }/${totalBatches}:`,
            updateError
          );
          // Abort the entire operation if database update fails
          throw new Error(
            `Database update failed for batch ${
              i + 1
            }/${totalBatches}. Aborting fund distribution operation for snapshot date: ${snapshotDate}. Error: ${
              updateError.message || updateError
            }`
          );
        }

        successfulAddresses.push(...batchAddresses);

        this.logger.log(
          `Successfully executed batch ${
            i + 1
          }/${totalBatches} with transaction ID: ${result.txId}. Added ${
            batchAddresses.length
          } addresses to successful list.`
        );
        return successfulAddresses;
      } catch (error) {
        this.logger.error(
          `Error executing batch ${i + 1}/${totalBatches}:`,
          error
        );
        throw error;
      }
    }

    this.logger.log(
      `Successfully completed all ${totalBatches} batches for fund distribution. Total successful addresses: ${successfulAddresses.length}`
    );

    return successfulAddresses;
  }

  /**
   * Scheduled operation STEP 1 - Runs every 15 minutes
   * Creates snapshot and starts unlock operation
   */
  @Cron("0 0,15,30,45 * * * *")
  async scheduledOperation_STEP_1() {
    try {
      // Gate: only run STEP 1 if previous state indicates STEP 3 ended
      if (this.lastTriggeringState !== LastTriggeringState.STEP3_END) {
        this.logger.warn(
          `[CRON][STEP#1] Skipped: last state is ${this.lastTriggeringState}, expected ${LastTriggeringState.STEP3_END}`
        );
        return null;
      }

      const prevState = this.lastTriggeringState;
      this.lastTriggeringState = LastTriggeringState.STEP1_START;
      this.logger.log("[CRON] Starting scheduledOperation_STEP_1");
      const date = new Date();
      // Implementation for the scheduled start unlock operation
      const node_info = await fetchValidatorInfo(
        this.gatewayApi,
        VALIDATOR_ADDRESS
      );

      this.logger.log("node info", node_info);

      if (new Decimal(300).lessThan(node_info.currentlyEarnedLockedLSUs)) {
        return "not enough locked LSUs to start unlock";
      }

      const availableLockedLSUs = "300"; //node_info.currentlyEarnedLockedLSUs;

      const snapshot = await this.createSnapshot(
        date,
        SnapshotState.UNLOCK_STARTED
      );

      this.logger.log("[STEP#1]:", snapshot);

      const pingResult = await this.pingFundManagerToStartUnlockOperation(
        availableLockedLSUs
      );

      if (pingResult.success) {
        this.logger.log("[STEP#1]:", pingResult);
        this.logger.log(
          "[CRON] scheduledOperation_STEP_1 completed successfully"
        );
        this.lastTriggeringState = LastTriggeringState.STEP1_END;
        return pingResult;
      } else {
        this.logger.log("[STEP#1]: delete snapshot");
        await this.deleteSnapshot(snapshot.date, snapshot.claim_nft_id);
        this.logger.warn(
          "[CRON] scheduledOperation_STEP_1 failed, snapshot deleted"
        );
        // Revert state so STEP 1 may retry on next tick
        this.lastTriggeringState = prevState;
      }
    } catch (error) {
      this.logger.error("[CRON] scheduledOperation_STEP_1 failed:", error);
      // Revert state on failure to allow retry
      this.lastTriggeringState = LastTriggeringState.STEP3_END;
      throw error;
    }
  }

  /**
   * Scheduled operation STEP 2 - Runs 5 minutes after STEP 1 (5, 20, 35, 50 minutes)
   * Starts unstake operation for existing snapshots
   */
  @Cron("0 5,20,35,50 * * * *")
  async scheduledOperation_STEP_2() {
    try {
      // Gate: only run STEP 2 if STEP 1 has ended
      if (this.lastTriggeringState !== LastTriggeringState.STEP1_END) {
        this.logger.warn(
          `[CRON][STEP#2] Skipped: last state is ${this.lastTriggeringState}, expected ${LastTriggeringState.STEP1_END}`
        );
        return null;
      }

      const prevState = this.lastTriggeringState;
      this.lastTriggeringState = LastTriggeringState.STEP2_START;
      this.logger.log("[CRON] Starting scheduledOperation_STEP_2");
      const snapshots = await this.getSnapshotsFromDb({
        daysAgo: 0,
        state: SnapshotState.UNLOCK_STARTED,
      });

      const snapshot = snapshots[0];

      if (!snapshot) {
        this.logger.warn("[STEP#2] No snapshot found");
        return null;
      }

      const pingResult = await this.pingFundManagerToStartUnstakeOperation();
      this.logger.log(
        `[STEP#2] Unstake transaction result: ${JSON.stringify(pingResult)}`
      );
      // txid_tdx_2_19afjcckdk5dmxhruxslpw5d5t290t8jjjh7jn5edrvyhp8zqulkspzqk6z;
      if (pingResult.success) {
        this.logger.log("[STEP#2]:", pingResult);
        const txId = pingResult.txId;

        const eventKeyValues = await getEventKeyValuesFromTransaction(
          this.gatewayApi,
          txId,
          "LsuUnstakeStartedEvent"
        );

        const claimNftId = eventKeyValues.claim_nft_id;

        this.logger.log("[STEP#2] claimNftId:", eventKeyValues);

        const updatedSnapshot = await this.saveSnapshot(
          snapshot.date,
          {},
          SnapshotState.UNSTAKE_STARTED,
          claimNftId,
          false
        );
        this.lastTriggeringState = LastTriggeringState.STEP2_END;
        this.logger.log(
          "[CRON] scheduledOperation_STEP_2 completed successfully"
        );
        return updatedSnapshot;
      } else {
        this.logger.warn("[CRON] scheduledOperation_STEP_2 failed");
        // Revert state so STEP 2 may retry on next tick
        this.lastTriggeringState = prevState;
      }

      return snapshots;
    } catch (error) {
      this.logger.error("[CRON] scheduledOperation_STEP_2 failed:", error);
      // Revert state on failure to allow retry
      this.lastTriggeringState = LastTriggeringState.STEP1_END;
      throw error;
    }
  }

  /**
   * Scheduled operation STEP 3 - Runs 5 minutes after STEP 2 (10, 25, 40, 55 minutes)
   * Finishes unstake operation and distributes funds
   */
  @Cron("0 10,25,40,55 * * * *")
  async scheduledOperation_STEP_3() {
    try {
      // Gate: only run STEP 3 if STEP 2 has ended
      if (this.lastTriggeringState !== LastTriggeringState.STEP2_END) {
        this.logger.warn(
          `[CRON][STEP#3] Skipped: last state is ${this.lastTriggeringState}, expected ${LastTriggeringState.STEP2_END}`
        );
        return null;
      }

      const prevState = this.lastTriggeringState;
      this.lastTriggeringState = LastTriggeringState.STEP3_START;
      this.logger.log("[CRON] Starting scheduledOperation_STEP_3");
      const snapshots = await this.getSnapshotsFromDb({
        daysAgo: 0,
        state: SnapshotState.UNSTAKE_STARTED,
      });

      this.logger.log("[STEP#3] snapshots found:", snapshots.length);

      const snapshot = snapshots[0];

      if (!snapshot) {
        this.logger.warn("[STEP#3] No snapshot found");
        return null;
      }

      this.logger.log(
        `[STEP#3] Processing snapshot for date: ${snapshot.date}`
      );

      const priceData = await getPriceDataFromMorpherOracle("GATEIO:XRD_USDT");

      this.logger.log(
        `[STEP#3] Fetched price data from Morpher Oracle: ${JSON.stringify(
          priceData
        )}`
      );

      const pingResult = await this.pingFundManagerToFinishUnstakeOperation(
        snapshot.claim_nft_id,
        priceData
      );

      this.logger.log(
        `[STEP#3] Finish unstake transaction result: ${JSON.stringify(
          pingResult
        )}`
      );

      if (pingResult.success) {
        this.logger.log(
          `[STEP#3] Finish unstake transaction successful: ${JSON.stringify(
            pingResult
          )}`
        );
        const txId = pingResult.txId;

        const eventKeyValues = await getEventKeyValuesFromTransaction(
          this.gatewayApi,
          txId,
          "LsuUnstakeCompletedEvent"
        );

        this.logger.log(
          `[STEP#3] LsuUnstakeCompletedEvent values: ${JSON.stringify(
            eventKeyValues
          )}`
        );

        const totalFundsUnitToDistribute =
          eventKeyValues.fund_units_to_distribute;

        await this.saveSnapshot(
          snapshot.date,
          {},
          SnapshotState.UNSTAKED,
          null,
          false
        );

        this.logger.log("[STEP#3] snapshot saved as UNSTAKED");

        const snapshotAccounts = await this.getSnapshotAccounts({
          date: snapshot.date,
          fundSent: false,
        });

        this.logger.log(
          `[STEP#3] Fetched ${snapshotAccounts.length} snapshot accounts needing fund distribution`
        );

        const totalLSUs = snapshotAccounts.reduce(
          (acc, account) => new Decimal(acc).add(account.lsu_amount),
          new Decimal(0)
        );

        this.logger.log(
          `[STEP#3] Total LSU amount across accounts: ${totalLSUs.toString()}`
        );

        let accountsShare: Record<string, string> = {};

        snapshotAccounts.forEach((account) => {
          const share = new Decimal(account.lsu_amount)
            .div(totalLSUs)
            .toString();
          accountsShare[account.account] = share;
        });

        let fundsDistribution: { address: string; amount: string }[] = [];

        snapshotAccounts.forEach((snapshot) => {
          const share = accountsShare[snapshot.account];
          const amount = new Decimal(totalFundsUnitToDistribute)
            .mul(share)
            .toDecimalPlaces(18, Decimal.ROUND_DOWN)
            .toString();
          fundsDistribution.push({
            address: snapshot.account,
            amount,
          });
        });

        const successfullyDistributedAddresses =
          await this.pingFundManagerToDistributeFundsUnitsOperation(
            fundsDistribution,
            snapshot.date
          );

        if (
          successfullyDistributedAddresses.length !== fundsDistribution.length
        ) {
          this.logger.warn(
            `[STEP#3] Not all funds were successfully distributed. Expected: ${fundsDistribution.length}, Actual: ${successfullyDistributedAddresses.length}`
          );
          throw new Error(
            "[STEP#3] Not all funds were successfully distributed"
          );
        }

        await this.saveSnapshot(
          snapshot.date,
          {},
          SnapshotState.DISTRIBUTED,
          null,
          false
        );

        this.lastTriggeringState = LastTriggeringState.STEP3_END;
        this.logger.log(
          "[CRON] scheduledOperation_STEP_3 completed successfully"
        );
        return successfullyDistributedAddresses;
      } else {
        this.logger.warn("[CRON] scheduledOperation_STEP_3 failed");
        // Revert state so STEP 3 may retry on next tick
        this.lastTriggeringState = prevState;
        return null;
      }
    } catch (error) {
      this.logger.error("[CRON] scheduledOperation_STEP_3 failed:", error);
      // Revert state on failure to allow retry
      this.lastTriggeringState = LastTriggeringState.STEP2_END;
      throw error;
    }
  }
}
