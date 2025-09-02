export interface LedgerStateVersion {
  epoch: number;
  network: string;
  proposer_round_timestamp: string;
  round: number;
  state_version: number;
}

export interface NFTHoldersList {
  ledger_state: LedgerStateVersion;
  nft_holders: Record<string, string>;
}

export interface EventEmitter {
  entity?: {
    entity_address?: string;
  };
}

export type OracleRequestMessage = {
  marketId: string;
  publicKeyBLS: string;
  nftId: string;
  signature: string;
};

export type MorpherPriceData = {
  data: {
    version: number;
    marketId: string;
    price: string;
    nonce: string;
    dataTimestamp: number;
    oracleTimestamp: number;
    marketStatusTimestamp: number;
    marketStatus: string;
  }[];
  signature: string;
};
