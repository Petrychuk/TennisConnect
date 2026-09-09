// scripts/backfill-image-optimization.ts
//
// The client-side resize (client/src/lib/image.ts) only kicks in on new
// uploads going forward. Every image already sitting in Storage from
// before that fix - every club/travel/article/tournament/recreation
// cover, every player/coach avatar and cover - is still the original,
// unresized file. This walks the DB, re-downloads each one, resizes it
// with the exact same presets the browser now uses, and uploads it back
// to the SAME storage path. No URLs change, no DB writes happen - the
// files a browser already has cached just get replaced with smaller
// ones the next time anything re-fetches them.
//
// SAFETY:
// - Dry-run by default. Nothing is uploaded, nothing is deleted, unless
//   you pass --commit.
// - Every original is backed up locally to ./backfill-backup/<path>
//   before it's overwritten, in commit mode, so a bad run can be
//   reverted by re-uploading the backups.
// - Anything already small enough to be a plausible already-optimized
//   file is skipped (SKIP_IF_UNDER_BYTES) - safe to re-run after an
//   interrupted pass without redoing finished work.
// - If the resized version isn't actually smaller than the original,
//   the original is kept and the row is skipped - same rule
//   client/src/lib/image.ts already follows for new uploads.
//
// USAGE:
//   npx tsx scripts/backfill-image-optimization.ts                  (dry run, everything)
//   npx tsx scripts/backfill-image-optimization.ts --only=clubs     (dry run, one table)
//   npx tsx scripts/backfill-image-optimization.ts --only=clubs --limit=5   (dry run, first 5 rows)
//   npx tsx scripts/backfill-image-optimization.ts --only=clubs --commit    (actually uploads)
//
// Run against staging first. Then --only=<one table> --limit=5 --commit
// on prod, eyeball the result on the live site, before doing a full run.
//
// REQUIRES: `npm install sharp` - not otherwise a dependency of this
// project (client-side resize uses the browser's own Canvas API, which
// doesn't exist in Node). This is a one-off CLI script; sharp is not
// imported by anything that ships to the browser.

import { db } from "../server/db";
import { supabaseAdmin } from "../server/supabaseAdmin";
import { users, clubs, articles, travelPackages, recreationServices, tournaments } from "../shared/schema";
import { eq, isNotNull } from "drizzle-orm";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const BUCKET = "media";
const DELAY_MS_BETWEEN_ITEMS = 150; // be polite to the Storage API
const BACKUP_DIR = path.resolve("backfill-backup");
const MIN_SAVED_BYTES = 50 * 1024; // Skip if saving less than 50 KB

type Preset = "avatar" | "cover" | "content";

const PRESET_CONFIG: Record<Preset, { width: number; height: number; square?: boolean }> = {
  avatar: { width: 512, height: 512, square: true },
  cover: { width: 1920, height: 1080 },
  content: { width: 1920, height: 1920},
};

interface ImageField {
  table: string; // for --only filtering and logging
  preset: Preset;
  // Runs the actual query/update - kept per-field rather than generic
  // so each one's id/url column names stay explicit and typo-checked
  // by TypeScript, not stringly-typed.
  fetchRows: () => Promise<{ id: string | number; url: string }[]>;
}

