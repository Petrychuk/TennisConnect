import { z } from "zod";

// [PLAY][AI] TC Discovery Agent, sections 5-6 - AI extraction. Same
// split as smartSearchEngine.ts, deliberately: everything pure/
// testable (schema, prompt construction, response parsing) is
// separated from the one function that actually calls a model, which
// nothing in this file's own test suite can exercise without a live
// API key and network access.

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
  currency: z.string().max(10).nullable(),

  organiserName: z.string().max(200).nullable(),
  registrationUrl: z.string().max(500).nullable(),
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
  const system = `You extract structured data about a tennis activity from a webpage's text content. Return ONLY a JSON object matching this exact shape - no prose, no markdown fences:

{
  "title": string,
  "description": string | null,
  "activityTypeText": string | null (the source's own words for what kind of activity this is, e.g. "social tennis", "round robin" - do not map this to TennisConnect's own taxonomy, just extract the source's wording),
  "gameFormatText": string | null (only if the source explicitly says singles/doubles/mixed),
  "startDate": string | null (YYYY-MM-DD, only if a specific date is stated or unambiguously derivable - for a recurring session with no specific next date, leave this null and use recurrenceText instead),
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
  "price": number | null (a plain number in whole dollars, only if a specific price is stated - never invent one),
  "currency": string | null (e.g. "AUD" - default AUD only if a dollar sign with no other currency is present and the source is clearly Australian; otherwise null),
  "organiserName": string | null,
  "registrationUrl": string | null (only if an actual URL is present in the source text - never fabricate one)
}

Critical rule: EXTRACT, DO NOT INVENT. If a field isn't stated in the source text, its value is null - never a plausible-sounding guess. This applies especially to level, price, and dates - a missing value is far better than a wrong one that looks confident.

Source URL (for context only, not something to extract data from itself): ${sourceUrl}

Return ONLY the JSON object.`;

  const user = `Source page text:\n\n${sourceText}`;

  return { system, user };
}

/**
 * Parses and validates a raw model response. Never throws - null on
 * anything that doesn't validate, same contract as
 * smartSearchEngine.ts's parseSmartSearchResponse, so a caller always
 * has a safe "this page didn't yield a usable extraction" path (which,
 * per spec section 26, must never stop the rest of a discovery run).
 */
export function parseExtractedActivity(raw: string): ExtractedActivity | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    const result = extractedActivitySchema.safeParse(parsed);
    return result.success ? result.data : null;
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
export async function callExtractionLLM(sourceText: string, sourceUrl: string): Promise<ExtractedActivity | null> {
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
        max_tokens: 800,
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

    const parsed = parseExtractedActivity(text);
    if (!parsed) {
      console.log(JSON.stringify({ event: "discovery_extraction_error", reason: "invalid_json_or_schema", sourceUrl }));
      return null;
    }

    console.log(JSON.stringify({ event: "discovery_extraction_success", sourceUrl }));
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
