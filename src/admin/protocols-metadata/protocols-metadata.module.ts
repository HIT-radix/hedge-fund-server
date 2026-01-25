import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Protocol } from "@/database/entities/protocol-metadata.entity";
import { ProtocolsMetadataController } from "./protocols-metadata.controller";
import { ProtocolsMetadataService } from "./protocols-metadata.service";

@Module({
  imports: [TypeOrmModule.forFeature([Protocol])],
  controllers: [ProtocolsMetadataController],
  providers: [ProtocolsMetadataService],
  exports: [ProtocolsMetadataService],
})
export class ProtocolsMetadataModule {}
