// Recognises "the code is newer than the database": Postgres answers
// 42703 (undefined_column) or 42P01 (undefined_table) when a query names a
// column/table a pending migration would have added. Drizzle wraps the driver
// error ("Failed query: insert into ..."), with the SQLSTATE on `.cause`.
//
// The raw message is a full SQL statement with every column and parameter
// (including user input) and must not reach the browser - the wizard used to
// show it in a toast. The response says what to do instead; the real error
// still goes to the server log.

const DRIFT_CODES = new Set(["42703", "42P01"]);

export const SCHEMA_DRIFT_MESSAGE =
  "The database is missing a recent migration, so this couldn't be saved. Ask whoever runs the server to apply the pending migrations (migrations/), then try again.";

export function isSchemaDriftError(err: unknown): boolean {
  let current: any = err;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current.code === "string" && DRIFT_CODES.has(current.code)) return true;
    current = current.cause;
  }
  return false;
}
