import "dotenv/config"; // Ensure env vars (including DISABLE_DB) are loaded before evaluation
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { SnapshotsModule } from "./snapshots/snapshots.module";
import { AdminModule } from "./admin/admin.module";
import { CommonModule } from "./common/common.module";

// Only disable to test non-database features
const dbEnabled = true;

const dbImports = dbEnabled
  ? [
      TypeOrmModule.forRoot({
        type: "mysql",
        host: process.env.DB_HOST,
        port: process.env.DB_PORT
          ? parseInt(process.env.DB_PORT, 10)
          : undefined,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        autoLoadEntities: true,
        synchronize: true, // Don't use in production
        // Connection pool options
        connectTimeout: 30000,
        extra: {
          // MySQL specific connection options
          connectionLimit: 20, // Increase from default 10
          acquireTimeout: 30000, // 30 seconds timeout
          waitForConnections: true,
          queueLimit: 0, // Unlimited queue
        },
        retryAttempts: 5, // Retry connection 5 times
        retryDelay: 3000, // 3 seconds between retries
        timezone: "Z",
      }),
    ]
  : [];

const dbFeatureModules = dbEnabled ? [SnapshotsModule, AdminModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    ...dbImports,
    CommonModule,
    ...dbFeatureModules,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
