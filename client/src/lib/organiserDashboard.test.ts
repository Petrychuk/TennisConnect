import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  UNAVAILABLE,
  attendanceTileValue,
  countLive,
  countTileValue,
  countUpcoming7Days,
  failedSources,
  failureMessage,
  formatAttendance,
  isNewOrganiser,
  normaliseAttendance,
  sourceStatus,
} from "./organiserDashboard";

const NOW = Date.parse("2026-11-05T00:00:00Z");
const inDays = (d: number) => new Date(NOW + d * 86400000).toISOString();

test("sourceStatus separates loading, error and ready; a failed refetch keeps the data it had", () => {
  assert.equal(sourceStatus({ isError: false, data: undefined }), "loading");
  assert.equal(sourceStatus({ isError: true, data: undefined }), "error");
  assert.equal(sourceStatus({ isError: false, data: [] }), "ready"); // empty is ready, not an error
  assert.equal(sourceStatus({ isError: true, data: [1] }), "ready");
});

test("count tiles show 0 for real zeros, a skeleton while loading, and a dash only on failure", () => {
  assert.equal(countTileValue("ready", 0), "0");
  assert.equal(countTileValue("ready", 7), "7");
  assert.equal(countTileValue("ready", undefined), "0");
  assert.equal(countTileValue("loading", 0), null);
  assert.equal(countTileValue("error", 3), UNAVAILABLE);
});

test("attendance shows a dash when no percentage can be calculated, and a real 0% stays 0%", () => {
  assert.equal(formatAttendance(null), "—");
  assert.equal(formatAttendance(undefined), "—");
  assert.equal(formatAttendance(Number.NaN), "—");
  assert.equal(formatAttendance(0), "0%");
  assert.equal(formatAttendance(86), "86%");
  assert.equal(normaliseAttendance(140), 100);
  assert.equal(normaliseAttendance(-5), 0);
  assert.equal(attendanceTileValue("ready", null), "—");
  assert.equal(attendanceTileValue("ready", 67), "67%");
  assert.equal(attendanceTileValue("loading", 67), null);
  assert.equal(attendanceTileValue("error", 67), "—");
});

test("live and upcoming counts", () => {
  const sessions = [
    { status: "live", startAt: inDays(0) },
    { status: "published", startAt: inDays(2) },
    { status: "published", startAt: inDays(7) },
    { status: "published", startAt: inDays(8) }, // outside 7 days
    { status: "published", startAt: inDays(-1) }, // already started
    { status: "draft", startAt: inDays(1) },
  ];
  assert.equal(countLive(sessions), 1);
  assert.equal(countUpcoming7Days(sessions, NOW), 2);
  assert.equal(countLive([]), 0);
  assert.equal(countUpcoming7Days([], NOW), 0);
});

test("a new organiser is only 'new' once the sessions request succeeded with nothing in it", () => {
  assert.equal(isNewOrganiser("ready", []), true);
  assert.equal(isNewOrganiser("ready", [{}]), false);
  assert.equal(isNewOrganiser("loading", undefined), false);
  assert.equal(isNewOrganiser("error", undefined), false); // a failure must not look like an empty account
});

test("warnings name only the sources that failed; loading and empty are never failures", () => {
  assert.deepEqual(failedSources({ sessions: "loading", stats: "ready", activity: "ready" }), []);
  assert.deepEqual(failedSources({ sessions: "error", stats: "ready", activity: "error" }), ["sessions", "activity"]);
  assert.equal(failureMessage([]), "");
  assert.equal(failureMessage(["sessions"]), "We couldn't load your sessions.");
  assert.equal(failureMessage(["sessions", "stats"]), "We couldn't load your sessions and player statistics.");
  assert.equal(failureMessage(["sessions", "stats", "activity"]), "We couldn't load your sessions, player statistics and recent activity.");
});

test("the dashboard wires these rules and keeps each section independent (source check)", () => {
  const src = readFileSync(new URL("../components/organiser/dashboard/organiser-dashboard.tsx", import.meta.url), "utf8");
  for (const name of ["sourceStatus", "countTileValue", "attendanceTileValue", "failedSources", "isNewOrganiser", "DashboardWarning", "WelcomeEmptyState"]) {
    assert.match(src, new RegExp(name), `${name} used`);
  }
  assert.doesNotMatch(src, /dataError/, "no catch-all error flag");
  assert.doesNotMatch(src, /attendancePercent\}%/, "attendance is formatted by formatAttendance, not string-concatenated");
});

test("the server reports no percentage as null, not 0", () => {
  const storage = readFileSync(new URL("../../../server/storage.ts", import.meta.url), "utf8");
  assert.match(storage, /registered > 0 \? Math\.round\(\(checkedIn \/ registered\) \* 100\) : null/);
  const route = readFileSync(new URL("../../../server/routes/organizer.ts", import.meta.url), "utf8");
  assert.match(route, /attendancePercent: null/);
});
