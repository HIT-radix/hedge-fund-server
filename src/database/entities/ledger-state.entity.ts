import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity("ledger_states")
export class LedgerState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "bigint" })
  epoch: number;

  @Column({ type: "varchar", length: 50 })
  network: string;

  @Column({ type: "varchar", length: 255 })
  proposer_round_timestamp: string;

  @Column({ type: "bigint" })
  round: number;

  @Column({ type: "bigint", unique: true })
  state_version: number;

  @CreateDateColumn()
  created_at: Date;
}
