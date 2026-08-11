import dotenv from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

dotenv.config({ path: ".env.sync", override: true });

/* =========================================================
   ENVIRONMENT
========================================================= */

const required = [
  "PROD_DATABASE_URL",
  "STAGING_DATABASE_URL",
  "PROD_SUPABASE_URL",
  "PROD_SUPABASE_SERVICE_ROLE_KEY",
  "STAGING_SUPABASE_URL",
  "STAGING_SUPABASE_SERVICE_ROLE_KEY",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key} in .env.sync`);
  }
}

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL!;
const STAGING_DATABASE_URL = process.env.STAGING_DATABASE_URL!;

const PROD_SUPABASE_URL = process.env.PROD_SUPABASE_URL!;
const STAGING_SUPABASE_URL = process.env.STAGING_SUPABASE_URL!;

/* =========================================================
   DATABASE CLIENTS
========================================================= */

const prodDb = postgres(PROD_DATABASE_URL, {
  max: 1,
});

const stagingDb = postgres(STAGING_DATABASE_URL, {
  max: 1,
});

/* =========================================================
   SUPABASE CLIENTS
========================================================= */

const prodSupabase = createClient(
  PROD_SUPABASE_URL,
  process.env.PROD_SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const stagingSupabase = createClient(
  STAGING_SUPABASE_URL,
  process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

/* =========================================================
   SAFETY
========================================================= */

function assertEnvironmentSafety() {
  if (PROD_DATABASE_URL === STAGING_DATABASE_URL) {
    throw new Error(
      "SAFETY STOP: Production and staging DATABASE_URL are identical.",
    );
  }

  if (PROD_SUPABASE_URL === STAGING_SUPABASE_URL) {
    throw new Error(
      "SAFETY STOP: Production and staging Supabase URLs are identical.",
    );
  }
}

/* =========================================================
   CONFIRMATION
========================================================= */

async function confirmSync() {
  console.log("");
  console.log("========================================");
  console.log("   TennisConnect STAGING SYNC");
  console.log("========================================");
  console.log("");
  console.log("SOURCE:      PRODUCTION");
  console.log("DESTINATION: STAGING");
  console.log("");
  console.log("PRODUCTION DATA WILL BE UPSERTED INTO STAGING.");
  console.log("STAGING-ONLY DATA WILL NOT BE DELETED.");
  console.log("PRODUCTION WILL NOT BE MODIFIED.");
  console.log("user_sessions WILL NOT BE SYNCED.");
  console.log("");

  const rl = createInterface({
    input,
    output,
  });

  const answer = await rl.question(
    'Type "SYNC STAGING" to continue: ',
  );

  rl.close();

  if (answer !== "SYNC STAGING") {
    throw new Error("Sync cancelled.");
  }
}

/* =========================================================
   DATABASE HELPERS
========================================================= */

async function getPublicTables() {
  const tables = await prodDb`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  return tables
    .map((row) => String(row.tablename))
    .filter((table) => table !== "user_sessions");
}

