import { RadixNetwork } from "@radixdlt/radix-dapp-toolkit";
import * as dotenv from "dotenv";
dotenv.config();

export const RADIX_CONFIG = {
  NETWORK_ID:
    process.env.ENVIRONMENT === "dev"
      ? RadixNetwork.Stokenet
      : RadixNetwork.Mainnet,
  APPLICATION_NAME: "HedgeFundServer",
  APPLICATION_VERSION: "1.0.0",
} as const;
