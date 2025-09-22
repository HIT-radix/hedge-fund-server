import { typescriptWallet } from "../config";
import { logger } from "./logger";

export const sendTransactionManifest = (txManifest: string, lock_fee = 100) => {
  return typescriptWallet
    .getManifestBuilder()
    .andThen(({ wellKnownAddresses, convertStringManifest }) => {
      // logger.debug(txManifest);
      return convertStringManifest(`
          CALL_METHOD
              Address("${wellKnownAddresses.accountAddress}")
              "lock_fee"
              Decimal("${lock_fee}")
          ;
          
          ${txManifest}
    `)
        .andThen(typescriptWallet.submitTransaction)
        .andThen(({ txId }) =>
          typescriptWallet.gatewayClient
            .pollTransactionStatus(txId)
            .map(() => txId)
        );
    });
};
