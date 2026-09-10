import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const ROOT = process.argv[2] || "client/public/assets/images";

const QUALITY = 85;
const MIN_SAVING = 10 * 1024; // 10 KB

let processed = 0;
let optimized = 0;
let skipped = 0;
let savedBytes = 0;

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return walk(full);
      }

      return full;
    })
  );

  return files.flat();
}

async function optimize(file: string) {
  if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) {
    return;
  }

  processed++;

  const original = await fs.readFile(file);
  const before = original.length;

  let output: Buffer;

  try {
    output = await sharp(original)
      .rotate()
      .webp({
        quality: QUALITY,
        effort: 6,
      })
      .toBuffer();
  } catch {
    skipped++;
    return;
  }

  const after = output.length;

  if (before - after < MIN_SAVING) {
    skipped++;
    return;
  }

  await fs.writeFile(file, output);

  optimized++;
  savedBytes += before - after;

  console.log(
    `${path.relative(ROOT, file)}  ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`
  );
}

async function main() {
  console.log(`Scanning: ${ROOT}\n`);

  const files = await walk(ROOT);

  for (const file of files) {
    await optimize(file);
  }

  console.log("\n==============================");
  console.log(`Processed : ${processed}`);
  console.log(`Optimized : ${optimized}`);
  console.log(`Skipped   : ${skipped}`);
  console.log(
    `Saved     : ${(savedBytes / 1024 / 1024).toFixed(2)} MB`
  );
  console.log("==============================");
}

main().catch(console.error);