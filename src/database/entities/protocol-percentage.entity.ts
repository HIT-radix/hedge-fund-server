import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("protocol_percentages")
export class ProtocolPercentage {
  @PrimaryColumn({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "int", unsigned: true })
  percentage: number;
}
