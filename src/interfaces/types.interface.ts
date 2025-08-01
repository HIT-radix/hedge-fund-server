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
