import { storage } from "../storage";
import { callExtractionLLM, classifyConfidence } from "./discoveryExtraction";
import {
  normaliseLevelText,
  normaliseFormatText,
  resolveTimeZoneForState,
  validateActivityDates,
} from "./discoveryNormalization";
import { computeDuplicateConfidence, DUPLICATE_REVIEW_THRESHOLD, type DuplicateCandidate } from "./discoveryDuplicateDetection";
import { resolveCoordinates } from "./geocodingService";

// [PLAY][AI] TC Discovery Agent - orchestration (spec sections 4, 24,
// 26, 29). Real fetch() calls to actual external pages - this is the
// one piece of the whole Discovery Agent that genuinely cannot be
// exercised from this sandbox (no network access here at all), but it
// follows the exact same real-fetch pattern already proven working for
// the Anthropic and Nominatim calls elsewhere in this codebase.
//
// V1 scope, matching the spec's own "controlled pilot, not unrestricted
// crawling": one page per enabled source per run (the source's own
// baseUrl) - not a multi-page crawl of an entire site. Extending to
// multiple pages per source is a natural next step, not an
// architecture change.

const MAX_PAGE_TEXT_CHARS = 6000; // cost control (spec section 29) - a full page's raw text, not the whole HTML/scripts/styles, and capped

/** Strips tags/scripts/styles down to visible text - a real HTML
    parser would do better, but this needs no new dependency and is
    good enough for "give the model the page's actual content, not
    its markup". */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_TEXT_CHARS);
}

export interface DiscoveryRunOptions {
  isDryRun: boolean;
  targetCountry?: string;
  targetState?: string;
  targetCity?: string;
  targetSourceId?: string;
}

export interface DiscoveryRunSummary {
  sourcesScanned: number;
  pagesChecked: number;
  eventsDiscovered: number;
  eventsCreated: number;
  eventsUpdated: number;
  duplicatesDetected: number;
  validationFailures: number;
  errors: { sourceId: string; sourceName: string; error: string }[];
}

/**
 * Runs discovery across every enabled source matching the given
 * targeting (spec section 22). One broken source never stops the rest
 * (spec section 26) - each source's own try/catch records an error and
 * moves on. DRY RUN (the default, spec section 24) discovers/extracts
 * but never writes an external_activities row - only a real run
 * (isDryRun: false) persists anything.
 */
