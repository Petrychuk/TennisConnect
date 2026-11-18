#!/usr/bin/env node
/**
 * Dependency audit gate for CI.
 *
 * Runs `npm audit --json` and fails on every high/critical advisory EXCEPT the
 * explicitly listed, time-boxed exceptions below. It exists because `npm audit`
 * has no built-in per-advisory ignore, and one advisory (picomatch ReDoS) has no
 * patched release yet. See docs/SECURITY_EXCEPTIONS.md.
 *
 * Fail closed: an audit that errors, is unreachable, or returns invalid or
 * incomplete JSON fails the gate (exit 2). It never passes on "no information".
 *
 * Exit codes: 0 = pass, 1 = blocked by findings, 2 = audit failed / invalid report.
 *
 * Usage:
 *   node scripts/audit-gate.mjs                 # runs `npm audit --json`
 *   node scripts/audit-gate.mjs --report f.json # evaluates a saved report
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Exceptions. Adding or extending one needs explicit approval - see the doc.
// An exception matches ONE advisory id and stops applying on `expiresOn`
// (00:00 UTC of that date), so the review deadline forces a decision.
// ---------------------------------------------------------------------------
export const EXCEPTIONS = [
  {
    ghsa: "GHSA-fc5q-39xc-vjpf",
    expiresOn: "2026-12-02",
    reason:
      "picomatch <=4.0.7 ReDoS (dev-only, via vite/tinyglobby/fdir); no patched release exists yet",
  },
];

export const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const BLOCKING = new Set(["high", "critical"]);
const GHSA_RE = /(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\/?$/i;

export class AuditReportError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuditReportError";
  }
}

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse raw `npm audit --json` text. Throws AuditReportError if unusable. */
export function parseReportText(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new AuditReportError("npm audit produced no output");
  }
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    throw new AuditReportError("npm audit output is not valid JSON");
  }
  validateReport(report);
  return report;
}

/** Structural + completeness checks. Throws AuditReportError on any doubt. */
export function validateReport(report) {
  if (!isObject(report)) throw new AuditReportError("audit report is not a JSON object");
  if ("error" in report) {
    const e = report.error;
    const detail = report.message ?? (isObject(e) ? (e.summary ?? e.code) : e) ?? "unknown";
    throw new AuditReportError(`npm audit returned an error: ${String(detail)}`);
  }
  if (report.auditReportVersion !== 2) {
    throw new AuditReportError("unsupported or missing auditReportVersion (expected 2)");
  }
  const vulns = report.vulnerabilities;
  if (!isObject(vulns)) throw new AuditReportError("report has no vulnerabilities object");
  const counts = report.metadata?.vulnerabilities;
  if (!isObject(counts)) throw new AuditReportError("report has no metadata.vulnerabilities counts");
  for (const key of [...SEVERITIES, "total"]) {
    if (!Number.isInteger(counts[key]) || counts[key] < 0) {
      throw new AuditReportError(`metadata.vulnerabilities.${key} is missing or not a number`);
    }
  }

  const seen = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const [name, v] of Object.entries(vulns)) {
    if (!isObject(v)) throw new AuditReportError(`vulnerability "${name}" is malformed`);
    if (!SEVERITIES.includes(v.severity)) {
      throw new AuditReportError(`vulnerability "${name}" has unknown severity "${v.severity}"`);
    }
    if (!Array.isArray(v.via)) throw new AuditReportError(`vulnerability "${name}" has no via list`);
    for (const via of v.via) {
      if (typeof via !== "string" && !isObject(via)) {
        throw new AuditReportError(`vulnerability "${name}" has a malformed via entry`);
      }
    }
    seen[v.severity] += 1;
  }
  // Completeness: the listed entries must match npm's own totals, so a
  // truncated or tampered report cannot hide findings.
  for (const s of SEVERITIES) {
    if (seen[s] !== counts[s]) {
      throw new AuditReportError(
        `incomplete report: ${seen[s]} ${s} entries listed but metadata says ${counts[s]}`,
      );
    }
  }
  if (Object.keys(vulns).length !== counts.total) {
    throw new AuditReportError("incomplete report: entry count differs from metadata total");
  }
}

