import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AirdropsController } from "./airdrops.controller";
import { AirdropsService } from "./airdrops.service";
import { NftHolder } from "@/database/entities/nft-holder.entity";
import { LedgerState } from "@/database/entities/ledger-state.entity";
import { Snapshot } from "@/database/entities/snapshot.entity";
import { SnapshotAccount } from "@/database/entities/snapshot-account.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NftHolder,
      LedgerState,
      Snapshot,
      SnapshotAccount,
    ]),
  ],
  controllers: [AirdropsController],
  providers: [AirdropsService],
  exports: [AirdropsService],
})
export class AirdropsModule {}
