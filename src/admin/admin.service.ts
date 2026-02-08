import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { typescriptWallet } from "@/wallet/config";
import { getPublicKey_BLS12_381 } from "@/wallet/helpers/noble-curves";
import { GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";
import { RADIX_CONFIG } from "@/config/radix.config";
import {
  DAPP_DEFINITION_ADDRESS,
  HEDGE_FUND_BOT_ADDRESS,
  XRD_RESOURCE_ADDRESS,
} from "@/constants/address";
import Decimal from "decimal.js";
import { pingErrorToTg } from "@/utils/helpers";
import { checkResourceInUsersFungibleAssets } from "radix-utils";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly gatewayApi: GatewayApiClient;

  constructor() {
    this.gatewayApi = GatewayApiClient.initialize({
      networkId: RADIX_CONFIG.NETWORK_ID,
      applicationName: RADIX_CONFIG.APPLICATION_NAME,
      applicationVersion: RADIX_CONFIG.APPLICATION_VERSION,
      applicationDappDefinitionAddress: DAPP_DEFINITION_ADDRESS,
    });
  }

  async getWalletInfo(): Promise<{
    address: string;
    publicKeyBls12_381: string;
  }> {
    const addressResult = await typescriptWallet.getAccountAddress();

    if (addressResult.isErr()) {
      this.logger.error(
        `Failed to get account address: ${addressResult.error}`,
      );
      throw new Error(`Failed to get account address: ${addressResult.error}`);
    }

    const walletKeysResult = typescriptWallet.getWalletKeys();

    if (walletKeysResult.isErr()) {
      this.logger.error(`Failed to get wallet keys: ${walletKeysResult.error}`);
      throw new Error(`Failed to get wallet keys: ${walletKeysResult.error}`);
    }

    const { privateKey } = walletKeysResult.value;
    const publicKeyBls12_381 = getPublicKey_BLS12_381(privateKey);

    return { address: addressResult.value, publicKeyBls12_381 };
  }

  @Cron("0 */2 * * * *", { timeZone: "UTC" })
  async checkXRDholding() {
    try {
      this.logger.log("[CRON] Running scheduledCheckXRDholding");
      const result = await checkResourceInUsersFungibleAssets(
        [HEDGE_FUND_BOT_ADDRESS],
        XRD_RESOURCE_ADDRESS,
        this.gatewayApi,
      );
      if (new Decimal(result.totalAmount).lessThanOrEqualTo(8)) {
        await pingErrorToTg(
          `Reminder: Hedge Fund Bot's XRD balance is running low. Current Balance: ${result.totalAmount}.`,
        );
      }
    } catch (error) {
      this.logger.error("[CRON] scheduledCheckXRDholding failed:", error);
      await pingErrorToTg(
        `[CRON] scheduledCheckXRDholding failed: ${(error as Error)?.message || error}`,
      );
      throw error;
    }
  }
}
