import {
  generateMorpherOracleMessage,
  fetchPriceDataFromOracle,
} from "@/utils/oracle";
import { typescriptWallet } from "@/wallet/config";
import { MORPHER_ORACLE_NFT_ID } from "@/constants/address";

// Integration test against the Morpher oracle backend. Requires network and .env vars.
jest.setTimeout(30000);

describe("fetchPriceDataFromOracle", () => {
  const MARKET_ID = "GATEIO:XRD_USDT";

  it("returns valid price data for the Morpher oracle", async () => {
    if (!process.env.MNEMONIC || !process.env.NETWORK_NAME) {
      throw new Error(
        "MNEMONIC and NETWORK_NAME env vars must be set for this test"
      );
    }

    // Use wallet private key from env-backed Typescript Wallet
    const privateKey = typescriptWallet.getWalletKeys().value.privateKey;

    console.log("privateKey:", privateKey);
    console.log("MORPHER_ORACLE_NFT_ID:", MORPHER_ORACLE_NFT_ID);

    const { oracleRequest } = generateMorpherOracleMessage(
      MARKET_ID,
      MORPHER_ORACLE_NFT_ID,
      privateKey
    );

    const priceData = await fetchPriceDataFromOracle(oracleRequest);

    expect(priceData).toBeDefined();
    expect(Array.isArray(priceData.data)).toBe(true);
    expect(priceData.data.length).toBeGreaterThan(0);
    expect(priceData.signature).toBeTruthy();

    const firstEntry = priceData.data[0];
    expect(firstEntry.marketId).toBe(MARKET_ID);
    expect(Number.parseFloat(firstEntry.price)).not.toBeNaN();
    expect(firstEntry.dataTimestamp).toBeGreaterThan(0);
  });
});
