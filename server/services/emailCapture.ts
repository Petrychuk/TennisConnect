// Staging-only email interception (server/services/emailService.ts).
//
// On Staging, every outgoing email is CAPTURED in memory instead of being
// delivered through Resend, so automated regression can never email a real
// person, and tests can still read verification/reset links through the
// secret-protected test hook (POST /api/test-hooks/emails).
//
// Transport rules (resolveEmailTransport):
//   DB_ENV=production          -> "resend", always. EMAIL_TRANSPORT is
//                                 ignored, so Production delivery can't be
//                                 switched off (or on) by this mechanism.
//   EMAIL_TRANSPORT=resend     -> "resend" (explicit opt-out elsewhere)
//   EMAIL_TRANSPORT=capture    -> "capture"
//   DB_ENV=staging (unset)     -> "capture"  <- Staging default, EXCEPT
//                                 recipients on STAGING_EMAIL_ALLOWLIST
//                                 (real team addresses for manual testing,
//                                 e.g. password reset) -> "resend"
//   anything else (local dev)  -> "resend"   (unchanged behaviour)
//
// STAGING_EMAIL_ALLOWLIST: comma/space separated exact addresses
// ("anna@gmail.com") and/or whole domains ("@tennisconnect.com.au").
// Applies on Staging only, never overrides EMAIL_TRANSPORT=capture, and
// never matches the reserved test domain - automated test accounts
// (@tennisconnect.test) are always captured.
//
// Storage is in-process memory (decided 24 Oct 2026): no migration, lost on
// restart, assumes a single Staging instance. Bounded by count and age.
//
// Deliberately free of storage/env imports so it is unit-testable
// (server/services/emailCapture.test.ts).

export type EmailTransport = "resend" | "capture";

export function resolveEmailTransport(source: {
  dbEnv: string | undefined;
  configured: string | undefined;
  /** The single recipient of this email (allowlist check on Staging). */
  recipient?: string;
  /** STAGING_EMAIL_ALLOWLIST. */
  allowlist?: string;
}): EmailTransport {
  const dbEnv = (source.dbEnv ?? "").trim().toLowerCase();
  const configured = (source.configured ?? "").trim().toLowerCase();

  if (dbEnv === "production") return "resend";
  if (configured === "resend") return "resend";
  if (configured === "capture") return "capture";
  if (dbEnv === "staging") {
    return isAllowlistedRecipient(source.recipient, source.allowlist) ? "resend" : "capture";
  }
  return "resend";
}

const RESERVED_TEST_DOMAIN = "tennisconnect.test";
const ADDRESS = /^[^\s@,;:<>()[\]"']+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/;
const DOMAIN_ENTRY = /^@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/;

const isReservedTestDomain = (domain: string) =>
  domain === RESERVED_TEST_DOMAIN || domain.endsWith(`.${RESERVED_TEST_DOMAIN}`);

/** Parsed STAGING_EMAIL_ALLOWLIST: exact addresses and "@domain" entries. Invalid entries are ignored. */
export function parseEmailAllowlist(value: string | undefined): { addresses: Set<string>; domains: Set<string> } {
  const addresses = new Set<string>();
  const domains = new Set<string>();
  for (const raw of (value ?? "").split(/[\s,;]+/)) {
    const entry = raw.trim().toLowerCase();
    if (!entry) continue;
    const domain = entry.match(DOMAIN_ENTRY)?.[1];
    if (domain) {
      if (!isReservedTestDomain(domain)) domains.add(domain);
      continue;
    }
    const addressDomain = entry.match(ADDRESS)?.[1];
    if (addressDomain && !isReservedTestDomain(addressDomain)) addresses.add(entry);
  }
  return { addresses, domains };
}

/** True only for ONE well-formed recipient listed (or whose domain is listed) on the allowlist. */
export function isAllowlistedRecipient(recipient: string | undefined, allowlist: string | undefined): boolean {
  if (!recipient || !allowlist) return false;
  const address = recipient.trim().toLowerCase();
  const domain = address.match(ADDRESS)?.[1];
  if (!domain || isReservedTestDomain(domain)) return false;
  const { addresses, domains } = parseEmailAllowlist(allowlist);
  return addresses.has(address) || domains.has(domain);
}

export interface CapturedEmail {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  links: string[];
  capturedAt: number;
}

export interface CapturedEmailQuery {
  to: string;
  subjectContains?: string;
  sinceMs?: number;
  limit?: number;
}

const URL_PATTERN = /https?:\/\/[^\s"'<>)]+/g;

export function extractLinks(text: string): string[] {
  return Array.from(new Set(text.match(URL_PATTERN) ?? []));
}

function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

export class CapturedEmailStore {
  private entries: CapturedEmail[] = [];
  private counter = 0;

  constructor(
    private readonly maxEntries = 500,
    private readonly maxAgeMs = 60 * 60 * 1000,
    private readonly now: () => number = Date.now
  ) {}

  add(email: { to: string; subject: string; text: string; html: string }): CapturedEmail {
    this.prune();
    const captured: CapturedEmail = {
      id: `${this.now().toString(36)}-${(this.counter++).toString(36)}`,
      to: normaliseAddress(email.to),
      subject: email.subject,
      text: email.text,
      html: email.html,
      links: extractLinks(email.text),
      capturedAt: this.now(),
    };
    this.entries.push(captured);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    return captured;
  }

  /** Newest first. Exact recipient match only - never a pattern. */
  query(query: CapturedEmailQuery): CapturedEmail[] {
    this.prune();
    const to = normaliseAddress(query.to);
    const subject = query.subjectContains?.toLowerCase();
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);

    return this.entries
      .filter(entry => entry.to === to)
      .filter(entry => query.sinceMs === undefined || entry.capturedAt >= query.sinceMs)
      .filter(entry => subject === undefined || entry.subject.toLowerCase().includes(subject))
      .reverse()
      .slice(0, limit);
  }

  size(): number {
    this.prune();
    return this.entries.length;
  }

  private prune() {
    const cutoff = this.now() - this.maxAgeMs;
    if (this.entries.length > 0 && this.entries[0].capturedAt < cutoff) {
      this.entries = this.entries.filter(entry => entry.capturedAt >= cutoff);
    }
  }
}

/** The single process-wide store used by emailService and the test hook. */
export const capturedEmails = new CapturedEmailStore();
