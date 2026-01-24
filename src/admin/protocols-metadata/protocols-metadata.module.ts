import { Module } from "@nestjs/common";
import { ProtocolsMetadataController } from "./protocols-metadata.controller";

@Module({
  controllers: [ProtocolsMetadataController],
})
export class ProtocolsMetadataModule {}
