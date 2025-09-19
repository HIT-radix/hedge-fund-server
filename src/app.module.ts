import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { SnapshotsModule } from "./snapshots/snapshots.module";

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: "mysql",
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
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
    }),
    SnapshotsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
