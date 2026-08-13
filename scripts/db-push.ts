import dotenv from "dotenv";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

dotenv.config({ path: ".env.sync", override: true });

const target = process.argv[2];

if (target !== "staging" && target !== "prod") {
  console.error("Usage: tsx scripts/db-push.ts staging|prod");
  process.exit(1);
}

const databaseUrl =
  target === "prod"
    ? process.env.PROD_DATABASE_URL
    : process.env.STAGING_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    `Missing ${
      target === "prod"
        ? "PROD_DATABASE_URL"
        : "STAGING_DATABASE_URL"
    } in .env.sync`,
  );
}

async function confirmProduction() {
  if (target !== "prod") return;

  console.log("");
  console.log("========================================");
  console.log("       ⚠ PRODUCTION DATABASE ⚠");
  console.log("========================================");
  console.log("");
  console.log("You are about to change the PRODUCTION schema.");
  console.log("");

  const rl = createInterface({ input, output });

  const answer = await rl.question(
    'Type "PUSH PRODUCTION" to continue: ',
  );

  rl.close();

  if (answer !== "PUSH PRODUCTION") {
    throw new Error("Production push cancelled.");
  }
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log(` DATABASE TARGET: ${target.toUpperCase()}`);
  console.log("========================================");

  const url = new URL(databaseUrl!);

  console.log(`Host: ${url.hostname}`);
  console.log(`Database: ${url.pathname.replace("/", "")}`);
  console.log("");

  await confirmProduction();

  const child = spawn(
    "npx drizzle-kit push",
    {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
  
        // drizzle.config.ts continues using DATABASE_URL,
        // but only this child process receives the selected DB.
        DATABASE_URL: databaseUrl!,
      },
    },
  );

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error("");
  console.error("DATABASE PUSH FAILED");
  console.error(error);
  process.exit(1);
});