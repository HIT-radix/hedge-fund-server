import { Controller, HttpException, HttpStatus, Get } from "@nestjs/common";
import { SnapshotsService } from "./snapshots.service";

@Controller("snapshots")
export class SnapshotsController {
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
}
