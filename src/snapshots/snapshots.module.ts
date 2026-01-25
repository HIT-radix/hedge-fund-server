import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SnapshotsController } from "./snapshots.controller";
import { SnapshotsService } from "./snapshots.service";
import { NftHolder } from "@/database/entities/nft-holder.entity";
import { LedgerState } from "@/database/entities/ledger-state.entity";
import { Snapshot } from "@/database/entities/snapshot.entity";
import { SnapshotAccount } from "@/database/entities/snapshot-account.entity";
import { FuValue } from "@/database/entities/fund-unit-value.entity";
import { FundValue } from "@/database/entities/fund-value.entity";
import { LsuHolderService } from "@/common/services/lsu-holder.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NftHolder,
      LedgerState,
      Snapshot,
      SnapshotAccount,
      FuValue,
      FundValue,
    ]),
  ],
  controllers: [SnapshotsController],
  providers: [SnapshotsService, LsuHolderService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
