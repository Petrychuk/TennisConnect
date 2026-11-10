import assert from "node:assert/strict";
import test from "node:test";
import { internalTestEmails, isInternalTestUser, liveAllowedFor, liveMode, parseLiveMode } from "./liveFeature";

test("TC_LIVE_ENABLED is off unless explicitly enabled", () => {
  for (const raw of [undefined, "", "false", "0", "no", "off", "yes please", "TRUEISH"]) {
    assert.equal(parseLiveMode(raw), "off", String(raw));
  }
  for (const raw of ["true", "TRUE", " 1 ", "on"]) assert.equal(parseLiveMode(raw), "on", raw);
  assert.equal(parseLiveMode("Internal"), "internal");
  // DB_ENV no longer decides anything: Staging needs TC_LIVE_ENABLED too.
  assert.equal(liveMode({ DB_ENV: "staging" }), "off");
});

test("liveAllowedFor: off blocks everything, internal only internal test sessions, on everything", () => {
  const real = { isInternalTest: false };
  const internal = { isInternalTest: true };
  assert.equal(liveAllowedFor(real, {}), false);
  assert.equal(liveAllowedFor(internal, {}), false, "off is a kill switch for internal sessions too");
  assert.equal(liveAllowedFor(real, { TC_LIVE_ENABLED: "internal" }), false);
  assert.equal(liveAllowedFor(internal, { TC_LIVE_ENABLED: "internal" }), true);
  assert.equal(liveAllowedFor({}, { TC_LIVE_ENABLED: "internal" }), false, "missing marker = not internal");
  assert.equal(liveAllowedFor(real, { TC_LIVE_ENABLED: "true" }), true);
});

test("internal test accounts: exact, case-insensitive list per environment", () => {
  const env = { TC_INTERNAL_TEST_EMAILS: " Live-Organiser@TennisConnect.test, live-player-1@tennisconnect.test,," };
  assert.deepEqual([...internalTestEmails(env)], ["live-organiser@tennisconnect.test", "live-player-1@tennisconnect.test"]);
  assert.equal(isInternalTestUser("LIVE-organiser@tennisconnect.test", env), true);
  assert.equal(isInternalTestUser("organiser@tennisconnect.test", env), false, "no substring matches");
  assert.equal(isInternalTestUser(null, env), false);
  assert.equal(isInternalTestUser("live-organiser@tennisconnect.test", {}), false);
});
