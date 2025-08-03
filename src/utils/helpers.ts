import {
  GatewayApiClient,
  LedgerStateSelector,
} from "@radixdlt/babylon-gateway-api-sdk";
import { Decimal } from "decimal.js";

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
