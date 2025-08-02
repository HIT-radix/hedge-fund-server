import { Entity, Column, PrimaryColumn, OneToMany } from "typeorm";

export enum SnapshotState {
  UNLOCK_STARTED = "unlock_started",
  UNSTAKE_STARTED = "unstake_started",
  UNSTAKED = "unstaked",
  DISTRIBUTED = "distributed",
}

@Entity("snapshots")
export class Snapshot {
  @PrimaryColumn({ type: "datetime" })
  date: Date;

  @Column({
    type: "enum",
    enum: SnapshotState,
    default: SnapshotState.UNLOCK_STARTED,
  })
  state: SnapshotState;

  @Column({ type: "varchar", length: 100, nullable: true })
  claim_nft_id: string | null;

  @OneToMany(
    "SnapshotAccount",
    (snapshotAccount: any) => snapshotAccount.snapshot
  )
  accounts: any[];
}
