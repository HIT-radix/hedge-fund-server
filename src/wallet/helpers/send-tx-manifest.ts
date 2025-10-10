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
          // Poll for finality. If it fails (CommittedFailure/Rejected), attach txId to the error
          typescriptWallet.gatewayClient
            .pollTransactionStatus(txId)
            .map(() => txId)
            .mapErr((error: unknown) => {
              // Ensure we always propagate the txId when we have one
              if (error && typeof error === "object") {
                return { ...(error as object), txId } as unknown as Error;
              }
              const err: any = new Error(
                (error as any)?.message || "Transaction failed"
              );
              err.txId = txId;
              return err as Error;
            })
        );
    });
};
