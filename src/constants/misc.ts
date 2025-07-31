import { RadixNetwork } from "@radixdlt/radix-dapp-toolkit";
import * as dotenv from "dotenv";
dotenv.config();

export const networkId =
  process.env.ENVIRONMENT === "dev"
    ? RadixNetwork.Stokenet
    : RadixNetwork.Mainnet;