const IMAGE_FIELDS: ImageField[] = [
  {
    table: "users.avatar",
    preset: "avatar",
    fetchRows: async () =>
      (await db.select({ id: users.id, url: users.avatar }).from(users).where(isNotNull(users.avatar)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
  {
    table: "users.cover",
    preset: "cover",
    fetchRows: async () =>
      (await db.select({ id: users.id, url: users.cover }).from(users).where(isNotNull(users.cover)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
  {
    table: "clubs.logo",
    preset: "avatar",
    fetchRows: async () =>
      (await db.select({ id: clubs.id, url: clubs.logo }).from(clubs).where(isNotNull(clubs.logo)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
  {
    table: "clubs.cover",
    preset: "cover",
    fetchRows: async () =>
      (await db.select({ id: clubs.id, url: clubs.cover }).from(clubs).where(isNotNull(clubs.cover)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
  {
    table: "clubs.image",
    preset: "content",
    fetchRows: async () =>
      (await db.select({ id: clubs.id, url: clubs.image }).from(clubs).where(isNotNull(clubs.image)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
  {
    table: "articles.coverImage",
    preset: "cover",
    fetchRows: async () =>
      (await db.select({ id: articles.id, url: articles.coverImage }).from(articles).where(isNotNull(articles.coverImage)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
  {
    table: "travelPackages.coverImage",
    preset: "cover",
    fetchRows: async () =>
      (await db.select({ id: travelPackages.id, url: travelPackages.coverImage }).from(travelPackages).where(isNotNull(travelPackages.coverImage)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
  {
    table: "recreationServices.coverImage",
    preset: "cover",
    fetchRows: async () =>
      (await db.select({ id: recreationServices.id, url: recreationServices.coverImage }).from(recreationServices).where(isNotNull(recreationServices.coverImage)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
  {
    table: "tournaments.coverImage",
    preset: "cover",
    fetchRows: async () =>
      (await db.select({ id: tournaments.id, url: tournaments.coverImage }).from(tournaments).where(isNotNull(tournaments.coverImage)))
        .filter((r): r is { id: string; url: string } => !!r.url),
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    commit: args.includes("--commit"),
    only: args.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(","),
    limit: Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? Infinity),
  };
}

// Public URLs look like:
//   https://<project>.supabase.co/storage/v1/object/public/media/<path>
// This is the inverse of getPublicUrl() in uploadMedia.ts/upload-content.ts.
function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

async function resize(buffer: Buffer, preset: Preset): Promise<Buffer> {
  const { width, height, square } = PRESET_CONFIG[preset];
  let pipeline = sharp(buffer).rotate(); // .rotate() with no args = auto-orient from EXIF, then strip it

  pipeline = square
    ? pipeline.resize(width, height, { fit: "cover", position: "centre" })
    : pipeline.resize(width, height, { fit: "inside", withoutEnlargement: true });

    return pipeline.webp({
      quality:
        preset === "avatar"
          ? 85
          : preset === "cover"
          ? 86
          : 86,
      effort: 6,
    }).toBuffer();
}

async function processField(field: ImageField, opts: ReturnType<typeof parseArgs>) {
  const rows = (await field.fetchRows()).slice(0, opts.limit);
  console.log(`\n=== ${field.table} (${rows.length} row${rows.length === 1 ? "" : "s"}) ===`);

  let savedBytes = 0;
  let touched = 0;
  let skipped = 0;

  for (const row of rows) {
    const storagePath = storagePathFromPublicUrl(row.url);
    if (!storagePath) {
      console.log(`  [${row.id}] SKIP - not a Storage URL (${row.url.slice(0, 60)}...)`);
      skipped++;
      continue;
    }
    // Skip obvious non-image files (PDF, SVG, etc.)
    // Storage URLs without an extension are also allowed.
    const lowerUrl = row.url.toLowerCase();

    if (
      lowerUrl.endsWith(".pdf") ||
      lowerUrl.endsWith(".svg") ||
      lowerUrl.endsWith(".doc") ||
      lowerUrl.endsWith(".docx")
    ) {
      console.log(`  [${row.id}] SKIP - unsupported file type`);
      skipped++;
      continue;
    }

    const { data: original, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadError || !original) {
      console.log(`  [${row.id}] SKIP - download failed: ${downloadError?.message}`);
      skipped++;
      continue;
    }

    const originalBuffer = Buffer.from(await original.arrayBuffer());

    let resized: Buffer;
    try {
      resized = await resize(originalBuffer, field.preset);
    } catch (err) {
      console.log(`  [${row.id}] SKIP - could not decode/resize: ${(err as Error).message}`);
      skipped++;
      continue;
    }

    if (resized.byteLength >= originalBuffer.byteLength) {
      console.log(`  [${row.id}] SKIP - resize didn't help (${originalBuffer.byteLength} -> ${resized.byteLength})`);
      skipped++;
      continue;
    }

    const before = originalBuffer.byteLength;
    const after = resized.byteLength;

    const bytesSaved = before - after;
    const savingPercent = (bytesSaved / before) * 100;

    if (savingPercent < 10) {
      skipped++;
      continue;
    }

    if (bytesSaved < MIN_SAVED_BYTES) {
      console.log(
        `  [${row.id}] SKIP - saving only ${(bytesSaved / 1024).toFixed(1)} KB`
      );
      skipped++;
    continue;
    }

    const pct = Math.round(savingPercent);
    console.log(
      `  [${row.id}] ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (-${pct}%)  ${storagePath}`
    );

    if (opts.commit) {
      // Remove cache-busting query string before creating a local backup file.
      const backupStoragePath = storagePath.split("?")[0];
      const backupPath = path.join(BACKUP_DIR, backupStoragePath);
    
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.writeFile(backupPath, originalBuffer);
    
      // Upload back to the original Storage object.
      const uploadPath = storagePath.split("?")[0];
    
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(uploadPath, resized, {
          contentType: "image/webp",
          upsert: true,
        });
    
      if (uploadError) {
        console.log(
          `  [${row.id}] UPLOAD FAILED: ${uploadError.message} - original backed up at ${backupPath}, Storage untouched`
        );
        skipped++;
        continue;
      }
    }

    savedBytes += before - after;
    touched++;

    await new Promise((r) => setTimeout(r, DELAY_MS_BETWEEN_ITEMS));
  }

  return { touched, skipped, savedBytes };
}

async function main() {
  const opts = parseArgs();

  console.log("\n=================================");
  console.log("IMAGE OPTIMIZATION BACKFILL");
  console.log("=================================");

  console.log(
    opts.commit
      ? "🟢 COMMIT MODE - optimized images will overwrite originals."
      : "🟡 DRY RUN - nothing will be uploaded (use --commit to apply changes)."
  );

  if (opts.only) {
    console.log(`📂 Processing only: ${opts.only.join(", ")}`);
  }

  if (opts.commit) {
    console.log(`💾 Backups: ${BACKUP_DIR}`);
  }

  const fields = opts.only
    ? IMAGE_FIELDS.filter((f) =>
        opts.only!.some((o) =>
          f.table.toLowerCase().startsWith(o.toLowerCase())
        )
      )
    : IMAGE_FIELDS;

  if (fields.length === 0) {
    console.error(
      `\n❌ No tables matched --only=${opts.only?.join(", ")}`
    );

    console.log(
      `Available tables:\n${IMAGE_FIELDS.map((f) => ` • ${f.table}`).join("\n")}`
    );

    process.exit(1);
  }

  let totalTouched = 0;
  let totalSkipped = 0;
  let totalSavedBytes = 0;

  for (const field of fields) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing ${field.table} (${field.preset})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const { touched, skipped, savedBytes } = await processField(
      field,
      opts
    );

    totalTouched += touched;
    totalSkipped += skipped;
    totalSavedBytes += savedBytes;
  }

  console.log("\n=================================");
  console.log("IMAGE OPTIMIZATION COMPLETE");
  console.log("=================================");

  console.log(
    `${opts.commit ? "Images optimized" : "Would optimize"} : ${totalTouched}`
  );

  console.log(`Images skipped  : ${totalSkipped}`);

  console.log(
    `${opts.commit ? "Space saved" : "Would save"} : ${(
      totalSavedBytes /
      1024 /
      1024
    ).toFixed(2)} MB`
  );

  console.log("=================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Backfill failed:");
  console.error(err);

  process.exit(1);
});