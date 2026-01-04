import {
  MorpherPriceData,
  OracleRequestMessage,
} from "@/interfaces/types.interface";
import { typescriptWallet } from "@/wallet/config";
import {
  getPublicKey_BLS12_381,
  hexToUint8Array,
} from "@/wallet/helpers/noble-curves";
import { bytesToHex } from "@noble/curves/utils.js";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { MORPHER_ORACLE_BACKEND_URL } from "@/constants/endpoints";
import { MORPHER_ORACLE_NFT_ID } from "@/constants/address";

// Helper function to convert message to string format for signing
function morpherRequestMsgToString(msg: OracleRequestMessage): string {
  return `${msg.marketId}##${msg.publicKeyBLS}##${msg.nftId}`;
}

// Use custom DST for BLS signatures
const htfEthereum = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

// Generate morpher oracle message with signature
export const generateMorpherOracleMessage = (
  marketId: string,
  nftId: string,
  privateKey?: string
) => {
  const pvtKey = typescriptWallet.getWalletKeys().value.privateKey;
  let publicKeyBLS: string = getPublicKey_BLS12_381(
    privateKey ? privateKey : pvtKey
  );

  // Create the request message
  let oracleRequest = {
    marketId,
    publicKeyBLS,
    nftId,
    signature: "",
  };

  const msgString = morpherRequestMsgToString(oracleRequest);
  const msg = new TextEncoder().encode(msgString);
  const msgHash = bls12_381.longSignatures.hash(msg, htfEthereum);
  const signature = bls12_381.longSignatures.sign(
    msgHash,
    hexToUint8Array(privateKey ? privateKey : pvtKey)
  );
  oracleRequest.signature = bytesToHex(signature.toBytes());

  return {
    oracleRequest,
    msgHash: bytesToHex(msgHash.toBytes()),
    signature: oracleRequest.signature,
  };
};

// Fetch price data using the signed oracle message
export const fetchPriceDataFromOracle = async (
  oracleRequestMsg: OracleRequestMessage
) => {
  const oracleUrl = `${MORPHER_ORACLE_BACKEND_URL}/v2/price/${oracleRequestMsg.marketId}/${oracleRequestMsg.publicKeyBLS}/${oracleRequestMsg.nftId}/${oracleRequestMsg.signature}`;

  const response = await fetch(oracleUrl);

  if (!response.ok) {
    throw new Error(
      `Oracle API error: ${JSON.stringify(await response.json())}`
    );
  }

  const priceData = (await response.json()) as MorpherPriceData;
  return priceData;
};

export const getPriceDataFromMorpherOracle = async (
  marketId: string,
  privateKey?: string
) => {
  const oracleRequest = generateMorpherOracleMessage(
    marketId,
    MORPHER_ORACLE_NFT_ID,
    privateKey
  );
  return await fetchPriceDataFromOracle(oracleRequest.oracleRequest);
};

export function priceMsgToMorpherString(msg: MorpherPriceData): string {
  return msg.data
    .map(
      (el) =>
        el.marketId + "-" + el.price + "-" + el.nonce + "-" + el.dataTimestamp
    )
    .join(",");
}
