import {
  Controller,
  HttpException,
  HttpStatus,
  Get,
  Query,
  Logger,
} from "@nestjs/common";
import { SnapshotsService } from "./snapshots.service";
import { sendTransactionManifest } from "../wallet/helpers/send-tx-manifest";
import { getPriceDataFromMorpherOracle } from "../utils/oracle";
import { MORPHER_ORACLE_NFT_ID } from "@/constants/address";

@Controller("snapshots")
export class SnapshotsController {
  private readonly logger = new Logger(SnapshotsController.name);

  constructor(private readonly snapshotsService: SnapshotsService) {}

  @Get("health")
  async healthCheck() {
    try {
      // Test DB connection with a simple query
      await this.snapshotsService.testDbConnection();
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
      };
    } catch (error) {
      this.logger.error("Health check failed:", error);
      throw new HttpException(
        {
          status: "error",
          database: "disconnected",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  @Get("create-snapshot")
  async createSnapshot() {
    try {
      const snapshot = await this.snapshotsService.createSnapshot(new Date());

      if (!snapshot) {
        throw new HttpException(
          "Failed to create snapshot - no data available",
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        message: "Snapshot created successfully",
        date: snapshot.date.toISOString(),
        data: {
          date: snapshot.date,
          state: snapshot.state,
          claim_nft_id: snapshot.claim_nft_id,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Failed to create snapshot",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("older-snapshots")
  async getOlderSnapshots(
    @Query("beforeDate") beforeDateStr?: string,
    @Query("daysAgo") daysAgoStr?: string,
    @Query("claimNftId") claimNftId?: string,
    @Query("claimNftIdNull") claimNftIdNull?: string // if provided (any value), we filter for NULL claim_nft_id
  ) {
    try {
      let beforeDate: Date | undefined = undefined;
      if (beforeDateStr) {
        const d = new Date(beforeDateStr);
        if (isNaN(d.getTime())) {
          throw new HttpException(
            "Invalid beforeDate. Use ISO string.",
            HttpStatus.BAD_REQUEST
          );
        }
        beforeDate = d;
      }

      let daysAgo: number | undefined = undefined;
      if (daysAgoStr) {
        const parsed = Number(daysAgoStr);
        if (isNaN(parsed) || parsed < 0) {
          throw new HttpException(
            "Invalid daysAgo. Provide a non-negative number.",
            HttpStatus.BAD_REQUEST
          );
        }
        daysAgo = parsed;
      }

      // Determine claim nft id filter logic
      let claimFilter: string | null | undefined = undefined;
      if (claimNftIdNull !== undefined) {
        claimFilter = null; // explicit request for NULLs
      } else if (claimNftId !== undefined) {
        claimFilter = claimNftId;
      }

      const snapshots = await this.snapshotsService.getSnapshotsFromDb({
        beforeDate,
        daysAgo,
        claimNftId: claimFilter,
      });
      return {
        success: true,
        message: "Older snapshots retrieved successfully",
        data: snapshots,
        meta: {
          beforeDate: beforeDate?.toISOString() ?? null,
          daysAgo: daysAgo ?? null,
          claimNftId: claimFilter === undefined ? undefined : claimFilter, // could be null
        },
      };
    } catch (error) {
      this.logger.error("Error fetching older snapshots:", error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        "Failed to fetch older snapshots",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("delete-snapshot")
  async deleteSnapshot() {
    try {
      const date = new Date("2025-08-26 19:04:02");
      if (isNaN(date.getTime())) {
        throw new HttpException(
          "Invalid date format. Use ISO string format.",
          HttpStatus.BAD_REQUEST
        );
      }

      // Determine claim nft id filter logic
      let claimFilter: string | null | undefined = undefined;

      const result = await this.snapshotsService.deleteSnapshot(
        date,
        claimFilter
      );

      if (!result.success) {
        throw new HttpException(result.message, HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: result.message,
        data: {
          date: date.toISOString(),
          deletedAccountsCount: result.deletedAccountsCount,
          claimNftId: claimFilter === undefined ? undefined : claimFilter,
        },
      };
    } catch (error) {
      this.logger.error("Error deleting snapshot:", error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        "Failed to delete snapshot",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Test route for the scheduled start unlock operation
  // NOTE: Remove or protect this endpoint before production use.
  @Get("test-scheduled-step-1")
  async testScheduledStep1() {
    try {
      this.logger.log("Testing scheduledStartUnlockOperation...");

      const result = await this.snapshotsService.scheduledOperation_STEP_1();

      return {
        success: true,
        message: "Scheduled start unlock operation completed successfully",
        data: result,
      };
    } catch (error) {
      this.logger.error("Error testing scheduledStartUnlockOperation:", error);
      throw new HttpException(
        (error as Error).message ||
          "Failed to execute scheduled start unlock operation",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Test route for the scheduled operation step 2
  // NOTE: Remove or protect this endpoint before production use.
  @Get("test-scheduled-step-2")
  async testScheduledStep2() {
    try {
      this.logger.log("Testing scheduledOperation_STEP_2...");

      const result = await this.snapshotsService.scheduledOperation_STEP_2();

      return {
        success: true,
        message: "Scheduled operation step 2 completed successfully",
        data: result,
        meta: {
          snapshotsFound: result,
          description:
            "Fetches snapshots from 1 day ago with UNLOCK_STARTED state",
        },
      };
    } catch (error) {
      this.logger.error("Error testing scheduledOperation_STEP_2:", error);
      throw new HttpException(
        (error as Error).message ||
          "Failed to execute scheduled operation step 2",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("test-scheduled-step-3")
  async testScheduledStep3() {
    try {
      this.logger.log("Testing scheduledOperation_STEP_3...");

      const result = await this.snapshotsService.scheduledOperation_STEP_3();

      return {
        success: true,
        message: "Scheduled operation step 3 completed successfully",
        data: result,
      };
    } catch (error) {
      this.logger.error("Error testing scheduledOperation_STEP_3:", error);
      throw new HttpException(
        (error as Error).message ||
          "Failed to execute scheduled operation step 3",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Temporary test route to send a hardcoded transaction manifest through the TS wallet
  // NOTE: Remove or protect this endpoint before production use.
  @Get("test-send-tx")
  async testSendTx() {
    const manifest = `CALL_METHOD
    Address("account_tdx_2_129y9wu3vugaeasnprxjlrqy3tpmr7hpurrmapmyqhsr26ehhrh22e2")
    "withdraw"
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Decimal("17")
;
TAKE_FROM_WORKTOP
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Decimal("17")
    Bucket("bucket1")
;
CALL_METHOD
    Address("account_tdx_2_1297g0fef53k3vvr0faz9dadz24pfppedqgygeu2p7m7a55pmpk4e3v")
    "try_deposit_or_abort"
    Bucket("bucket1")
    Enum<0u8>()
;`;

    try {
      const abc = await sendTransactionManifest(manifest, 10).match(
        (txId) => ({ success: true, txId }),
        (error) => {
          throw new HttpException(
            (error as any)?.message || "Transaction failed",
            HttpStatus.BAD_REQUEST
          );
        }
      );
      return abc;
    } catch (error) {
      throw new HttpException(
        (error as Error).message || "Failed to send transaction",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Test route for the getPriceDataFromMorpherOracle function
  // NOTE: Remove or protect this endpoint before production use.
  @Get("test-oracle-price")
  async testOraclePrice() {
    try {
      // Use default values if not provided
      const testMarketId = "GATEIO:XRD_USDT";
      const testNftId = MORPHER_ORACLE_NFT_ID;

      this.logger.log(
        `Testing oracle price data for market: ${testMarketId}, NFT: ${testNftId}`
      );

      const priceData = await getPriceDataFromMorpherOracle(
        testMarketId,
        testNftId
      );

      return priceData;
    } catch (error) {
      this.logger.error("Error testing oracle price data:", error);
      throw new HttpException(
        (error as Error).message || "Failed to retrieve oracle price data",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Test route for the testFetchValidatorInfo function
  // NOTE: Remove or protect this endpoint before production use.
  @Get("fetch-node-info")
  async testFetchValidatorInfo() {
    try {
      this.logger.log("Testing fetchValidatorInfo...");

      const validatorInfo =
        await this.snapshotsService.testFetchValidatorInfo();

      return {
        success: true,
        message: "Validator info retrieved successfully",
        data: validatorInfo,
        meta: {
          timestamp: new Date().toISOString(),
          description: "Validator information from the Radix network",
        },
      };
    } catch (error) {
      this.logger.error("Error testing fetchValidatorInfo:", error);
      throw new HttpException(
        (error as Error).message || "Failed to retrieve validator info",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Reset stuck funds units in STEP 3
  // NOTE: Remove or protect this endpoint before production use.
  @Get("reset-stuck-funds")
  async resetStuckFunds() {
    try {
      this.logger.log("Resetting stuck funds units in STEP 3...");

      const result = await this.snapshotsService.resetStuckFundsUnitsIn_STEP3();

      return {
        success: true,
        message: "Stuck funds units reset operation completed successfully",
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          description: "Reset stuck funds units distribution with empty array",
        },
      };
    } catch (error) {
      this.logger.error("Error resetting stuck funds units:", error);
      throw new HttpException(
        (error as Error).message || "Failed to reset stuck funds units",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
