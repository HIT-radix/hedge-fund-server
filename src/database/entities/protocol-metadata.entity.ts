import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("protocols")
export class Protocol {
  @PrimaryColumn({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 100 })
  platform_name: string;

  @Column({ type: "varchar", length: 255 })
  logo_image: string;

  @Column({ type: "varchar", length: 80 })
  account: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  apyid: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  description: string | null;
}
