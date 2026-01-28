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

  @Get("take-fund-unit-snapshot")
  async takeFundUnitValueSnapshot(
    @Query("secret") secret?: string,
    @Query("forceupdate") forceupdate?: string,
  ) {
    try {
      this.validateAdminSecret(secret);
      const forceUpdateBool = forceupdate === "true";
      this.logger.log(
        `Taking fund unit value snapshot manually... forceUpdate=${forceUpdateBool}`,
      );

      const result =
        await this.snapshotsService.takeSnapshotOfFundUnitValue(
          forceUpdateBool,
        );

      if (!result) {
        throw new HttpException(
          "Failed to store fund unit value snapshot",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: "Fund unit value snapshot stored successfully",
        data: result,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error("Error taking fund unit value snapshot:", error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        (error as Error).message || "Failed to take fund unit value snapshot",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("take-total-fund-snapshot")
  async takeTotalFundValueSnapshot(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);
      this.logger.log("Taking total fund value snapshot manually...");

      const result = await this.snapshotsService.takeSnapshotOfTotalFundValue();

      if (!result) {
        throw new HttpException(
          "Failed to store total fund value snapshot",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: "Total fund value snapshot stored successfully",
        data: result,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error("Error taking total fund value snapshot:", error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        (error as Error).message || "Failed to take total fund value snapshot",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("fund-unit-historic-values")
  async getFundUnitValues(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);
      this.logger.log("Fetching all fund unit value records...");

      const values = await this.snapshotsService.getFundUnitValues();

      return {
        success: true,
        count: values.length,
        data: values,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error("Error fetching fund unit value records:", error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        (error as Error).message || "Failed to fetch fund unit value records",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("total-fund-historic-values")
  async getTotalFundValues(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);
      this.logger.log("Fetching all total fund value records...");

      const values = await this.snapshotsService.getTotalFundValues();

      return {
        success: true,
        count: values.length,
        data: values,
        meta: { timestamp: new Date().toISOString() },
      };
    } catch (error) {
      this.logger.error("Error fetching total fund value records:", error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        (error as Error).message || "Failed to fetch total fund value records",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async getAllSnapshots(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);
      this.logger.log("Fetching all snapshots with accounts...");

      const snapshots = await this.snapshotsService.getSnapshotsFromDb({
        includeAccounts: true,
      });

      return {
        success: true,
        count: snapshots.length,
        data: snapshots,
      };
    } catch (error) {
      this.logger.error("Error fetching snapshots:", error);
      throw new HttpException(
        (error as Error).message || "Failed to fetch snapshots",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
