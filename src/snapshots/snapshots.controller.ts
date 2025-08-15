import {
  Controller,
  HttpException,
  HttpStatus,
  Get,
  Query,
  Logger,
} from "@nestjs/common";
import { SnapshotsService } from "./snapshots.service";
import { LedgerState } from "@/database/entities/ledger-state.entity";

@Controller("snapshots")
export class SnapshotsController {
  private readonly logger = new Logger(SnapshotsController.name);

  constructor(private readonly snapshotsService: SnapshotsService) {}

  @Get("update-nft-holders")
  async updateNftHolders() {
    try {
      const result = await this.snapshotsService.updateNftHolders();
      return {
        success: true,
        message: "NFT holders updated successfully",
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        "Failed to update NFT holders",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("lsu-amounts")
  async getLSUAmountsAtDate(@Query("date") dateString?: string) {
    try {
      // If no date provided, use current date
      const date = dateString ? new Date(dateString) : new Date();

      // Validate date
      if (isNaN(date.getTime())) {
        throw new HttpException(
          "Invalid date format. Please use ISO format (e.g., 2025-08-03T10:00:00Z)",
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.snapshotsService.getLSUAmountsAtDate(date);

      if (!result) {
        throw new HttpException(
          "Failed to get LSU amounts - no data available",
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        message: "LSU amounts retrieved successfully",
        date: date.toISOString(),
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Failed to get LSU amounts",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("create-snapshot")
  async createSnapshotAtDate() {
    try {
      const snapshot = await this.snapshotsService.createSnapshotAtDate();

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

  /**
   * Get the last stored ledger state
   * @returns Promise<LedgerState | null>
   */
  @Get("ledger-state/latest")
  async getLastLedgerState(): Promise<LedgerState | null> {
    try {
      this.logger.log("Fetching last ledger state via HTTP endpoint");
      const lastLedgerState = await this.snapshotsService.getLastLedgerState();

      if (!lastLedgerState) {
        this.logger.warn("No ledger state found");
      }

      return lastLedgerState;
    } catch (error) {
      this.logger.error("Error in getLastLedgerState endpoint:", error);
      throw error;
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
}
