const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Paths
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const srcEnv = path.join(rootDir, ".env.prod");
const destEnv = path.join(distDir, ".env");
const { version } = require(path.join(rootDir, "package.json"));

if (!fs.existsSync(distDir)) {
  throw new Error("dist folder not found. Run the build first.");
}

if (!fs.existsSync(srcEnv)) {
  throw new Error(".env.prod not found at project root.");
}

// Copy env
fs.copyFileSync(srcEnv, destEnv);
console.log("Copied .env.prod to dist/.env");

// Zip dist with versioned name
const zipName = `mainnet-build-v${version}.zip`;
const zipPath = path.join(rootDir, zipName);
if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath);
}
execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: "inherit" });
console.log(`Created ${zipName}`);
