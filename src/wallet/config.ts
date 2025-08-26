import { RadixEngineClient } from "./clients";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.MNEMONIC) throw new Error("MNEMONIC env var not set");
if (!process.env.NETWORK_NAME) throw new Error("NETWORK_NAME env var not set");

export const radixEngineClient = RadixEngineClient({
  derivationIndex: 1,
  networkName: process.env.NETWORK_NAME!,
  mnemonic: process.env.MNEMONIC!,
});

export const config = {
  mnemonic: process.env.MNEMONIC,
  networkName: process.env.NETWORK_NAME,
  network: radixEngineClient.gatewayClient.networkConfig,
};
