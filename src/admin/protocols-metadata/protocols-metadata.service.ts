import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Protocol } from "@/database/entities/protocol-metadata.entity";

type CreateProtocolInput = {
  name: string;
  platform_name: string;
  logo_image: string;
  account: string;
  apyid?: string | null;
  description?: string | null;
};

type UpdateProtocolInput = {
  platform_name?: string;
  logo_image?: string;
  account?: string;
  apyid?: string | null;
  description?: string | null;
};

@Injectable()
export class ProtocolsMetadataService {
  private readonly logger = new Logger(ProtocolsMetadataService.name);

  constructor(
    @InjectRepository(Protocol)
    private readonly protocolRepository: Repository<Protocol>,
  ) {}

  async create(input: CreateProtocolInput): Promise<Protocol> {
    const existing = await this.protocolRepository.findOne({
      where: { name: input.name },
    });

    if (existing) {
      throw new HttpException(
        `Protocol with name ${input.name} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    const entity = this.protocolRepository.create({
      name: input.name,
      platform_name: input.platform_name,
      logo_image: input.logo_image,
      account: input.account,
      apyid: input.apyid ?? null,
      description: input.description ?? null,
    });

    const saved = await this.protocolRepository.save(entity);
    this.logger.log(`Created protocol metadata for ${saved.name}`);

    return saved;
  }

  async findAll(): Promise<Protocol[]> {
    const records = await this.protocolRepository.find({
      order: { name: "ASC" },
    });

    this.logger.log(`Fetched ${records.length} protocol metadata records`);
    return records;
  }

  async findOne(name: string): Promise<Protocol> {
    const record = await this.protocolRepository.findOne({
      where: { name },
    });

    if (!record) {
      throw new NotFoundException(`Protocol ${name} not found`);
    }

    return record;
  }

  async update(name: string, input: UpdateProtocolInput): Promise<Protocol> {
    const record = await this.findOne(name);

    const updateData: UpdateProtocolInput = {};

    if (input.platform_name !== undefined) {
      updateData.platform_name = input.platform_name;
    }

    if (input.logo_image !== undefined) {
      updateData.logo_image = input.logo_image;
    }

    if (input.account !== undefined) {
      updateData.account = input.account;
    }

    if (input.apyid !== undefined) {
      updateData.apyid = input.apyid;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    const updated = await this.protocolRepository.save({
      ...record,
      ...updateData,
    });

    this.logger.log(`Updated protocol metadata for ${updated.name}`);
    return updated;
  }

  async remove(name: string): Promise<void> {
    const result = await this.protocolRepository.delete({ name });

    if (result.affected === 0) {
      throw new NotFoundException(`Protocol ${name} not found`);
    }

    this.logger.log(`Removed protocol metadata for ${name}`);
  }
}
