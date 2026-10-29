// Which API responses may have their JSON body written to the server log
// (server/index.ts request logger).
//
// Existing behaviour: bodies are logged outside production only.
// Exception: /api/test-hooks/* responses are NEVER body-logged, in any
// environment - they carry raw verification tokens, seeded passwords and
// captured emails with reset/verification links
// (server/services/emailCapture.ts). Unit-tested in
// server/services/emailCapture.test.ts.

const NEVER_BODY_LOGGED_PREFIXES: readonly string[] = ["/api/test-hooks"];

export function shouldLogResponseBody(path: string, isProduction: boolean): boolean {
  if (isProduction) return false;
  const normalised = path.toLowerCase();
  return !NEVER_BODY_LOGGED_PREFIXES.some(
    prefix => normalised === prefix || normalised.startsWith(`${prefix}/`)
  );
}
