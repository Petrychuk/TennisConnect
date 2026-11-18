import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXCEPTIONS,
  AuditReportError,
  evaluate,
  main,
  parseReportText,
  validateReport,
} from "./audit-gate.mjs";

const PICOMATCH = "GHSA-fc5q-39xc-vjpf";
const advisory = (name, ghsa, severity = "high") => ({
  source: 1000,
  name,
  dependency: name,
  title: `${name} advisory`,
  url: `https://github.com/advisories/${ghsa}`,
  severity,
  range: "<=1.0.0",
});

/** Build an npm-audit-v2-shaped report; metadata counts are derived. */
function report(vulnerabilities) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const v of Object.values(vulnerabilities)) {
    counts[v.severity] += 1;
    counts.total += 1;
  }
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
}
const entry = (severity, via) => ({ name: "x", severity, isDirect: false, via, effects: [], range: "*", nodes: [], fixAvailable: false });

/** The real shape of the current finding: 1 advisory + 3 propagated entries. */
const picomatchChain = () => ({
  picomatch: entry("high", [advisory("picomatch", PICOMATCH)]),
  fdir: entry("high", ["picomatch"]),
  tinyglobby: entry("high", ["fdir", "picomatch"]),
  vite: entry("high", ["fdir", "picomatch", "tinyglobby"]),
});

const BEFORE = new Date("2026-11-18T12:00:00Z");

test("exception: exactly one advisory, review deadline 2026-12-02", () => {
  assert.deepEqual(EXCEPTIONS.map((e) => [e.ghsa, e.expiresOn]), [[PICOMATCH, "2026-12-02"]]);
});

// ---------------------------------------------------------------- allowed
test("allowed: only the excepted advisory (and its propagated entries) passes", () => {
  const r = evaluate(report(picomatchChain()), { now: BEFORE });
  assert.equal(r.ok, true);
  assert.deepEqual(r.excused.map((x) => x.name).sort(), ["fdir", "picomatch", "tinyglobby", "vite"]);
  assert.deepEqual(r.blocked, []);
});

test("allowed: a clean report and sub-threshold findings pass", () => {
  assert.equal(evaluate(report({}), { now: BEFORE }).ok, true);
  const low = report({ esbuild: entry("moderate", [advisory("esbuild", "GHSA-67mh-4wv8-2f99", "moderate")]) });
  assert.equal(evaluate(low, { now: BEFORE }).ok, true);
});

// ---------------------------------------------------------------- blocked
test("blocked: a different high advisory still fails CI", () => {
  const r = evaluate(
    report({ ...picomatchChain(), lodash: entry("high", [advisory("lodash", "GHSA-aaaa-bbbb-cccc")]) }),
    { now: BEFORE },
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.blocked.map((x) => x.name), ["lodash"]);
});

test("blocked: a critical advisory fails CI", () => {
  const r = evaluate(report({ evil: entry("critical", [advisory("evil", "GHSA-xxxx-yyyy-zzzz", "critical")]) }), { now: BEFORE });
  assert.equal(r.ok, false);
});

test("blocked: a package carrying the excepted AND another advisory is not excused", () => {
  const vite = entry("high", ["picomatch", advisory("vite", "GHSA-1111-2222-3333")]);
  const r = evaluate(report({ ...picomatchChain(), vite }), { now: BEFORE });
  assert.deepEqual(r.blocked.map((x) => x.name), ["vite"]);
  assert.deepEqual(r.excused.map((x) => x.name).sort(), ["fdir", "picomatch", "tinyglobby"]);
});

test("blocked: propagation from a package with another advisory is followed", () => {
  const r = evaluate(
    report({
      pkgA: entry("high", [advisory("pkgA", "GHSA-aaaa-aaaa-aaaa")]),
      consumer: entry("high", ["pkgA"]),
    }),
    { now: BEFORE },
  );
  assert.deepEqual(r.blocked.map((x) => x.name).sort(), ["consumer", "pkgA"]);
});

test("blocked: an advisory with no recognisable GHSA id, or a dangling via, fails closed", () => {
  const noUrl = { ...advisory("odd", PICOMATCH), url: "https://example.com/not-an-advisory" };
  assert.equal(evaluate(report({ odd: entry("high", [noUrl]) }), { now: BEFORE }).ok, false);
  assert.equal(evaluate(report({ a: entry("high", ["ghost"]) }), { now: BEFORE }).ok, false);
});

test("blocked: the exception is matched by id, not by a look-alike", () => {
  const r = evaluate(report({ p: entry("high", [advisory("p", "GHSA-fc5q-39xc-vjpg")]) }), { now: BEFORE });
  assert.equal(r.ok, false);
});

test("blocked: propagation cycles terminate", () => {
  const r = evaluate(report({ a: entry("high", ["b"]), b: entry("high", ["a"]) }), { now: BEFORE });
  assert.equal(r.ok, false);
});

