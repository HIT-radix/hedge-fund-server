import {
  GatewayApiClient,
  LedgerStateSelector,
} from "@radixdlt/babylon-gateway-api-sdk";
import { Decimal } from "decimal.js";
import { sendTransactionManifest } from "@/wallet/helpers";

// Configure Decimal for our use case
Decimal.config({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export const BN = (value: string | number) => new Decimal(value);

const retryPromiseAll = async (
  promises: Promise<any>[],
  retries = 3,
  delay = 1000
) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await Promise.all(promises);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, i))
      );
    }
  }
};

export const checkResourceInUsersFungibleAssets = async (
  usersAddresses: string[],
  fungible_resource_to_check: string,
  gatewayApi: GatewayApiClient,
  ledgerState?: LedgerStateSelector
) => {
  try {
    const allPromises = usersAddresses.map((address) =>
      gatewayApi.state.innerClient.entityFungibleResourceVaultPage({
        stateEntityFungibleResourceVaultsPageRequest: {
          address,
          resource_address: fungible_resource_to_check,
          at_ledger_state: ledgerState,
        },
      })
    );

    const allResponses = (await retryPromiseAll(allPromises)).flat();
    let totalAmount = BN(0);
    const usersWithResourceAmount: Record<string, string> = {};
    allResponses.forEach((res) => {
      res.items.forEach((vault) => {
        if (BN(vault.amount).greaterThan(0)) {
          usersWithResourceAmount[res.address] = vault.amount;
          totalAmount = totalAmount.plus(vault.amount);
        }
      });
    });

    return { usersWithResourceAmount, totalAmount: totalAmount.toString() };
  } catch (error) {
    console.log("Error in checkResourceInUsersFungibleAssets", error);
    throw error;
  }
};

/**
 * Execute a transaction manifest and return a standardized result
 * @param manifest The transaction manifest string
 * @param lockFee The lock fee for the transaction (default: 10)
 * @returns Promise with standardized success/error result
 */
export const executeTransactionManifest = async (
  manifest: string,
  lockFee: number = 10
): Promise<{ success: boolean; txId?: string; error?: string }> => {
  // First attempt
  const first = await attemptToSendTxOnChain(manifest, lockFee);
  if (first.success) return first;

  // Retry once after a short backoff
  await new Promise((r) => setTimeout(r, 500));
  const second = await attemptToSendTxOnChain(manifest, lockFee);
  return second;
};

const attemptToSendTxOnChain = async (
  manifest: string,
  lockFee: number = 10
): Promise<{
  success: boolean;
  txId?: string;
  error?: string;
}> => {
  try {
    const result = await sendTransactionManifest(manifest, lockFee).match(
      (txId) => ({ success: true, txId }),
      (error) => ({
        success: false,
        error: (error as Error).message || "Failed to send transaction",
      })
    );
    return result;
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || "Failed to send transaction",
    };
  }
};
