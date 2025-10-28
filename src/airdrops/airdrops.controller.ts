import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from "@nestjs/common";
import { AirdropsService } from "./airdrops.service";

@Controller("airdrops")
export class AirdropsController {
  private readonly logger = new Logger(AirdropsController.name);

  constructor(private readonly airdropsService: AirdropsService) {}

  @Post("airdrop-buyback-tokens")
  async airdropBuybackTokens(
    @Body()
    payload: { tokenAddress: string; amount: string }[]
  ) {
    try {
      if (!Array.isArray(payload) || payload.length === 0) {
        throw new HttpException(
          "Request body must be a non-empty array of tokens",
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.airdropsService.airdropTheBuyBack(payload);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        "Airdrop buyback tokens failed",
        (error as Error).stack
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        (error as Error).message || "Failed to execute buyback airdrop",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