function ghsaFromUrl(url) {
  if (typeof url !== "string") return null;
  const m = GHSA_RE.exec(url);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Root advisories behind a package entry. A `via` string is a propagation from
 * another vulnerable package (followed); a `via` object is a real advisory.
 * Anything that cannot be identified yields a unique "unidentified:" id, which
 * never matches an exception - so it blocks.
 */
function advisoryIds(name, vulns, path = new Set()) {
  const ids = new Set();
  if (path.has(name)) return ids;
  const entry = vulns[name];
  if (!entry) return new Set([`unidentified:missing-package:${name}`]);
  path.add(name);
  for (const via of entry.via) {
    if (typeof via === "string") {
      for (const id of advisoryIds(via, vulns, path)) ids.add(id);
    } else {
      ids.add(ghsaFromUrl(via.url) ?? `unidentified:${via.name ?? name}:${via.title ?? via.source ?? "?"}`);
    }
  }
  path.delete(name);
  return ids;
}

function expiryOf(exception) {
  const t = Date.parse(`${exception.expiresOn}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresOn) || Number.isNaN(t)) {
    throw new AuditReportError(`exception ${exception.ghsa} has an invalid expiresOn`);
  }
  return t;
}

/**
 * Evaluate a validated report. Pure: `now` and `exceptions` are injectable.
 * @returns {{ok:boolean, blocked:object[], excused:object[], expired:object[], active:object[]}}
 */
export function evaluate(report, { now = new Date(), exceptions = EXCEPTIONS } = {}) {
  validateReport(report);
  const active = [];
  const expired = [];
  for (const ex of exceptions) {
    (now.getTime() >= expiryOf(ex) ? expired : active).push(ex);
  }
  const allowed = new Set(active.map((e) => e.ghsa.toLowerCase()));

  const blocked = [];
  const excused = [];
  for (const [name, v] of Object.entries(report.vulnerabilities)) {
    if (!BLOCKING.has(v.severity)) continue;
    const ids = [...advisoryIds(name, report.vulnerabilities)].sort();
    const row = { name, severity: v.severity, advisories: ids };
    (ids.length > 0 && ids.every((id) => allowed.has(id)) ? excused : blocked).push(row);
  }
  return { ok: blocked.length === 0, blocked, excused, expired, active };
}

function runNpmAudit(spawn = spawnSync) {
  const res = spawn("npm", ["audit", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32", // npm is npm.cmd on Windows
  });
  if (res.error) throw new AuditReportError(`could not run npm audit: ${res.error.message}`);
  // npm exits 1 when it finds vulnerabilities, so the exit code alone says
  // nothing; the JSON is validated instead (and error payloads are rejected).
  return String(res.stdout ?? "");
}

/** CLI entry. Returns the process exit code. Dependencies are injectable. */
export function main({ argv = process.argv.slice(2), spawn, now = new Date(), log = console.log, readFile = readFileSync } = {}) {
  try {
    const i = argv.indexOf("--report");
    const text = i >= 0 ? String(readFile(argv[i + 1], "utf8")) : runNpmAudit(spawn);
    const report = parseReportText(text);
    const r = evaluate(report, { now });

    for (const e of r.expired) {
      log(`EXCEPTION EXPIRED ${e.ghsa} (expired ${e.expiresOn}) - no longer applied; review required`);
    }
    for (const e of r.active) {
      log(`exception in effect: ${e.ghsa} until ${e.expiresOn} - ${e.reason}`);
    }
    for (const x of r.excused) log(`  excused  ${x.severity.padEnd(8)} ${x.name}  [${x.advisories.join(", ")}]`);
    for (const x of r.blocked) log(`  BLOCKED  ${x.severity.padEnd(8)} ${x.name}  [${x.advisories.join(", ")}]`);

    if (!r.ok) {
      log(`audit gate FAILED: ${r.blocked.length} high/critical finding(s) not covered by an active exception`);
      return 1;
    }
    log(`audit gate passed (${r.excused.length} excused by exception)`);
    return 0;
  } catch (err) {
    log(`audit gate FAILED CLOSED: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
