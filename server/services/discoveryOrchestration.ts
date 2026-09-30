import { createHash } from "node:crypto";
import { storage } from "../storage";
import { callExtractionLLM, classifyConfidence, type ExtractedActivity } from "./discoveryExtraction";
import {
  normaliseAustralianState,
  resolveTimeZoneForState,
  resolveRegistrationUrl,
  validateDiscoveredDates,
  isSafeExternalUrl,
} from "./discoveryNormalization";
import { assessPage } from "./discoveryPageContent";
import { buildActivityRecord } from "./discoveryRecord";
import { computeDuplicateConfidence, DUPLICATE_REVIEW_THRESHOLD, type DuplicateCandidate } from "./discoveryDuplicateDetection";
import { resolveAustralianVenueCoordinates } from "./geocodingService";
import { initialDiscoveryStatus, initialFlagReasons } from "./discoveryQueue";
import { toLocalDateTime, isActivityFinished } from "./discoveryOccurrences";
import {
  isSameSourceEvent,
  diffTrackedFields,
  decideOnSeenAgain,
  decideOnMissing,
  decideOnSourceUnavailable,
  type ReviewStatus,
  type DiscoveryStatus,
} from "./discoveryFreshness";

// [PLAY][AI] TC Discovery Agent - orchestration (spec sections 4, 14,
// 22, 24-26, 29). Real fetch() calls to real pages plus a real model
// call: the one part of the Agent that can't be exercised without
// network access and an API key. Every DECISION it makes is delegated to
// a pure, unit-tested module (normalisation, duplicate scoring,
// occurrences, freshness, queue status) - this file only sequences them.
//
// Scope is deliberately controlled (spec sections 4 and 23): it reads
// only the pages an admin has listed on a source (baseUrl + extraUrls),
// never follows links, and never crawls.

type ExternalActivityRow = Awaited<ReturnType<typeof storage.getExternalActivitiesForSourcePage>>[number];
type SourceRow = Awaited<ReturnType<typeof storage.getDiscoverySources>>[number];

const MAX_PAGES_PER_SOURCE = 6;
const MAX_HTML_BYTES = 5_000_000;
const SCAN_INTERVAL_DAYS = 7; // how long after a real scan a source counts as due for a recheck

async function fetchPage(url: string): Promise<string> {
  if (!isSafeExternalUrl(url)) throw new Error("URL is not allowed");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TennisConnect Discovery Agent/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // A redirect must not have landed somewhere we wouldn't have fetched directly.
    if (res.url && !isSafeExternalUrl(res.url)) throw new Error("Redirected to a URL that is not allowed");
    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) throw new Error(`Unsupported content type: ${type}`);
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_HTML_BYTES) throw new Error("Page is too large");
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export interface DiscoveryRunOptions {
  /** DRY RUN (the default in the admin UI) discovers and extracts but
      never writes: counters then describe what WOULD happen. */
  isDryRun: boolean;
  targetCountry?: string;
  targetState?: string;
  targetCity?: string;
  targetSourceId?: string;
  /** Scheduled rechecks only: sources already scanned for real once and
      now due again. */
  dueOnly?: boolean;
}

export interface DiscoveryRunSummary {
  sourcesScanned: number;
  pagesChecked: number;
  eventsDiscovered: number;
  eventsValid: number;
  eventsNeedingReview: number;
  eventsCreated: number;
  eventsUpdated: number;
  duplicatesDetected: number;
  validationFailures: number;
  errors: { sourceId: string; sourceName: string; error: string }[];
}

let discoveryRunning = false;
export function isDiscoveryRunning(): boolean {
  return discoveryRunning;
}

/**
 * Marks activities whose date has passed as EXPIRED (spec section 14),
 * so they leave Play and the queue's live tabs. Safe to run any time.
 */
export async function sweepExpiredActivities(now: Date = new Date()): Promise<number> {
  const rows = await storage.getExternalActivitiesForExpirySweep();
  let expired = 0;
  for (const row of rows) {
    if (isActivityFinished(row, now)) {
      await storage.updateExternalActivity(row.id, { discoveryStatus: "EXPIRED" });
      expired++;
    }
  }
  return expired;
}

/**
 * Runs discovery across every enabled source matching the targeting
 * (spec section 22). One broken page or source never stops the rest
 * (spec section 26). See DiscoveryRunOptions for dry-run semantics.
 */
