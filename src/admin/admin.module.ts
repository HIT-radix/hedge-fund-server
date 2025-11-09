import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { ProtocolPercentage } from "@/database/entities/protocol-percentage.entity";

@Module({
  imports: [TypeOrmModule.forFeature([ProtocolPercentage])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
