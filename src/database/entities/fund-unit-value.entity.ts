import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("fu_value")
export class FuValue {
  @PrimaryColumn({ type: "datetime" })
  time: Date;

  @Column({
    type: "decimal",
    precision: 48,
    scale: 30,
  })
  value: string;
}
