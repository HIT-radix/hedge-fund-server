import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProtocolPercentage } from "@/database/entities/protocol-percentage.entity";
import { ProtocolsPercentageController } from "./protocols-percentage.controller";
import { ProtocolsPercentageService } from "./protocols-percentage.service";

@Module({
  imports: [TypeOrmModule.forFeature([ProtocolPercentage])],
  controllers: [ProtocolsPercentageController],
  providers: [ProtocolsPercentageService],
})
export class ProtocolsPercentageModule {}
