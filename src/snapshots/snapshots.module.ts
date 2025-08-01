import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SnapshotsController } from "./snapshots.controller";
import { SnapshotsService } from "./snapshots.service";
import { NftHolder } from "../database/entities/nft-holder.entity";
import { LedgerState } from "../database/entities/ledger-state.entity";

@Module({
  imports: [TypeOrmModule.forFeature([NftHolder, LedgerState])],
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
})
export class SnapshotsModule {}
