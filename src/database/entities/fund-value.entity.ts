import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("fund_value")
export class FundValue {
  @PrimaryColumn({ type: "datetime" })
  time: Date;

  @Column({ type: "decimal", precision: 48, scale: 30 })
  value: string;
}
