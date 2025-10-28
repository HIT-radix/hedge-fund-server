import {
  ACCOUNT_LOCKER_ADDRESS,
  FUND_BOT_BADGE,
  FUND_MANAGER_COMPONENT,
} from "@/constants/address";
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
      NonFungibleLocalId("${claimNftId}")
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

export const get_fund_units_distribution_manifest = async (
  distributions: { address: string; amount: string }[],
  moreLeft: boolean
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
      "fund_units_distribution"
      Map<Address, Decimal>(
          ${distributions
            .map(
              (dist) =>
                `Address("${dist.address}") => Decimal("${dist.amount}")`
            )
            .join(", ")}
      )
      ${moreLeft}  
    ;`;
};

export const get_buyback_airdrop_manifest = async (
  tokenAddress: string,
  airdropData: { address: string; amount: string }[]
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
    TAKE_ALL_FROM_WORKTOP
        Address("${tokenAddress}")
        Bucket("bucket1")
    ;
    CALL_METHOD
        Address("${ACCOUNT_LOCKER_ADDRESS}")
        "airdrop"
        Map<Address, Enum>(
            ${airdropData
              .map(
                (item) => `Address("${item.address}") => Enum<0u8>(
                Decimal("${item.amount}")
            )`
              )
              .join(",\n            ")}
        )
        Bucket("bucket1")
        true
    ;
    CALL_METHOD
        Address("${accountAddress}")
        "try_deposit_batch_or_abort"
        Expression("ENTIRE_WORKTOP")
        Enum<0u8>()
    ;
  `;
};
