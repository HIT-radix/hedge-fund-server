import { Module } from "@nestjs/common";
import { ProtocolsMetadataModule } from "@/admin/protocols-metadata/protocols-metadata.module";
import { ProtocolsMetadataService } from "@/admin/protocols-metadata/protocols-metadata.service";
import { CommonController } from "./common.controller";
import { LsuHolderService } from "./services/lsu-holder.service";

const dbEnabled = process.env.ENABLE_DB === "true";

@Module({
  imports: dbEnabled ? [ProtocolsMetadataModule] : [],
  controllers: [CommonController],
  providers: [
    LsuHolderService,
    ...(dbEnabled
      ? []
      : [
          {
            provide: ProtocolsMetadataService,
            useValue: null,
          },
        ]),
  ],
  exports: [LsuHolderService],
})
export class CommonModule {}
