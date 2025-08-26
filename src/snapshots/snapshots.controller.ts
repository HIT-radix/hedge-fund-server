import {
  Controller,
  HttpException,
  HttpStatus,
  Get,
  Query,
  Logger,
} from "@nestjs/common";
import { SnapshotsService } from "./snapshots.service";

@Controller("snapshots")
export class SnapshotsController {
  private readonly logger = new Logger(SnapshotsController.name);

  constructor(private readonly snapshotsService: SnapshotsService) {}

  @Get("create-snapshot")
  async createSnapshot() {
    try {
      const snapshot = await this.snapshotsService.createSnapshot();

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
}
