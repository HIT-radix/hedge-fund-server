import { FUND_BOT_BADGE, FUND_MANAGER_COMPONENT } from "@/constants/address";
import { typescriptWallet } from "@/wallet/config";

export const get_start_unlock_owner_stake_units_manifest = async (
  amount: string
) => {
  const addressResult = await typescriptWallet.getAccountAddress();

  if (addressResult.isErr()) {
    throw new Error(`Failed to get account address: ${addressResult.error}`);
  }

  const accountAddress = addressResult.value;

  return `
    CALL_METHOD
        Address("${accountAddress}")
        "create_proof_of_amount"
        Address("${FUND_BOT_BADGE}")
        Decimal("1")
    ;
    CALL_METHOD
        Address("${FUND_MANAGER_COMPONENT}")
        "start_unlock_owner_stake_units"
        Decimal("${amount}")
    ;`;
};

export const get_start_unstake_manifest = async () => {
  const addressResult = await typescriptWallet.getAccountAddress();

  if (addressResult.isErr()) {
    throw new Error(`Failed to get account address: ${addressResult.error}`);
  }

  const accountAddress = addressResult.value;

  return `
    CALL_METHOD
      Address("${accountAddress}")
      "create_proof_of_amount"
      Address("${FUND_BOT_BADGE}")
      Decimal("1")
    ;
    CALL_METHOD
      Address("${FUND_MANAGER_COMPONENT}")
      "start_unstake"
    ;`;
};

export const get_finish_unstake_manifest = async (
  claimNftId: string,
  morpherData: { coinAddress: string; message: string; signature: string }[]
) => {
  const addressResult = await typescriptWallet.getAccountAddress();

  if (addressResult.isErr()) {
    throw new Error(`Failed to get account address: ${addressResult.error}`);
  }

  const accountAddress = addressResult.value;

  return `
    CALL_METHOD
      Address("${accountAddress}")
      "create_proof_of_amount"
      Address("${FUND_BOT_BADGE}")
      Decimal("1")
    ;
    CALL_METHOD
      Address("${FUND_MANAGER_COMPONENT}")
      "finish_unstake"
      "${claimNftId}"
      Map<Address, Tuple>(
          ${morpherData
            .map(
              (item) =>
                `Address("${item.coinAddress}") => Tuple("${item.message}", "${item.signature}")`
            )
            .join(", ")}
      )
    ;`;
};
