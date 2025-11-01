import { Injectable, Logger } from "@nestjs/common";
import Decimal from "decimal.js";
import { get_buyback_airdrop_manifest } from "@/utils/manifests";
import { executeTransactionManifest } from "@/utils/helpers";
import { LsuHolderService } from "@/common/services/lsu-holder.service";
import { BuyBackAirdropResult } from "@/interfaces/types.interface";

@Injectable()
export class AirdropsService {
  private readonly logger = new Logger(AirdropsService.name);

  constructor(private readonly lsuHolderService: LsuHolderService) {}

  async airdropTheBuyBack(tokens: { tokenAddress: string; amount: string }[]) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new Error("Tokens payload must be a non-empty array");
    }

    const snapshotData = await this.lsuHolderService.getNodeLSUholder();

    if (!snapshotData || snapshotData.totalAmount === "0") {
      throw new Error("No LSU holder data available for airdrop");
    }

    const holders = Object.entries(snapshotData.usersWithResourceAmount);
    if (holders.length === 0) {
      throw new Error("No holder addresses found for airdrop");
    }

    const totalLsu = new Decimal(snapshotData.totalAmount);
    if (!totalLsu.greaterThan(0)) {
      throw new Error("Total LSU amount must be greater than zero");
    }

    const results: BuyBackAirdropResult = [];

    for (const token of tokens) {
      if (!token?.tokenAddress || !token?.amount) {
        throw new Error(
          "Each token entry must include tokenAddress and amount"
        );
      }

      const distributionAmount = new Decimal(token.amount);
      if (!distributionAmount.greaterThan(0)) {
        throw new Error(
          `Token amount must be greater than zero for ${token.tokenAddress}`
        );
      }

      const airdropData = holders
        .map(([address, lsuAmount]) => {
          const share = new Decimal(lsuAmount).div(totalLsu);
          const amountForAccount = distributionAmount
            .mul(share)
            .toDecimalPlaces(18, Decimal.ROUND_DOWN);

          if (amountForAccount.lessThanOrEqualTo(0)) {
            return null;
          }

          return {
            address,
            amount: amountForAccount.toFixed(18),
          };
        })
        .filter((entry): entry is { address: string; amount: string } =>
          Boolean(entry)
        );

      if (airdropData.length === 0) {
        throw new Error(
          `No eligible airdrop entries for ${token.tokenAddress}`
        );
      }

      const chunks = this.chunkArray(airdropData, 80);
      const successfulAccounts: string[] = [];
      const txIds: string[] = [];
      const failedAirdrops: { address: string; amount: string }[] = [];

      this.logger.log(
        `Airdropping ${token.amount} of ${token.tokenAddress} to ${airdropData.length} accounts across ${chunks.length} transactions`
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const manifest = await get_buyback_airdrop_manifest(
          token.tokenAddress,
          chunk
        );

        const result = await executeTransactionManifest(manifest, 10);

        if (!result.success || !result.txId) {
          const failureReason = result.error || "Unknown error";

          for (let j = i; j < chunks.length; j++) {
            failedAirdrops.push(...chunks[j]);
          }

          this.logger.error(
            `Failed to execute airdrop transaction for ${
              token.tokenAddress
            } (chunk ${i + 1}/${chunks.length}): ${failureReason}`
          );

          break;
        }

        txIds.push(result.txId);
        successfulAccounts.push(...chunk.map((entry) => entry.address));
      }

      results.push({
        tokenAddress: token.tokenAddress,
        totalAccounts: successfulAccounts.length,
        chunkCount: chunks.length,
        transactionIds: txIds,
        accounts: successfulAccounts,
        failedAirdrops,
      });
    }

    return results;
  }

  private chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
