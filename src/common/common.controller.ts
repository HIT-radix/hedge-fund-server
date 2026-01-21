import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { LsuHolderService } from "./services/lsu-holder.service";

@Controller("common")
export class CommonController {
  private readonly logger = new Logger(CommonController.name);

  constructor(private readonly lsuHolderService: LsuHolderService) {}

  /**
   * Fetch LSU holders from Weft Collaterals
   * Returns users with LSU collateral amounts and total LSU amount
   */
  @Get("lsu-holders-from-weft-collaterals")
  async getLsuHoldersFromWeftCollaterals() {
    try {
      this.logger.log("Fetching LSU holders from Weft collaterals...");

      const result =
        await this.lsuHolderService.fetchLSUsHoldersFromWeftCollaterals();

      return {
        success: true,
        message: "LSU holders from Weft collaterals retrieved successfully",
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          totalUsersWithCollateral: Object.keys(result.usersWithLsuCollateral)
            .length,
          totalLsuAmount: result.totalLsuAmount,
        },
      };
    } catch (error) {
      this.logger.error(
        "Error fetching LSU holders from Weft collaterals:",
        error,
      );
      throw new HttpException(
        (error as Error).message ||
          "Failed to fetch LSU holders from Weft collaterals",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch Node LSU holders
   * Returns users with Node LSU resource amounts and total amount
   */
  @Get("node-lsu-holders")
  async getNodeLsuHolders() {
    try {
      this.logger.log("Fetching Node LSU holders...");

      const result = await this.lsuHolderService.getNodeLSUholder();

      return {
        success: true,
        message: "Node LSU holders retrieved successfully",
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          totalHolders: Object.keys(result.usersWithResourceAmount).length,
          totalAmount: result.totalAmount,
        },
      };
    } catch (error) {
      this.logger.error("Error fetching Node LSU holders:", error);
      throw new HttpException(
        (error as Error).message || "Failed to fetch Node LSU holders",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch total LSU holders with combined amounts
   * Merges both Node LSU holders and Weft Collateral holders
   */
  @Get("total-lsu-holders")
  async getTotalLsuHolders() {
    try {
      this.logger.log("Fetching total LSU holders with merged amounts...");

      const result =
        await this.lsuHolderService.getTotalLSUsHoldersWithAmount();

      return {
        success: true,
        message: "Total LSU holders with amounts retrieved successfully",
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          totalHolders: Object.keys(result.totalLsuHolderWithAmount).length,
          totalLsuAmount: result.totalLsuAmount,
        },
      };
    } catch (error) {
      this.logger.error("Error fetching total LSU holders:", error);
      throw new HttpException(
        (error as Error).message || "Failed to fetch total LSU holders",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
