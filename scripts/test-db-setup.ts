import { DataSource } from "typeorm";
import { NftHolder } from "../src/database/entities/nft-holder.entity";
import { LedgerState } from "../src/database/entities/ledger-state.entity";

// Test database connection and entity creation
async function testDatabaseSetup() {
  const dataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "hedge_fund_db",
    entities: [NftHolder, LedgerState],
    synchronize: true, // This will create tables automatically
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log("✅ Database connection successful");

    // Test entity creation
    const nftRepo = dataSource.getRepository(NftHolder);
    const ledgerRepo = dataSource.getRepository(LedgerState);

    console.log("✅ Entities initialized successfully");
    console.log("Tables created:");
    console.log("- nft_holders");
    console.log("- ledger_states");

    await dataSource.destroy();
    console.log("✅ Database connection closed");
  } catch (error) {
    console.error("❌ Database setup failed:", error);
  }
}

// testDatabaseSetup();
