import * as dotenv from "dotenv";
dotenv.config();

export const MORPHER_ORACLE_BACKEND_URL =
  process.env.ENVIRONMENT === "dev"
    ? "https://dev-test-radix-oracle-api.morpher.com"
    : "https://radix-oracle-api.morpher.com";
