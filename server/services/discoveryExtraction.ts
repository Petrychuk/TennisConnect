import { z } from "zod";

// [PLAY][AI] TC Discovery Agent, sections 5-6 - AI extraction. Same
// split as smartSearchEngine.ts, deliberately: everything pure/
// testable (schema, prompt construction, response parsing) is
// separated from the one function that actually calls a model, which
// nothing in this file's own test suite can exercise without a live
// API key and network access.

/** Upper bound on activities taken from one page - a cost/abuse guard. */
export const MAX_ACTIVITIES_PER_PAGE = 20;

/**
 * Part of every page's cache key (see discoveryOrchestration). Bump it
 * whenever the prompt, or the rules that interpret the model's answer,
 * change - otherwise an unchanged page is never re-extracted and stale
 * results (e.g. a wrong price) would live on. Version 2: price is now
 * derived from the source's wording (priceText), not asked of the model.
 */
export const EXTRACTION_VERSION = 2;

export const extractedActivitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),

  activityTypeText: z.string().max(100).nullable(), // the SOURCE's own wording - normaliseFormatText maps this, the model doesn't
  gameFormatText: z.string().max(50).nullable(),

  startDate: z.string().max(10).nullable(), // YYYY-MM-DD - null if genuinely not statable from the source text
  endDate: z.string().max(10).nullable(),
  startTime: z.string().max(5).nullable(), // HH:MM
  endTime: z.string().max(5).nullable(),

  recurrenceText: z.string().max(100).nullable(), // e.g. "every Thursday" - the source's own phrasing; discoveryNormalization turns this into frequency/dayOfWeek, not the model

  venueName: z.string().max(200).nullable(),
  address: z.string().max(300).nullable(),
  suburb: z.string().max(100).nullable(),
  city: z.string().max(100).nullable(),
  state: z.string().max(10).nullable(),
  postcode: z.string().max(10).nullable(),

  levelText: z.string().max(100).nullable(), // original wording only - normaliseLevelText does the mapping

  price: z.number().min(0).max(10000).nullable(),

  // The source's own price wording, verbatim, INCLUDING conditions ("FREE for
  // members. $20 for non-members"). The amount and label are derived from
  // this by discoveryPrice.ts - the model is not trusted to pick a number.
  priceText: z.string().max(400).nullable().optional(),
  currency: z.string().max(10).nullable(),

  organiserName: z.string().max(200).nullable(),
  registrationUrl: z.string().max(500).nullable(),

  // true ONLY if the page itself says this activity is cancelled or
  // postponed - never inferred from an activity simply not being listed.
  cancelled: z.boolean().nullable().optional(),

  // Short verbatim snippets from the page backing the fields an admin is
  // most likely to question (spec section 28), e.g.
  // { "price": "$15 visitors", "startTime": "9am-11am" }. Internal only.
  evidence: z.record(z.string(), z.string().max(300)).nullable().optional(),
});

export type ExtractedActivity = z.infer<typeof extractedActivitySchema>;

/**
 * Builds the extraction prompt. Pure, no network - reviewable and
 * testable on its own. Deliberately instructs the model to leave a
 * field null rather than infer/guess it (spec section 27's "extract,
 * don't invent" is the single most important rule in this whole
 * pipeline - reinforced here exactly the way smartSearchEngine.ts
 * reinforces "never invent a UTR").
 */
export function buildExtractionPrompt(sourceText: string, sourceUrl: string): { system: string; user: string } {
  const system = `You extract structured data about tennis activities that a player could take part in, from a webpage's text content. A page may list several activities, one activity, or none. Return ONLY a JSON object of this exact shape - no prose, no markdown fences:

{ "activities": [ <activity>, ... ] }

Return { "activities": [] } if the page describes no tennis activity a recreational player could join (news, coaching bios, court hire prices, etc.).

One entry per distinct activity. A session that repeats ("every Thursday 7-9pm") is ONE entry with recurrenceText set - never split it into individual dates. If one page describes several programs (a Tuesday session and a Sunday session), each is its own entry, and its recurrenceText and times must be the wording for THAT entry only, not the whole page's ("every Tuesday 7-10pm", not "every Tuesday and Sunday").

Each <activity> has exactly these fields:
{
  "title": string,
  "description": string | null,
  "activityTypeText": string | null (the source's own words for what kind of activity this is, e.g. "social tennis", "round robin" - do not map this to TennisConnect's own taxonomy, just extract the source's wording),
  "gameFormatText": string | null (only if the source explicitly says singles/doubles/mixed),
  "startDate": string | null (YYYY-MM-DD, only if a specific date AND its year are stated or unambiguously derivable from the page - e.g. a "September 2026" heading above "Saturday 12 September". If the year isn't on the page, leave it null. For a recurring session with no specific next date, leave this null and use recurrenceText instead),
  "endDate": string | null (YYYY-MM-DD),
  "startTime": string | null (HH:MM, 24-hour),
  "endTime": string | null (HH:MM, 24-hour),
  "recurrenceText": string | null (the source's own phrasing, e.g. "every Thursday 7-9pm" - do not compute a frequency/day yourself),
  "venueName": string | null,
  "address": string | null,
  "suburb": string | null,
  "city": string | null,
  "state": string | null (NSW/VIC/QLD/WA/SA/TAS/ACT/NT if determinable),
  "postcode": string | null,
  "levelText": string | null (the source's own wording, e.g. "Intermediate players" - do not map this to a TennisConnect level, and NEVER invent a specific UTR number if one isn't stated),
  "priceText": string | null (EVERY statement of price for THIS activity, copied word-for-word from the page, including free / member / non-member wording - e.g. "FREE for SSC tennis members. $20 pp applicable to non-tennis members each week." Do not summarise, do not choose between prices, do not drop a condition. null if the page states no price for this activity),
  "price": null (always null - the price is worked out from priceText by our own code; do not fill this in),
  "currency": string | null (e.g. "AUD" - default AUD only if a dollar sign with no other currency is present and the source is clearly Australian; otherwise null),
  "organiserName": string | null,
  "registrationUrl": string | null (only if an actual URL is present in the source text - never fabricate one),
  "cancelled": boolean | null (true ONLY if the page explicitly says this activity is cancelled or postponed; otherwise null),
  "evidence": { [fieldName: string]: string } | null (for price, startDate, startTime, recurrenceText and levelText - whichever you filled in - a SHORT verbatim snippet (under 100 characters) from the page that supports it)
}

Critical rule: EXTRACT, DO NOT INVENT. If a field isn't stated in the source text, its value is null - never a plausible-sounding guess. This applies especially to level, price, and dates - a missing value is far better than a wrong one that looks confident.

Source URL (for context only, not something to extract data from itself): ${sourceUrl}

Return ONLY the JSON object.`;

  const user = `Source page text:\n\n${sourceText}`;

  return { system, user };
}