async function getPrimaryKeys(table: string) {
  const rows = await prodDb.unsafe(
    `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a
        ON a.attrelid = i.indrelid
       AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
        AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)
    `,
    [`public.${table}`],
  );

  return rows.map((row) => String(row.column_name));
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function qualifiedTable(table: string) {
  return `${quoteIdentifier("public")}.${quoteIdentifier(table)}`;
}

/* =========================================================
   DATABASE SYNC
========================================================= */

async function syncDatabase() {
  console.log("\n[DB] Reading production tables...");

  const tables = await getPublicTables();

  console.log(`[DB] Found ${tables.length} tables.`);
  console.log("[DB] user_sessions will NOT be synced.");

  await stagingDb.begin(async (sql) => {
    /*
     * We temporarily disable FK trigger enforcement because tables
     * may be copied in an order that does not match their FK
     * dependencies.
     */
    await sql`SET LOCAL session_replication_role = replica`;

    for (const table of tables) {
      const tableName = qualifiedTable(table);

      /*
       * Read all rows from this production table.
       *
       * tableName is safe here because the table name originates
       * from pg_tables and is quoted by qualifiedTable().
       */
      const rows = await prodDb.unsafe(
        `SELECT * FROM ${tableName}`,
      );

      if (rows.length === 0) {
        console.log(`[DB] ${table}: 0 rows`);
        continue;
      }

      const primaryKeys = await getPrimaryKeys(table);

      if (primaryKeys.length === 0) {
        console.warn(
          `[DB] ${table}: skipped — table has no primary key`,
        );
        continue;
      }

      console.log(
        `[DB] ${table}: syncing ${rows.length} rows ` +
          `(PK: ${primaryKeys.join(", ")})`,
      );

      /*
       * We process one row at a time.
       *
       * This is intentionally simpler and safer for our staging
       * synchronisation script. This is not a high-throughput
       * production migration.
       */
      for (const row of rows) {
        const plainRow = { ...row };

        const columns = Object.keys(plainRow);

        if (columns.length === 0) {
          continue;
        }

        const updateColumns = columns.filter(
          (column) => !primaryKeys.includes(column),
        );

        const quotedPkColumns = primaryKeys
          .map(quoteIdentifier)
          .join(", ");

        /*
         * postgres.js safely creates the VALUES part from the object.
         *
         * We use the transaction client `sql` here because the INSERT
         * must run inside the staging transaction.
         */
        if (updateColumns.length === 0) {
          await sql.unsafe(
            `
              INSERT INTO ${tableName}
              (${columns.map(quoteIdentifier).join(", ")})
              VALUES (
                ${columns
                  .map((_, index) => `$${index + 1}`)
                  .join(", ")}
              )
              ON CONFLICT (${quotedPkColumns})
              DO NOTHING
            `,
            columns.map((column) => plainRow[column]),
          );

          continue;
        }

        const updateAssignments = updateColumns
          .map((column) => {
            const quoted = quoteIdentifier(column);

            return `${quoted} = EXCLUDED.${quoted}`;
          })
          .join(", ");

        await sql.unsafe(
          `
            INSERT INTO ${tableName}
            (${columns.map(quoteIdentifier).join(", ")})
            VALUES (
              ${columns
                .map((_, index) => `$${index + 1}`)
                .join(", ")}
            )
            ON CONFLICT (${quotedPkColumns})
            DO UPDATE SET
              ${updateAssignments}
          `,
          columns.map((column) => plainRow[column]),
        );
      }

      console.log(`[DB] ${table}: ✓ synced`);
    }
  });

  console.log("[DB] Database sync complete.");
}

/* =========================================================
   STORAGE HELPERS
========================================================= */

async function listStorageFiles(
  client: any,
  bucket: string,
  folder = "",
): Promise<string[]> {
  const result: string[] = [];

  const pageSize = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(folder, {
        limit: pageSize,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) {
      throw new Error(
        `Storage list failed for "${folder}": ${error.message}`,
      );
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      const path = folder
        ? `${folder}/${item.name}`
        : item.name;

      /*
       * Supabase folders do not have an object id.
       */
      if (item.id == null) {
        const nestedFiles = await listStorageFiles(
          client,
          bucket,
          path,
        );

        result.push(...nestedFiles);
      } else {
        result.push(path);
      }
    }

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return result;
}

/* =========================================================
   STORAGE SYNC
========================================================= */

async function syncStorage() {
  const bucket = "media";

  console.log(
    `\n[STORAGE] Reading production "${bucket}" bucket...`,
  );

  const files = await listStorageFiles(
    prodSupabase,
    bucket,
  );

  console.log(`[STORAGE] Found ${files.length} files.`);

  for (const filePath of files) {
    console.log(`[STORAGE] Syncing ${filePath}`);

    const {
      data,
      error: downloadError,
    } = await prodSupabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !data) {
      throw new Error(
        `Unable to download ${filePath}: ` +
          `${downloadError?.message}`,
      );
    }

    const buffer = Buffer.from(
      await data.arrayBuffer(),
    );

    const { error: uploadError } =
      await stagingSupabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          /*
           * Existing staging file with the same path is updated.
           * Staging-only files are NOT deleted.
           */
          upsert: true,
          contentType: data.type || undefined,
        });

    if (uploadError) {
      throw new Error(
        `Unable to upload ${filePath}: ` +
          `${uploadError.message}`,
      );
    }
  }

  console.log("[STORAGE] Storage sync complete.");
}

/* =========================================================
   STORAGE URL REPLACEMENT
========================================================= */

async function replaceStorageUrls() {
  console.log(
    "\n[DB] Replacing production Storage URLs with staging URLs...",
  );

  const prodPrefix =
    `${PROD_SUPABASE_URL}/storage/v1/object/public/`;

  const stagingPrefix =
    `${STAGING_SUPABASE_URL}/storage/v1/object/public/`;

  /*
   * Find text/varchar columns because Storage URLs may exist
   * in several tables.
   */
  const columns = await stagingDb`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN (
        'text',
        'character varying'
      )
  `;

  for (const row of columns) {
    const table = String(row.table_name);
    const column = String(row.column_name);

    /*
     * user_sessions is intentionally excluded from the sync.
     */
    if (table === "user_sessions") {
      continue;
    }

    const tableName = qualifiedTable(table);
    const columnName = quoteIdentifier(column);

    await stagingDb.unsafe(
      `
        UPDATE ${tableName}
        SET ${columnName} =
          replace(
            ${columnName},
            $1,
            $2
          )
        WHERE ${columnName} LIKE $3
      `,
      [
        prodPrefix,
        stagingPrefix,
        `${prodPrefix}%`,
      ],
    );
  }

  console.log("[DB] Storage URLs updated.");
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  try {
    assertEnvironmentSafety();

    await confirmSync();

    await syncDatabase();

    await syncStorage();

    await replaceStorageUrls();

    console.log("");
    console.log("========================================");
    console.log("   STAGING SYNC COMPLETE");
    console.log("========================================");
    console.log("");
    console.log("✓ Production database → staging upserted");
    console.log("✓ Staging-only database records preserved");
    console.log("✓ user_sessions untouched");
    console.log("✓ Production Storage → staging synced");
    console.log("✓ Staging-only Storage files preserved");
    console.log("✓ Storage URLs changed to staging URLs");
    console.log("✓ Production was NOT modified");
    console.log("");
  } finally {
    await prodDb.end();
    await stagingDb.end();
  }
}

main().catch((error) => {
  console.error("");
  console.error("========================================");
  console.error("   STAGING SYNC FAILED");
  console.error("========================================");
  console.error("");

  console.error(error);

  process.exit(1);
});