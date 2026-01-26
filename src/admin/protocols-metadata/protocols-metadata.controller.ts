import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ProtocolsMetadataService } from "./protocols-metadata.service";

interface CreateProtocolBody {
  secret?: string;
  name?: string;
  platform_name?: string;
  logo_image?: string;
  account?: string;
  apyid?: string | null;
  description?: string | null;
}

interface UpdateProtocolBody {
  secret?: string;
  platform_name?: string;
  logo_image?: string;
  account?: string;
  apyid?: string | null;
  description?: string | null;
}

@Controller("admin/protocols-metadata")
export class ProtocolsMetadataController {
  private readonly logger = new Logger(ProtocolsMetadataController.name);

  constructor(
    private readonly protocolsMetadataService: ProtocolsMetadataService,
  ) {}

  private validateAdminSecret(secret?: string) {
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
  }

  @Post()
  async create(@Body() payload: CreateProtocolBody) {
    try {
      this.validateAdminSecret(payload?.secret);

      const { name, platform_name, logo_image, apyid, description } = payload;
      const account = payload.account;

      if (!name?.trim()) {
        throw new HttpException(
          "Protocol name is required",
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!platform_name?.trim()) {
        throw new HttpException(
          "Platform name is required",
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!logo_image?.trim()) {
        throw new HttpException(
          "Logo image is required",
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!account?.trim()) {
        throw new HttpException("Account is required", HttpStatus.BAD_REQUEST);
      }

      const created = await this.protocolsMetadataService.create({
        name: name.trim(),
        platform_name: platform_name.trim(),
        logo_image: logo_image.trim(),
        account: account.trim(),
        apyid: apyid?.trim?.() ? apyid?.trim?.() : null,
        description: description?.trim?.() ? description?.trim?.() : null,
      });

      return { success: true, data: created };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        "Failed to create protocol metadata",
        (error as Error).stack,
      );
      throw new HttpException(
        (error as Error).message || "Failed to create protocol metadata",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async findAll(@Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);

      const data = await this.protocolsMetadataService.findAll();

      return { success: true, count: data.length, data };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        "Failed to fetch protocol metadata",
        (error as Error).stack,
      );
      throw new HttpException(
        (error as Error).message || "Failed to fetch protocol metadata",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);

      const data = await this.protocolsMetadataService.findOne(id);

      return { success: true, data };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to fetch protocol metadata for ${id}`,
        (error as Error).stack,
      );
      throw new HttpException(
        (error as Error).message || "Failed to fetch protocol metadata",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() payload: UpdateProtocolBody) {
    try {
      this.validateAdminSecret(payload?.secret);

      const hasUpdatableField =
        payload.platform_name ||
        payload.logo_image ||
        payload.account ||
        payload.apyid !== undefined ||
        payload.description !== undefined;

      if (!hasUpdatableField) {
        throw new HttpException(
          "At least one field must be provided to update",
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await this.protocolsMetadataService.update(id, {
        platform_name: payload.platform_name?.trim?.(),
        logo_image: payload.logo_image?.trim?.(),
        account: payload.account?.trim?.(),
        apyid: payload.apyid?.trim?.() ?? payload.apyid ?? undefined,
        description:
          payload.description?.trim?.() ?? payload.description ?? undefined,
      });

      return { success: true, data: updated };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to update protocol ${id}`,
        (error as Error).stack,
      );
      throw new HttpException(
        (error as Error).message || "Failed to update protocol metadata",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Query("secret") secret?: string) {
    try {
      this.validateAdminSecret(secret);

      await this.protocolsMetadataService.remove(id);

      return { success: true, message: `Protocol ${id} removed` };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to remove protocol ${id}`,
        (error as Error).stack,
      );
      throw new HttpException(
        (error as Error).message || "Failed to remove protocol metadata",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
