import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from "@nestjs/common";
import { AdminService } from "./admin.service";

interface ProtocolPercentagePayload {
  protocol: string;
  percentage: number;
}

interface SetProtocolsPercentagesBody {
  secret: string;
  percentages: ProtocolPercentagePayload[];
}

@Controller("admin")
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  @Post("set-protocols-percentages")
  async setProtocolsPercentages(@Body() body: SetProtocolsPercentagesBody) {
    try {
      if (!body?.secret) {
        throw new HttpException("Secret is required", HttpStatus.BAD_REQUEST);
      }

      const adminSecret = process.env.ADMIN_SECRET;

      if (!adminSecret) {
        throw new HttpException(
          "Admin secret is not configured",
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      if (body.secret !== adminSecret) {
        throw new HttpException("Invalid secret", HttpStatus.UNAUTHORIZED);
      }

      if (!Array.isArray(body?.percentages) || body.percentages.length === 0) {
        throw new HttpException(
          "Percentages must be a non-empty array",
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.adminService.setProtocolsPercentages(
        body.percentages
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        "Failed to set protocol percentages",
        (error as Error).stack
      );

      throw new HttpException(
        (error as Error).message || "Failed to set protocol percentages",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("get-protocols-percentages")
  async getProtocolsPercentages() {
    try {
      const data = await this.adminService.getProtocolsPercentages();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        "Failed to fetch protocol percentages",
        (error as Error).stack
      );

      throw new HttpException(
        (error as Error).message || "Failed to fetch protocol percentages",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
