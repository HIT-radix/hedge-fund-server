import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("protocol_percentages")
export class ProtocolPercentage {
  @PrimaryColumn({ type: "varchar", length: 255 })
  name: string;

  @Column({
    type: "decimal",
    precision: 6,
    scale: 2,
  })
  percentage: number;
}
