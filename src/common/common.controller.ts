import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { LsuHolderService } from "./services/lsu-holder.service";
import { getPriceDataFromMorpherOracle } from "@/utils/oracle";
import {
  fetchHedgeFundProtocolsList,
  getHedgeFundDetail,
} from "@/utils/helpers";
import { fetchValidatorInfo } from "radix-utils";
import {
  DAPP_DEFINITION_ADDRESS,
  VALIDATOR_ADDRESS,
} from "@/constants/address";
import { GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";
import { RADIX_CONFIG } from "@/config/radix.config";

@Controller("common")
export class CommonController {
  private readonly logger = new Logger(CommonController.name);
  private readonly gatewayApi: GatewayApiClient;

  constructor(private readonly lsuHolderService: LsuHolderService) {
    this.gatewayApi = GatewayApiClient.initialize({
      networkId: RADIX_CONFIG.NETWORK_ID,
      applicationName: RADIX_CONFIG.APPLICATION_NAME,
      applicationVersion: RADIX_CONFIG.APPLICATION_VERSION,
      applicationDappDefinitionAddress: DAPP_DEFINITION_ADDRESS,
    });
  }

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

  @Get("test-oracle-price")
  async testOraclePrice() {
    try {
      // Use default values if not provided
      const testMarketId = "GATEIO:XRD_USDT";

      this.logger.log(`Testing oracle price data for market: ${testMarketId}`);

      const priceData = await getPriceDataFromMorpherOracle(testMarketId);

      return priceData;
    } catch (error) {
      this.logger.error("Error testing oracle price data:", error);
      throw new HttpException(
        (error as Error).message || "Failed to retrieve oracle price data",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("fetch-node-info")
  async testFetchValidatorInfo() {
    try {
      const validatorInfo = await fetchValidatorInfo(
        this.gatewayApi,
        VALIDATOR_ADDRESS,
      );

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
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("hedge-fund-protocols")
  async getHedgeFundProtocols() {
    try {
      this.logger.log("Fetching hedge fund protocols list...");

      const protocols = await fetchHedgeFundProtocolsList(this.gatewayApi);

      return {
        success: true,
        message: "Hedge fund protocols retrieved successfully",
        data: protocols,
        meta: {
          timestamp: new Date().toISOString(),
          totalProtocols: protocols?.length ?? 0,
        },
      };
    } catch (error) {
      this.logger.error("Error fetching hedge fund protocols list:", error);
      throw new HttpException(
        (error as Error).message || "Failed to retrieve hedge fund protocols",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("hedge-fund-protocols-details")
  async getHedgeFundProtocolsDetails() {
    try {
      this.logger.log("Fetching hedge fund protocols details...");

      const protocols = await getHedgeFundDetail(this.gatewayApi);

      return {
        success: true,
        message: "Hedge fund protocols details retrieved successfully",
        data: protocols,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error("Error fetching hedge fund protocols details:", error);
      throw new HttpException(
        (error as Error).message ||
          "Failed to retrieve hedge fund protocols details",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
