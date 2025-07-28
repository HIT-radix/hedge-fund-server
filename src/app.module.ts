import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { SnapshotsModule } from "./snapshots/snapshots.module";

@Module({
  imports: [SnapshotsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
