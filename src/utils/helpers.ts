import {
  GatewayApiClient,
  LedgerStateSelector,
} from "@radixdlt/babylon-gateway-api-sdk";
import { Decimal } from "decimal.js";
import { sendTransactionManifest } from "@/wallet/helpers";
import { generateRandomNonce } from "@radixdlt/radix-engine-toolkit";
import { getFundUnitValueManifest } from "./manifests";

// Configure Decimal for our use case
Decimal.config({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export const BN = (value: string | number) => new Decimal(value);

const retryPromiseAll = async (
  promises: Promise<any>[],
  retries = 3,
  delay = 1000,
) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await Promise.all(promises);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, i)),
      );
    }
  }
};

export const checkResourceInUsersFungibleAssets = async (
  usersAddresses: string[],
  fungible_resource_to_check: string,
  gatewayApi: GatewayApiClient,
  ledgerState?: LedgerStateSelector,
) => {
  try {
    const allPromises = usersAddresses.map((address) =>
      gatewayApi.state.innerClient.entityFungibleResourceVaultPage({
        stateEntityFungibleResourceVaultsPageRequest: {
          address,
          resource_address: fungible_resource_to_check,
          at_ledger_state: ledgerState,
        },
      }),
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
  lockFee: number = 10,
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
  lockFee: number = 10,
): Promise<{
  success: boolean;
  txId?: string;
  error?: string;
}> => {
  try {
    const result = await sendTransactionManifest(manifest, lockFee).match(
      (txId) => ({ success: true, txId }),
      (error) => {
        const e = error as any;
        // Try to surface txId if available (attached earlier in sendTransactionManifest)
        const txId = e?.txId || e?.txid;
        return {
          success: false,
          error: (e as Error).message || "Failed to send transaction",
          txId,
        } as { success: false; error: string; txId?: string };
      },
    );
    return result;
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || "Failed to send transaction",
      txId: (error as any)?.txId || (error as any)?.txid,
    };
  }
};

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export const simulateTx = async (
  manifest: string,
  gatewayApi: GatewayApiClient,
) => {
  const latestLedgerState =
    await gatewayApi.transaction.innerClient.transactionConstruction();

  const nonce = generateRandomNonce();

  const preview = await gatewayApi.transaction.innerClient.transactionPreview({
    transactionPreviewRequest: {
      manifest,
      nonce,
      tip_percentage: 0,
      flags: {
        use_free_credit: true,
        assume_all_signature_proofs: true,
        skip_epoch_check: true,
      },
      start_epoch_inclusive: latestLedgerState.ledger_state.epoch,
      end_epoch_exclusive: latestLedgerState.ledger_state.epoch + 1,
      signer_public_keys: [],
    },
  });
  return preview;
};

export const getFundUnitValue = async (
  gatewayApi: GatewayApiClient,
): Promise<{ net_value: string; gross_value: string } | undefined> => {
  try {
    const txResult = await simulateTx(getFundUnitValueManifest(), gatewayApi);
    const receipt = txResult.receipt as {
      output: {
        programmatic_json: { fields: { kind: string; value: string }[] };
      }[];
    };
    const net_value = receipt?.output[0]?.programmatic_json?.fields?.[0]?.value;
    const gross_value =
      receipt?.output[0]?.programmatic_json?.fields?.[1]?.value;
    if (!net_value || !gross_value) {
      return undefined;
    }
    return { net_value, gross_value };
  } catch (error) {
    console.log("Unable to get fund unit value");
    return undefined;
  }
};

export const fetchHedgeFundProtocolsList = async (
  gatewayApi: GatewayApiClient,
) => {
  try {
    const result = await gatewayApi.state.getEntityDetailsVaultAggregated(
      FUND_MANAGER_COMPONENT,
    );
    if (result.details.type === "Component") {
      const componentState = result.details.state as {
        fields: {
          kind: string;
          field_name: string;
          elements: { kind: string; value: string }[];
        }[];
      };
      const protocols = componentState.fields.find(
        (f) => f.field_name === "defi_protocols_list",
      );
      if (protocols?.elements?.length > 0) {
        return protocols.elements.map((el) => el.value);
      }
    }
  } catch (error) {
    return [];
  }
};