export async function runDiscovery(options: DiscoveryRunOptions): Promise<DiscoveryRunSummary> {
  if (discoveryRunning) throw new Error("A discovery run is already in progress");
  discoveryRunning = true;

  const summary: DiscoveryRunSummary = {
    sourcesScanned: 0,
    pagesChecked: 0,
    eventsDiscovered: 0,
    eventsValid: 0,
    eventsNeedingReview: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    duplicatesDetected: 0,
    validationFailures: 0,
    errors: [],
  };

  try {
    if (!options.isDryRun) {
      try {
        await sweepExpiredActivities();
      } catch (err: any) {
        console.log(JSON.stringify({ event: "discovery_sweep_error", error: err?.message }));
      }
    }

    const sources = await storage.getDiscoverySources({
      enabledOnly: true,
      country: options.targetCountry,
      state: options.targetState,
      city: options.targetCity,
      sourceId: options.targetSourceId,
      dueOnly: options.dueOnly,
    });

    for (const source of sources) {
      summary.sourcesScanned++;
      const pages = Array.from(new Set([source.baseUrl, ...((source.extraUrls as string[] | null) ?? [])])).slice(0, MAX_PAGES_PER_SOURCE);
      const hashes: Record<string, string> = { ...((source.pageHashes as Record<string, string> | null) ?? {}) };

      for (const pageUrl of pages) {
        try {
          await scanPage(source, pageUrl, options, summary, hashes);
        } catch (err: any) {
          summary.errors.push({
            sourceId: source.id,
            sourceName: pages.length > 1 ? `${source.name} (${pageUrl})` : source.name,
            error: err?.message ?? "Unknown error",
          });
          if (!options.isDryRun) await flagPageUnavailable(source.id, pageUrl);
        }
      }

      if (!options.isDryRun) {
        const now = new Date();
        const prunedHashes = Object.fromEntries(Object.entries(hashes).filter(([url]) => pages.includes(url)));
        await storage.updateDiscoverySource(source.id, {
          lastScanAt: now,
          nextScanAt: new Date(now.getTime() + SCAN_INTERVAL_DAYS * 86_400_000),
          pageHashes: prunedHashes,
        });
      }
    }
  } finally {
    discoveryRunning = false;
  }

  return summary;
}

async function scanPage(
  source: SourceRow,
  pageUrl: string,
  options: DiscoveryRunOptions,
  summary: DiscoveryRunSummary,
  hashes: Record<string, string>
): Promise<void> {
  const html = await fetchPage(pageUrl);
  summary.pagesChecked++;

  // Main readable content only (menus/footers/scripts don't spend the
  // 12,000-character budget), or a logged skip if the page needs
  // JavaScript to show its events - V1 doesn't render pages (spec 29).
  const assessment = assessPage(html);
  if (!assessment.supported) {
    console.log(JSON.stringify({ event: "discovery_page_unsupported", sourceId: source.id, pageUrl, reason: assessment.reason }));
    summary.errors.push({ sourceId: source.id, sourceName: source.name, error: `${assessment.reason} - ${pageUrl}` });
    return; // not a fetch failure: nothing is flagged, nothing is sent to the model
  }
  const pageText = assessment.text;
  const hash = sha256(pageText);

  const existingRows = await storage.getExternalActivitiesForSourcePage(source.id, pageUrl);

  // Cost control (spec section 29): a page whose text hasn't changed
  // since its last real scan isn't sent to the model again - everything
  // found on it is simply confirmed as still there. Dry runs always
  // extract, so an admin trying a source out sees real results.
  if (!options.isDryRun && hashes[pageUrl] === hash) {
    for (const row of existingRows) {
      await applySeenAgain(row, [], false, null);
    }
    return;
  }

  const extraction = await callExtractionLLM(pageText, pageUrl);
  if (!extraction) {
    // Unknown, not "nothing found" - so nothing is marked missing.
    summary.errors.push({ sourceId: source.id, sourceName: source.name, error: `Extraction failed for ${pageUrl}` });
    return;
  }
  summary.validationFailures += extraction.invalidCount;

  const seenIds = new Set<string>();
  for (const extracted of extraction.activities) {
    summary.eventsDiscovered++;
    await processActivity(source, pageUrl, extracted, existingRows, seenIds, options, summary);
  }

  if (!options.isDryRun) {
    await markMissing(existingRows, seenIds);
    hashes[pageUrl] = hash;
  }
}

