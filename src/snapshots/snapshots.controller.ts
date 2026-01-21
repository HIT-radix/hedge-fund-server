import {
  Controller,
  HttpException,
  HttpStatus,
  Get,
  Logger,
  Query,
} from "@nestjs/common";
import { SnapshotsService } from "./snapshots.service";

@Controller("snapshots")
export class SnapshotsController {
  private readonly logger = new Logger(SnapshotsController.name);

  constructor(private readonly snapshotsService: SnapshotsService) {}

  private validateAdminSecret(secret?: string) {
    if (!secret) {
      throw new HttpException("Secret is required", HttpStatus.BAD_REQUEST);
    }

    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      throw new HttpException(
        "Admin secret is not configured",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (secret !== adminSecret) {
      throw new HttpException("Invalid secret", HttpStatus.UNAUTHORIZED);
    }
  }

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
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // @Get("older-snapshots")
  // async getOlderSnapshots(
  //   @Query("beforeDate") beforeDateStr?: string,
  //   @Query("daysAgo") daysAgoStr?: string,
  //   @Query("claimNftId") claimNftId?: string,
  //   @Query("claimNftIdNull") claimNftIdNull?: string // if provided (any value), we filter for NULL claim_nft_id
  // ) {
  //   try {
  //     let beforeDate: Date | undefined = undefined;
  //     if (beforeDateStr) {
  //       const d = new Date(beforeDateStr);
  //       if (isNaN(d.getTime())) {
  //         throw new HttpException(
  //           "Invalid beforeDate. Use ISO string.",
  //           HttpStatus.BAD_REQUEST
  //         );
  //       }
  //       beforeDate = d;
  //     }

  //     let daysAgo: number | undefined = undefined;
  //     if (daysAgoStr) {
  //       const parsed = Number(daysAgoStr);
  //       if (isNaN(parsed) || parsed < 0) {
  //         throw new HttpException(
  //           "Invalid daysAgo. Provide a non-negative number.",
  //           HttpStatus.BAD_REQUEST
  //         );
  //       }
  //       daysAgo = parsed;
  //     }

  //     // Determine claim nft id filter logic
  //     let claimFilter: string | null | undefined = undefined;
  //     if (claimNftIdNull !== undefined) {
  //       claimFilter = null; // explicit request for NULLs
  //     } else if (claimNftId !== undefined) {
  //       claimFilter = claimNftId;
  //     }

  //     const snapshots = await this.snapshotsService.getSnapshotsFromDb({
  //       beforeDate,
  //       daysAgo,
  //       claimNftId: claimFilter,
  //     });
  //     return {
  //       success: true,
  //       message: "Older snapshots retrieved successfully",
  //       data: snapshots,
  //       meta: {
  //         beforeDate: beforeDate?.toISOString() ?? null,
  //         daysAgo: daysAgo ?? null,
  //         claimNftId: claimFilter === undefined ? undefined : claimFilter, // could be null
  //       },
  //     };
  //   } catch (error) {
  //     this.logger.error("Error fetching older snapshots:", error);
  //     if (error instanceof HttpException) throw error;
  //     throw new HttpException(
  //       "Failed to fetch older snapshots",
  //       HttpStatus.INTERNAL_SERVER_ERROR
  //     );
  //   }
  // }

  // @Get("delete-snapshot")
  // async deleteSnapshot() {
  //   try {
  //     const date = new Date("2025-08-26 19:04:02");
  //     if (isNaN(date.getTime())) {
  //       throw new HttpException(
  //         "Invalid date format. Use ISO string format.",
  //         HttpStatus.BAD_REQUEST
  //       );
  //     }

  //     // Determine claim nft id filter logic
  //     let claimFilter: string | null | undefined = undefined;

  //     const result = await this.snapshotsService.deleteSnapshot(
  //       date,
  //       claimFilter
  //     );

  //     if (!result.success) {
  //       throw new HttpException(result.message, HttpStatus.NOT_FOUND);
  //     }

  //     return {
  //       success: true,
  //       message: result.message,
  //       data: {
  //         date: date.toISOString(),
  //         deletedAccountsCount: result.deletedAccountsCount,
  //         claimNftId: claimFilter === undefined ? undefined : claimFilter,
  //       },
  //     };
  //   } catch (error) {
  //     this.logger.error("Error deleting snapshot:", error);
  //     if (error instanceof HttpException) throw error;
  //     throw new HttpException(
  //       "Failed to delete snapshot",
  //       HttpStatus.INTERNAL_SERVER_ERROR
  //     );
  //   }
  // }

  // NOTE: Remove or protect this endpoint before production use.
  @Get("trigger-step-1")
  async testScheduledStep1(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);
      this.logger.log("Triggering step1 manually...");

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
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // NOTE: Remove or protect this endpoint before production use.
  @Get("trigger-step-2")
  async testScheduledStep2(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);
      this.logger.log("Triggering step2 manually...");
      const result = await this.snapshotsService.scheduledOperation_STEP_2();

      return {
        success: true,
        message: "Scheduled operation step 2 completed successfully",
        data: result,
      };
    } catch (error) {
      this.logger.error("Error testing scheduledOperation_STEP_2:", error);
      throw new HttpException(
        (error as Error).message ||
          "Failed to execute scheduled operation step 2",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("trigger-step-3")
  async testScheduledStep3(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);
      this.logger.log("Triggering step3 manually...");

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
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Reset stuck funds units in STEP 3
  // NOTE: Remove or protect this endpoint before production use.
  @Get("reset-stuck-funds")
  async resetStuckFunds(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);
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
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