export interface ParsedExtraction {
  activities: ExtractedActivity[];
  /** Entries the model returned that failed validation and were dropped. */
  invalidCount: number;
}

/**
 * Parses a raw model response into the activities it found. Never
 * throws - null only when the response isn't usable JSON with an
 * `activities` array at all. Validation is per-entry: one malformed
 * activity on a page of five is dropped (and counted) rather than
 * discarding the four good ones, and a valid empty list ("nothing
 * here") is a real answer, distinct from a failed extraction (null).
 * Same "never throws" contract as smartSearchEngine.ts, so one bad page
 * can never stop a discovery run (spec section 26).
 */
export function parseExtractedActivities(raw: string): ParsedExtraction | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed) ? parsed : parsed?.activities;
    if (!Array.isArray(list)) return null;

    const activities: ExtractedActivity[] = [];
    let invalidCount = 0;
    for (const item of list.slice(0, MAX_ACTIVITIES_PER_PAGE)) {
      const result = extractedActivitySchema.safeParse(item);
      if (result.success) activities.push(result.data);
      else invalidCount++;
    }
    return { activities, invalidCount };
  } catch {
    return null;
  }
}

/**
 * The one function in this file that actually calls a model - isolated
 * from everything above so the prompt/schema/parsing stay fully unit-
 * testable without a live API key. Same pattern as
 * smartSearchEngine.ts's callSmartSearchLLM: raw fetch (no SDK), a
 * timeout, and null on any failure - a broken/slow extraction for one
 * page must never take down the rest of a discovery run (spec section
 * 26).
 */
export async function callExtractionLLM(sourceText: string, sourceUrl: string): Promise<ParsedExtraction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(JSON.stringify({ event: "discovery_extraction_error", reason: "no_api_key", sourceUrl }));
    return null;
  }

  const { system, user } = buildExtractionPrompt(sourceText, sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.log(JSON.stringify({ event: "discovery_extraction_error", reason: "non_200", status: res.status, sourceUrl }));
      return null;
    }
    const data = await res.json();
    const text = data?.content?.find((block: any) => block.type === "text")?.text;
    if (typeof text !== "string") {
      console.log(JSON.stringify({ event: "discovery_extraction_error", reason: "no_text_block", sourceUrl }));
      return null;
    }

    const parsed = parseExtractedActivities(text);
    if (!parsed) {
      console.log(JSON.stringify({ event: "discovery_extraction_error", reason: "invalid_json_or_schema", sourceUrl }));
      return null;
    }

    console.log(JSON.stringify({ event: "discovery_extraction_success", sourceUrl, activities: parsed.activities.length, invalid: parsed.invalidCount }));
    return parsed;
  } catch (err: any) {
    console.log(
      JSON.stringify({
        event: "discovery_extraction_error",
        reason: err?.name === "AbortError" ? "timeout" : "network_error",
        sourceUrl,
      })
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Confidence classification (spec section 15) - purely internal,
 * never shown to a player. HIGH needs title+date+location+
 * registration all present; MEDIUM needs at least title+date+
 * location; anything less is LOW.
 */
export function classifyConfidence(extracted: ExtractedActivity): "HIGH" | "MEDIUM" | "LOW" {
  const hasLocation = !!(extracted.venueName || extracted.suburb || extracted.address);
  const hasDate = !!extracted.startDate || !!extracted.recurrenceText;
  const hasRegistration = !!extracted.registrationUrl;

  if (extracted.title && hasDate && hasLocation && hasRegistration) return "HIGH";
  if (extracted.title && hasDate && hasLocation) return "MEDIUM";
  return "LOW";
}
