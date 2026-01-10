import { Injectable, Logger } from "@nestjs/common";
import { GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";
import Decimal from "decimal.js";
import { RADIX_CONFIG } from "@/config/radix.config";
import {
  DAPP_DEFINITION_ADDRESS,
  HIT_FOMO_NODE_LSU_ADDRESS,
  WEFT_COLLATERAL_NFT_RESOURCE_ADDRESS,
} from "@/constants/address";
import { chunkArray } from "@/utils/helpers";

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

  fetchLSUsHoldersFromWeftCollaterals = async () => {
    try {
      const res = await this.gatewayApi.state.getEntityDetailsVaultAggregated(
        WEFT_COLLATERAL_NFT_RESOURCE_ADDRESS
      );

      const total_minted =
        res.details.type === "NonFungibleResource" && res.details.total_minted;

      const mintedCount = total_minted ? Number(total_minted) : 0;

      if (!Number.isFinite(mintedCount) || mintedCount <= 0) {
        throw new Error("Unable to fetch total minted LSUs of weft");
      }

      const nftIds = Array.from(
        { length: mintedCount },
        (_, index) => `#${index + 1}#`
      );

      const nftIdChunks = chunkArray<string>(nftIds, 100);

      const nftDataResponses = await Promise.all(
        nftIdChunks.map((chunk) =>
          this.gatewayApi.state.getNonFungibleData(
            WEFT_COLLATERAL_NFT_RESOURCE_ADDRESS,
            chunk
          )
        )
      );

      const nftsData = nftDataResponses.flat();

      const nftIdsWithLsuCollateral: Record<string, string> = {};

      nftsData.forEach((nft) => {
        if (!nft.is_burned && nft.data.programmatic_json.kind === "Tuple") {
          const fields = nft.data.programmatic_json.fields;
          fields.forEach((field) => {
            if (field.kind === "Map" && field.field_name === "collaterals") {
              const collaterals = field.entries;
              collaterals.forEach((collateral) => {
                if (
                  collateral.key.kind === "Reference" &&
                  collateral.key.value === HIT_FOMO_NODE_LSU_ADDRESS &&
                  collateral.value.kind === "Tuple"
                ) {
                  const collateralFields = collateral.value.fields;
                  collateralFields.forEach((collateralField) => {
                    if (
                      collateralField.kind === "Decimal" &&
                      collateralField.field_name === "amount"
                    ) {
                      nftIdsWithLsuCollateral[nft.non_fungible_id] =
                        collateralField.value;
                    }
                  });
                }
              });
            }
          });
        }
      });

      const relevantNftIds = Object.keys(nftIdsWithLsuCollateral);

      if (relevantNftIds.length === 0) {
        return { usersWithLsuCollateral: {}, totalLsuAmount: "0" };
      }

      const locationChunks = chunkArray<string>(relevantNftIds, 100);

      const nonFungibleLocationResponses = await Promise.all(
        locationChunks.map((chunk) =>
          this.gatewayApi.state.getNonFungibleLocation(
            WEFT_COLLATERAL_NFT_RESOURCE_ADDRESS,
            chunk
          )
        )
      );

      const nonFungibleLocations = nonFungibleLocationResponses.flat();

      const usersWithLsuCollateral: Record<string, string> = {};
      let totalLsuAmount = new Decimal(0);

      nonFungibleLocations.forEach((nftLocation) => {
        if (nftLocation.owning_vault_global_ancestor_address) {
          usersWithLsuCollateral[
            nftLocation.owning_vault_global_ancestor_address
          ] = nftIdsWithLsuCollateral[nftLocation.non_fungible_id];
          totalLsuAmount = totalLsuAmount.plus(
            nftIdsWithLsuCollateral[nftLocation.non_fungible_id]
          );
        }
      });

      return {
        usersWithLsuCollateral,
        totalLsuAmount: totalLsuAmount.toString(),
      };
    } catch (error) {
      console.error("Error in fetchLSUsHoldersFromWeftCollaterals:", error);
      throw error;
    }
  };

  async getTotalLSUsHoldersWithAmount() {
    const { usersWithResourceAmount } = await this.getNodeLSUholder();

    const { usersWithLsuCollateral } =
      await this.fetchLSUsHoldersFromWeftCollaterals();

    const mergedUsersWithAmount: Record<string, string> = {};

    Object.entries(usersWithResourceAmount ?? {}).forEach(
      ([address, amount]) => {
        if (!amount) return;
        if (new Decimal(amount).greaterThan(1)) {
          mergedUsersWithAmount[address] = amount;
        }
      }
    );

    Object.entries(usersWithLsuCollateral ?? {}).forEach(
      ([address, amount]) => {
        if (!amount) return;
        const currentAmount = mergedUsersWithAmount[address]
          ? new Decimal(mergedUsersWithAmount[address])
          : new Decimal(0);

        const updatedAmount = currentAmount.plus(amount);

        if (updatedAmount.greaterThan(1)) {
          mergedUsersWithAmount[address] = updatedAmount.toString();
        }
      }
    );

    const totalMergedAmount = Object.values(mergedUsersWithAmount).reduce(
      (acc, amount) => acc.plus(amount),
      new Decimal(0)
    );

    return {
      totalLsuHolderWithAmount: mergedUsersWithAmount,
      totalLsuAmount: totalMergedAmount.toString(),
    };
  }
}
