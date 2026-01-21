import { Module } from "@nestjs/common";
import { CommonController } from "./common.controller";
import { LsuHolderService } from "./services/lsu-holder.service";

@Module({
  controllers: [CommonController],
  providers: [LsuHolderService],
  exports: [LsuHolderService],
})
export class CommonModule {}