// ---------------------------------------------------------------- expired
test("expired: the exception stops applying at 00:00 UTC on 2026-12-02", () => {
  const chain = report(picomatchChain());
  assert.equal(evaluate(chain, { now: new Date("2026-12-01T23:59:59Z") }).ok, true);
  const at = evaluate(chain, { now: new Date("2026-12-02T00:00:00Z") });
  assert.equal(at.ok, false);
  assert.equal(at.blocked.length, 4);
  assert.deepEqual(at.expired.map((e) => e.ghsa), [PICOMATCH]);
  assert.equal(evaluate(chain, { now: new Date("2027-01-01T00:00:00Z") }).ok, false);
});

test("expired: an invalid expiry date in the exception list is rejected", () => {
  const bad = [{ ghsa: PICOMATCH, expiresOn: "soon", reason: "x" }];
  assert.throws(() => evaluate(report(picomatchChain()), { now: BEFORE, exceptions: bad }), AuditReportError);
});

// -------------------------------------------------------------- malformed
test("malformed: unusable audit output is rejected", () => {
  for (const text of ["", "   ", "not json", "{", "null", "[]", '"str"', "42"]) {
    assert.throws(() => parseReportText(text), AuditReportError, JSON.stringify(text));
  }
});

test("malformed: npm error payloads and wrong versions are rejected", () => {
  const npmError = JSON.stringify({ message: "403 host is not on the allow list", error: { code: "E403", summary: "403" } });
  assert.throws(() => parseReportText(npmError), /returned an error/);
  assert.throws(() => validateReport({ ...report({}), auditReportVersion: 1 }), /auditReportVersion/);
  const { auditReportVersion, ...noVersion } = report({});
  assert.throws(() => validateReport(noVersion), /auditReportVersion/);
});

test("malformed: missing sections, bad severities and bad via lists are rejected", () => {
  const ok = report(picomatchChain());
  assert.throws(() => validateReport({ ...ok, vulnerabilities: undefined }), /vulnerabilities/);
  assert.throws(() => validateReport({ ...ok, metadata: undefined }), /metadata/);
  assert.throws(() => validateReport({ ...ok, metadata: { vulnerabilities: { ...ok.metadata.vulnerabilities, high: "4" } } }), /not a number/);
  assert.throws(() => validateReport(report({ a: entry("catastrophic", []) })), /unknown severity/);
  assert.throws(() => validateReport(report({ a: { ...entry("high", []), via: "picomatch" } })), /via/);
  assert.throws(() => validateReport(report({ a: entry("high", [42]) })), /via/);
});

test("malformed: a truncated report (fewer entries than npm's own counts) is rejected", () => {
  const full = report(picomatchChain());
  const { vite, ...truncated } = full.vulnerabilities;
  assert.throws(() => validateReport({ ...full, vulnerabilities: truncated }), /incomplete report/);
  // Hiding a finding by relabelling its severity is caught by the same check.
  const relabelled = { ...full, vulnerabilities: { ...full.vulnerabilities, vite: entry("low", ["picomatch"]) } };
  assert.throws(() => validateReport(relabelled), /incomplete report/);
});

// -------------------------------------------------------------------- CLI
const run = (spawn, extra = {}) => {
  const lines = [];
  const code = main({ argv: [], spawn, now: BEFORE, log: (l) => lines.push(l), ...extra });
  return { code, out: lines.join("\n") };
};
const spawnReturning = (status, stdout) => () => ({ status, stdout, stderr: "" });

test("cli: npm's exit code 1 (vulnerabilities found) is fine when the JSON is valid and excepted", () => {
  const r = run(spawnReturning(1, JSON.stringify(report(picomatchChain()))));
  assert.equal(r.code, 0);
  assert.match(r.out, /exception in effect: GHSA-fc5q-39xc-vjpf until 2026-12-02/);
});

test("cli: a non-excepted high finding exits 1", () => {
  const r = run(spawnReturning(1, JSON.stringify(report({ lodash: entry("high", [advisory("lodash", "GHSA-aaaa-bbbb-cccc")]) }))));
  assert.equal(r.code, 1);
  assert.match(r.out, /BLOCKED\s+high\s+lodash/);
});

test("cli: expiry is reported and blocks", () => {
  const r = run(spawnReturning(1, JSON.stringify(report(picomatchChain()))), { now: new Date("2026-12-02T00:00:00Z") });
  assert.equal(r.code, 1);
  assert.match(r.out, /EXCEPTION EXPIRED/);
});

test("cli: fails closed when npm audit cannot run, errors, or returns garbage", () => {
  assert.equal(run(() => ({ error: new Error("spawn npm ENOENT") })).code, 2);
  assert.equal(run(spawnReturning(1, "")).code, 2);
  assert.equal(run(spawnReturning(0, "<html>502 Bad Gateway</html>")).code, 2);
  assert.equal(run(spawnReturning(1, JSON.stringify({ message: "403", error: { summary: "403" } }))).code, 2);
  assert.equal(run(spawnReturning(0, '{"auditReportVersion":2,"vulnerabilities":{}}')).code, 2);
});

test("cli: --report reads a saved file and an unreadable file fails closed", () => {
  const good = main({ argv: ["--report", "r.json"], readFile: () => JSON.stringify(report({})), now: BEFORE, log: () => {} });
  assert.equal(good, 0);
  const missing = main({ argv: ["--report", "nope.json"], readFile: () => { throw new Error("ENOENT"); }, now: BEFORE, log: () => {} });
  assert.equal(missing, 2);
});
