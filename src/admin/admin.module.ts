import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { ProtocolsMetadataModule } from "./protocols-metadata/protocols-metadata.module";
import { ProtocolsPercentageModule } from "./protocols-percentage/protocols-percentage.module";

@Module({
  imports: [ProtocolsMetadataModule, ProtocolsPercentageModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
