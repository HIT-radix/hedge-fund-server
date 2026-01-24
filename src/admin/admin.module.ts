import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProtocolPercentage } from "@/database/entities/protocol-percentage.entity";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { ProtocolsMetadataModule } from "./protocols-metadata/protocols-metadata.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ProtocolPercentage]),
    ProtocolsMetadataModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
