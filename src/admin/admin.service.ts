import { Injectable, Logger } from "@nestjs/common";
import { typescriptWallet } from "@/wallet/config";
import { getPublicKey_BLS12_381 } from "@/wallet/helpers/noble-curves";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

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
}