export async function runDiscovery(options: DiscoveryRunOptions): Promise<DiscoveryRunSummary> {
  const summary: DiscoveryRunSummary = {
    sourcesScanned: 0,
    pagesChecked: 0,
    eventsDiscovered: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    duplicatesDetected: 0,
    validationFailures: 0,
    errors: [],
  };

  const sources = await storage.getDiscoverySources({
    enabledOnly: true,
    country: options.targetCountry,
    state: options.targetState,
    city: options.targetCity,
    sourceId: options.targetSourceId,
  });

  for (const source of sources) {
    summary.sourcesScanned++;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let html: string;
      try {
        const res = await fetch(source.baseUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "TennisConnect Discovery Agent/1.0" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        html = await res.text();
      } finally {
        clearTimeout(timeout);
      }
      summary.pagesChecked++;

      const pageText = stripHtmlToText(html);
      if (!pageText) continue;

      const extracted = await callExtractionLLM(pageText, source.baseUrl);
      if (!extracted) continue;

      summary.eventsDiscovered++;

      const { activityType, gameFormat } = normaliseFormatText(
        [extracted.activityTypeText, extracted.gameFormatText, extracted.title].filter(Boolean).join(" ")
      );
      const normalisedLevel = normaliseLevelText(extracted.levelText);
      const timeZone = resolveTimeZoneForState(extracted.state ?? source.state);

      const dateCheck = validateActivityDates({
        startDate: extracted.startDate,
        endDate: extracted.endDate,
        startTime: extracted.startTime,
        endTime: extracted.endTime,
        timeZone,
      });
      // A recurring session with no specific next date is expected to
      // fail "missing_start_date" here - that's fine, it's valid via
      // recurrenceText instead, not a validation failure.
      if (!dateCheck.valid && dateCheck.reason !== "missing_start_date") {
        summary.validationFailures++;
        continue;
      }
      if (!dateCheck.valid && dateCheck.reason === "missing_start_date" && !extracted.recurrenceText) {
        summary.validationFailures++;
        continue;
      }

      const locationForGeocoding = extracted.suburb || extracted.city || extracted.venueName;
      const coords = await resolveCoordinates(locationForGeocoding);

      const confidence = classifyConfidence(extracted);

      // Duplicate check - against both existing external_activities and
      // real TennisConnect sessions (spec section 13: TC events always
      // take precedence over an external duplicate).
      const candidate: DuplicateCandidate = {
        title: extracted.title,
        venueName: extracted.venueName,
        suburb: extracted.suburb,
        startDate: extracted.startDate,
        startTime: extracted.startTime,
        organiserName: extracted.organiserName,
        registrationUrl: extracted.registrationUrl,
      };
      const existingExternal = await storage.getExternalActivitiesForDuplicateCheck({
        suburb: extracted.suburb,
        startDate: extracted.startDate,
      });
      const existingTcSessions = await storage.getPublicSessionsForDuplicateCheck({
        location: extracted.suburb,
        startDate: extracted.startDate,
      });

      let bestDuplicate: { confidence: number; externalId?: string; sessionId?: string } | null = null;
      for (const existing of existingExternal) {
        const score = computeDuplicateConfidence(candidate, {
          title: existing.title,
          venueName: existing.venueName,
          suburb: existing.suburb,
          startDate: existing.startDate,
          startTime: existing.startTime,
          organiserName: existing.organiserName,
          registrationUrl: existing.registrationUrl,
        });
        if (!bestDuplicate || score > bestDuplicate.confidence) bestDuplicate = { confidence: score, externalId: existing.id };
      }
      for (const session of existingTcSessions) {
        const score = computeDuplicateConfidence(candidate, {
          title: session.title,
          venueName: session.location,
          startDate: session.startAt?.slice(0, 10),
        });
        if (!bestDuplicate || score > bestDuplicate.confidence) bestDuplicate = { confidence: score, sessionId: session.id };
      }

      const isDuplicate = !!bestDuplicate && bestDuplicate.confidence >= DUPLICATE_REVIEW_THRESHOLD;
      // Spec section 13: an existing TC event always wins - a
      // duplicate of a real session is never eligible for auto-review
      // as a new external listing at all, dry run or not.
      if (isDuplicate) summary.duplicatesDetected++;

      if (options.isDryRun) continue;

      const record = {
        sourceId: source.id,
        title: extracted.title,
        description: extracted.description,
        activityType,
        gameFormat,
        startDate: extracted.startDate,
        endDate: extracted.endDate,
        startTime: extracted.startTime,
        endTime: extracted.endTime,
        recurrenceFrequency: extracted.recurrenceText ? "WEEKLY" : null, // V1: only weekly recurrence is inferred from free text; anything else needs an admin's own edit
        venueName: extracted.venueName,
        address: extracted.address,
        suburb: extracted.suburb,
        city: extracted.city,
        state: extracted.state ?? source.state,
        postcode: extracted.postcode,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        timeZone,
        originalLevelText: extracted.levelText,
        normalisedLevel,
        price: extracted.price,
        currency: extracted.currency ?? "AUD",
        organiserName: extracted.organiserName,
        registrationUrl: extracted.registrationUrl,
        sourceName: source.name,
        sourceUrl: source.baseUrl,
        discoveryStatus: "NEEDS_REVIEW" as const,
        confidence,
        reviewStatus: isDuplicate ? ("DUPLICATE" as const) : ("PENDING" as const),
        duplicateOfExternalId: bestDuplicate?.externalId ?? null,
        duplicateOfSessionId: bestDuplicate?.sessionId ?? null,
        duplicateConfidence: bestDuplicate?.confidence ?? null,
      };

      const created = await storage.createExternalActivity(record);
      if (created) summary.eventsCreated++;
    } catch (err: any) {
      summary.errors.push({ sourceId: source.id, sourceName: source.name, error: err?.message ?? "Unknown error" });
    }
  }

  return summary;
}
