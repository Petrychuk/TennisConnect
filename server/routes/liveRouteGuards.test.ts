// npx tsx --test server/routes/liveRouteGuards.test.ts
//
// TC-189 (TC Live v1) phase 6: a static check of the guards on every Live
// and after-Finish route in server/routes/organizer.ts. Reads the source
// only - no express, no database - so it runs anywhere, and a route added
// or edited without its guards fails here before any E2E run.
// organizerLive.test.ts checks the same routes' behaviour on the real router.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "organizer.ts"), "utf8");

/** The middleware list of one route: everything between the path and `async (`. */
function guardsOf(method: string, route: string): string[] {
  const start = SOURCE.search(new RegExp(`router\\.${method}\\(\\s*"${route.replace(/[/:]/g, (c) => `\\${c}`)}"`));
  assert.ok(start >= 0, `${method.toUpperCase()} ${route} exists`);
  const head = SOURCE.slice(start, SOURCE.indexOf("async (", start));
  return head
    .slice(head.indexOf('",') + 2)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const LIVE_CONTROL = ["requireLiveEnabled", "requireAuth", "requireOrganizer", "requireOwnSession", "requireLiveForSession"];

test("every Live control route: flag first (404 before auth), then owner, then Live for this session", () => {
  const routes: [string, string, string[]][] = [
    ["post", "/sessions/:id/go-live", []],
    ["post", "/sessions/:id/rounds/generate", []],
    ["post", "/sessions/:id/rounds/current/redo", []],
    ["get", "/sessions/:id/rounds/current", []],
    ["post", "/sessions/:id/matches/:matchId/start", ["requireMatchInSession"]],
    ["post", "/sessions/:id/matches/:matchId/not-played", ["requireMatchInSession"]],
    ["post", "/sessions/:id/matches/:matchId/score", ["requireMatchInSession"]],
    ["post", "/sessions/:id/registrations/:registrationId/live-status", ["requireRegistrationInSession"]],
  ];
  for (const [method, route, extra] of routes) {
    assert.deepEqual(guardsOf(method, route), [...LIVE_CONTROL, ...extra], `${method.toUpperCase()} ${route}`);
  }
});

test("kill switch never hides history or strands a live session: reads and finish are not behind the flag", () => {
  for (const [method, route] of [["get", "/sessions/:id/rounds"], ["get", "/sessions/:id/leaderboard"], ["post", "/sessions/:id/finish"]]) {
    assert.ok(!guardsOf(method, route).includes("requireLiveEnabled"), `${method.toUpperCase()} ${route}`);
  }
});

test("after Finish the roster is frozen: check-in, remove and waitlist check the session before the registration", () => {
  for (const [method, route] of [
    ["post", "/sessions/:id/checkin/:registrationId"],
    ["delete", "/sessions/:id/registrations/:registrationId"],
    ["post", "/sessions/:id/registrations/:registrationId/waitlist"],
  ]) {
    assert.deepEqual(guardsOf(method, route), ["requireAuth", "requireOrganizer", "requireOwnSession", "requireRosterOpen", "requireRegistrationInSession"], `${method.toUpperCase()} ${route}`);
  }
});

test("cancel, archive and results follow the shared rules (shared/sessionActions.ts)", () => {
  assert.match(SOURCE, /canCancelSession\(thisSession\.status\)/);
  assert.match(SOURCE, /canArchiveSession\(thisSession\.status\)/);
  assert.match(SOURCE, /resultsAreFinal\(session\.status\)/);
});

test("Live stays request/response: no WebSockets or Supabase Realtime", () => {
  assert.doesNotMatch(SOURCE, /WebSocket|\.channel\(|realtime/i);
});
