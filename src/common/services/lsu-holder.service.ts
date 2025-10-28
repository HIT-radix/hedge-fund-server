import { Injectable, Logger } from "@nestjs/common";
import { GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";
import Decimal from "decimal.js";
import { RADIX_CONFIG } from "@/config/radix.config";
import {
  DAPP_DEFINITION_ADDRESS,
  HIT_FOMO_NODE_LSU_ADDRESS,
} from "@/constants/address";

@Injectable()
export class LsuHolderService {
  private readonly logger = new Logger(LsuHolderService.name);
  private readonly gatewayApi: GatewayApiClient;

  constructor() {
    this.gatewayApi = GatewayApiClient.initialize({
      networkId: RADIX_CONFIG.NETWORK_ID,
      applicationName: RADIX_CONFIG.APPLICATION_NAME,
      applicationVersion: RADIX_CONFIG.APPLICATION_VERSION,
      applicationDappDefinitionAddress: DAPP_DEFINITION_ADDRESS,
    });
  }

  async getNodeLSUholder(): Promise<{
    usersWithResourceAmount: Record<string, string>;
    totalAmount: string;
  }> {
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

        for (const item of response.items) {
          if (
            item.type === "FungibleResource" &&
            item.holder_address.startsWith("account")
          ) {
            holders[item.holder_address] = item.amount;
            totalAmount = new Decimal(totalAmount).add(item.amount).toString();
          }
        }

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
}
