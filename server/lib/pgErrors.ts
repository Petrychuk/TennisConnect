/*
  Postgres error codes through drizzle-orm. Since 0.44 a failed query throws a
  DrizzleQueryError that wraps the driver's error in `.cause`, so `error.code`
  is undefined on the error the caller catches. TC-189 / LIVE-014: a check on
  `error.code === "23505"` never matched and a lost race answered 500.
*/

/** unique_violation (23505), raw or wrapped. */
export function isUniqueViolation(error: unknown): boolean {
  let e: any = error;
  for (let depth = 0; e && depth < 4; depth++, e = e.cause) {
    if (e.code === "23505") return true;
  }
  return false;
}
