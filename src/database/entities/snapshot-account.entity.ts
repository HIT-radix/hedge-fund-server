import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { Snapshot } from "./snapshot.entity";

@Entity("snapshot_accounts")
export class SnapshotAccount {
  @PrimaryColumn({ type: "datetime" })
  date: Date;

  @PrimaryColumn({ type: "varchar", length: 70 })
  account: string;

  @Column({ type: "varchar", length: 78, default: "0" })
  lsu_amount: string;

  @Column({ type: "boolean", default: false })
  fund_units_sent: boolean;

  @ManyToOne(() => Snapshot, (snapshot) => snapshot.accounts)
  @JoinColumn({ name: "date", referencedColumnName: "date" })
  snapshot: Snapshot;
}
