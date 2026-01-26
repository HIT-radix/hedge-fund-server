import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProtocolPercentage } from "@/database/entities/protocol-percentage.entity";
import { executeTransactionManifest } from "@/utils/helpers";
import { set_defi_protocols_percentages_manifest } from "@/utils/manifests";

export interface ProtocolPercentagePayload {
  protocol: string;
  percentage: number;
}

@Injectable()
export class ProtocolsPercentageService {
  private readonly logger = new Logger(ProtocolsPercentageService.name);

  constructor(
    @InjectRepository(ProtocolPercentage)
    private readonly protocolPercentageRepository: Repository<ProtocolPercentage>,
  ) {}

  async addProtocolPercentage(
    protocol: string,
    percentage = 0,
  ): Promise<ProtocolPercentage> {
    const name = protocol?.trim();

    if (!name) {
      throw new Error("Protocol name is required");
    }

    if (!Number.isInteger(percentage)) {
      throw new Error("Percentage must be an integer");
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error("Percentage must be between 0 and 100");
    }

    const exists = await this.protocolPercentageRepository.findOne({
      where: { name },
    });

    if (exists) {
      throw new Error(`Protocol ${name} already exists`);
    }

    const entity = this.protocolPercentageRepository.create({
      name,
      percentage,
    });

    return this.protocolPercentageRepository.save(entity);
  }

  async setProtocolsPercentages(
    percentages: ProtocolPercentagePayload[],
  ): Promise<{ txId: string | undefined }> {
    if (!Array.isArray(percentages) || percentages.length === 0) {
      throw new Error("Percentages payload must be a non-empty array");
    }

    for (const item of percentages) {
      if (!item?.protocol || typeof item.protocol !== "string") {
        throw new Error("Each entry must contain a protocol name");
      }

      if (!Number.isInteger(item?.percentage)) {
        throw new Error(
          `Percentage for protocol ${item?.protocol ?? "unknown"} must be an integer`,
        );
      }

      if (item.percentage < 0 || item.percentage > 100) {
        throw new Error(
          `Percentage for protocol ${item.protocol} must be between 0 and 100`,
        );
      }
    }

    const totalPercentage = percentages.reduce(
      (acc, item) => acc + item.percentage,
      0,
    );

    if (Math.abs(totalPercentage - 100) > 0.2) {
      throw new Error(
        `Total percentage must be equal to near 100. Received ${totalPercentage}`,
      );
    }

    const manifest = await set_defi_protocols_percentages_manifest(percentages);

    const txResult = await executeTransactionManifest(manifest, 10);

    if (!txResult.success) {
      const errorMessage = txResult.error || "Failed to execute transaction";
      this.logger.error(
        `Protocol percentage transaction failed: ${errorMessage}`,
      );
      throw new Error(errorMessage);
    }

    await this.protocolPercentageRepository.manager.transaction(
      async (manager) => {
        await manager.getRepository(ProtocolPercentage).upsert(
          percentages.map((item) => ({
            name: item.protocol,
            percentage: item.percentage,
          })),
          ["name"],
        );
      },
    );

    this.logger.log(
      `Updated protocol percentages for ${percentages.length} protocols. Tx: ${txResult.txId}`,
    );

    return { txId: txResult.txId };
  }

  async getProtocolsPercentages(): Promise<ProtocolPercentage[]> {
    const records = await this.protocolPercentageRepository.find({
      order: { name: "ASC" },
    });

    this.logger.log(`Fetched ${records.length} protocol percentage records`);

    return records;
  }
}