/** The subset of a row's fields that freshness tracks. */
function trackedFromRow(row: ExternalActivityRow) {
  return {
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    startTime: row.startTime,
    endTime: row.endTime,
    recurrenceFrequency: row.recurrenceFrequency,
    recurrenceDayOfWeek: row.recurrenceDayOfWeek,
    venueName: row.venueName,
    suburb: row.suburb,
    price: row.price,
    registrationUrl: row.registrationUrl,
  };
}

async function processActivity(
  source: SourceRow,
  pageUrl: string,
  extracted: ExtractedActivity,
  existingRows: ExternalActivityRow[],
  seenIds: Set<string>,
  options: DiscoveryRunOptions,
  summary: DiscoveryRunSummary
): Promise<void> {
  // --- normalise (deterministic - the model only extracted wording) ---
  const built = buildActivityRecord(extracted, { sourceState: source.state, sourceCity: source.city, pageUrl });
  const { record, recurrence } = built;
  const { state, timeZone, registrationUrl } = record;
  const identity = {
    title: extracted.title,
    startDate: extracted.startDate,
    recurrenceDayOfWeek: recurrence?.dayOfWeek ?? null,
  };

  // Is this the same event we already found on this page last time?
  const match = existingRows.find((r) => !seenIds.has(r.id) && isSameSourceEvent(r, identity));
  if (match) seenIds.add(match.id);

  // --- cancelled by the source ---
  if (extracted.cancelled === true) {
    if (match) await applySeenAgain(match, [], true, null);
    return; // never create a new record for something already cancelled
  }

  // --- validate dates (spec section 8) ---
  const dateCheck = validateDiscoveredDates({
    startDate: extracted.startDate,
    endDate: extracted.endDate,
    startTime: extracted.startTime,
    endTime: extracted.endTime,
    isRecurring: !!recurrence,
    timeZone,
  });
  if (!dateCheck.valid) {
    if (match) await applySeenAgain(match, [], false, null); // still on the page - just not updated from a bad extraction
    else summary.validationFailures++;
    return;
  }
  summary.eventsValid++;

  const evidence: Record<string, string> = { ...(extracted.evidence ?? {}) };
  if (extracted.recurrenceText) evidence.recurrence = extracted.recurrenceText;

  // --- seen before: re-scan (spec section 14) ---
  if (match) {
    const changes = diffTrackedFields(trackedFromRow(match), record);
    const decision = decideOnSeenAgain({
      reviewStatus: match.reviewStatus as ReviewStatus,
      discoveryStatus: match.discoveryStatus as DiscoveryStatus,
      changes,
      cancelled: false,
    });
    if (decision.outcome === "updated") summary.eventsUpdated++;
    if (options.isDryRun) return;

    const coords = decision.applyFields
      ? await resolveAustralianVenueCoordinates({ suburb: record.suburb, city: record.city, state })
      : null;
    await applySeenAgain(match, changes, false, decision.applyFields ? { record, evidence, coords } : null, decision);
    return;
  }

  // --- new: duplicate check against other pages and real TC sessions ---
  const candidate: DuplicateCandidate = {
    title: extracted.title,
    venueName: extracted.venueName,
    suburb: extracted.suburb,
    startDate: extracted.startDate,
    startTime: extracted.startTime,
    recurrenceDayOfWeek: recurrence?.dayOfWeek ?? null,
    organiserName: extracted.organiserName,
    registrationUrl,
  };
  const otherExternal = await storage.getExternalActivitiesForDuplicateCheck({
    suburb: extracted.suburb,
    startDate: extracted.startDate,
    excludeSourceUrl: pageUrl,
  });
  const tcSessions = await storage.getPublicSessionsForDuplicateCheck({
    location: extracted.suburb ?? extracted.venueName,
    startDate: extracted.startDate,
  });

  let best: { confidence: number; externalId?: string; sessionId?: string } | null = null;
  for (const other of otherExternal) {
    const score = computeDuplicateConfidence(candidate, other);
    if (!best || score > best.confidence) best = { confidence: score, externalId: other.id };
  }
  for (const session of tcSessions) {
    // Compare LOCAL date/time - the stored instant is UTC.
    const local = toLocalDateTime(new Date(session.startAt), session.timeZone);
    const score = computeDuplicateConfidence(candidate, {
      title: session.title,
      venueName: session.location,
      startDate: local.date,
      startTime: local.time,
    });
    if (!best || score > best.confidence) best = { confidence: score, sessionId: session.id };
  }
  const isPossibleDuplicate = !!best && best.confidence >= DUPLICATE_REVIEW_THRESHOLD;
  if (isPossibleDuplicate) summary.duplicatesDetected++;

  const confidence = classifyConfidence(extracted);
  const flagInput = {
    confidence,
    isPossibleDuplicate,
    timeZoneKnown: !!timeZone,
    recurrenceUnderstood: built.recurrenceUnderstood,
  };
  const status = initialDiscoveryStatus(flagInput);
  if (status === "NEEDS_REVIEW") summary.eventsNeedingReview++;
  summary.eventsCreated++;
  if (options.isDryRun) return;

  const reasons = initialFlagReasons(flagInput);
  if (reasons.length) evidence._flag = reasons.join("; ");

  const coords = await resolveAustralianVenueCoordinates({ suburb: record.suburb, city: record.city, state });
  await storage.createExternalActivity({
    ...record,
    sourceId: source.id,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    sourceName: source.name,
    sourceUrl: pageUrl,
    discoveryStatus: status,
    confidence,
    // Always undecided at first. DUPLICATE is reserved for an admin's own
    // decision; a suspected duplicate shows in Needs Review with its
    // confidence badge (spec section 12: flag for review, don't delete).
    reviewStatus: "PENDING",
    duplicateOfExternalId: best?.externalId ?? null,
    duplicateOfSessionId: best?.sessionId ?? null,
    duplicateConfidence: isPossibleDuplicate ? best!.confidence : null,
    extractionEvidence: evidence,
  });
}

