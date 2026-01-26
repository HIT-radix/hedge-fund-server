import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Query,
} from "@nestjs/common";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  @Get("wallet-info")
  async getWalletInfo(@Query("secret") secret?: string) {
    try {
      if (!secret) {
        throw new HttpException("Secret is required", HttpStatus.BAD_REQUEST);
      }

      const adminSecret = process.env.ADMIN_SECRET;

      if (!adminSecret) {
        throw new HttpException(
          "Admin secret is not configured",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (secret !== adminSecret) {
        throw new HttpException("Invalid secret", HttpStatus.UNAUTHORIZED);
      }

      const data = await this.adminService.getWalletInfo();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error("Failed to fetch wallet info", (error as Error).stack);

      throw new HttpException(
        (error as Error).message || "Failed to fetch wallet info",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