/**
 * Persists the outcome of seeing an already-known event again: always
 * refreshes lastCheckedAt (spec section 25), and applies whatever the
 * pure freshness decision says. `update` carries the newly extracted
 * values when the decision is to apply them.
 */
async function applySeenAgain(
  row: ExternalActivityRow,
  changes: ReturnType<typeof diffTrackedFields>,
  cancelled: boolean,
  update: { record: Record<string, unknown>; evidence: Record<string, string>; coords: { latitude: number; longitude: number } | null } | null,
  precomputed?: ReturnType<typeof decideOnSeenAgain>
): Promise<void> {
  const decision =
    precomputed ??
    decideOnSeenAgain({
      reviewStatus: row.reviewStatus as ReviewStatus,
      discoveryStatus: row.discoveryStatus as DiscoveryStatus,
      changes,
      cancelled,
    });

  const patch: Record<string, unknown> = { lastCheckedAt: new Date() };
  if (decision.applyFields && update) {
    Object.assign(patch, update.record);
    if (update.coords) {
      patch.latitude = update.coords.latitude;
      patch.longitude = update.coords.longitude;
    }
    patch.extractionEvidence = {
      ...((row.extractionEvidence as Record<string, string> | null) ?? {}),
      ...update.evidence,
      ...(decision.changeSummary ? { _changes: decision.changeSummary } : {}),
    };
  }
  if (decision.reviewStatus) {
    patch.reviewStatus = decision.reviewStatus;
    // Back to undecided - the previous approval covered the OLD values.
    patch.reviewedBy = null;
    patch.reviewedAt = null;
  }
  if (decision.discoveryStatus) patch.discoveryStatus = decision.discoveryStatus;

  await storage.updateExternalActivity(row.id, patch as any);
}

/** Events we knew about that weren't on a page we successfully read. */
async function markMissing(existingRows: ExternalActivityRow[], seenIds: Set<string>): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  for (const row of existingRows) {
    if (seenIds.has(row.id)) continue;
    const decision = decideOnMissing({
      reviewStatus: row.reviewStatus as ReviewStatus,
      discoveryStatus: row.discoveryStatus as DiscoveryStatus,
    });
    if (!decision) continue;
    await storage.updateExternalActivity(row.id, {
      discoveryStatus: decision.discoveryStatus,
      extractionEvidence: {
        ...((row.extractionEvidence as Record<string, string> | null) ?? {}),
        _flag: `Not found on the source page during the scan on ${today}`,
      },
    });
  }
}

/** The page couldn't be fetched - flag its healthy events, hide nothing. */
async function flagPageUnavailable(sourceId: string, pageUrl: string): Promise<void> {
  const rows = await storage.getExternalActivitiesForSourcePage(sourceId, pageUrl);
  for (const row of rows) {
    const decision = decideOnSourceUnavailable({
      reviewStatus: row.reviewStatus as ReviewStatus,
      discoveryStatus: row.discoveryStatus as DiscoveryStatus,
    });
    if (decision) await storage.updateExternalActivity(row.id, { discoveryStatus: decision.discoveryStatus });
  }
}
