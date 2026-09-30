import { z } from "zod";

// [PLAY][AI] Smart Natural-Language Tennis Search - spec section 13's
// own contract, as a real, enforced Zod schema rather than just a
// TypeScript interface the LLM's output is trusted to match. The LLM
// interprets; this validates. Nothing downstream ever touches raw AI
// output that hasn't passed this.
export const playSearchIntentSchema = z.object({
  intent: z.enum(["FIND_ACTIVITY", "FIND_PLAYER", "TEXT_SEARCH"]),
  query: z.string().max(200).optional(),
  activityType: z.array(z.string()).max(5).optional(),
  gameFormat: z.array(z.string()).max(3).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
  location: z.string().max(100).optional(),
  usePlayerLocation: z.boolean().optional(),
  maxDistanceKm: z.number().positive().max(200).optional(),
  levelMode: z.enum(["PLAYER_LEVEL", "EXPLICIT"]).optional(),
  level: z.string().max(30).optional(),
  playStyle: z.enum(["SOCIAL", "COMPETITIVE"]).optional(),
  usePlayerPreferences: z.boolean().optional(),
});

export type PlaySearchIntent = z.infer<typeof playSearchIntentSchema>;

/**
 * The only minimal profile context the AI is ever given (spec section
 * 16's own allowlist) - never email, messages, DOB, photos, account/
 * security info, or anything else. Keep this type in sync with
 * buildSmartSearchPrompt below; if a field isn't in both places, it
 * was never actually sent.
 */
export interface SmartSearchPlayerContext {
  skillLevel?: string | null;
  preferredArea?: string | null;
  playRadiusKm?: number | null;
  gameFormat?: string | null;
  playStyle?: string | null;
  availability?: string[] | null;
}

const SUPPORTED_ACTIVITY_TYPES = [
  "social",
  "americano",
  "round-robin",
  "mexicano",
  "king-of-the-court",
  "tournament",
  "league",
  "club-championship",
  "junior-event",
  "cardio-tennis",
  "coaching-clinic",
];

/**
 * Builds the exact system + user prompt sent to the model. Kept as a
 * pure function (string in, string out) so it can be reviewed and
 * unit-tested without a live API call - the actual network request
 * lives in the route, not here.
 */
export function buildSmartSearchPrompt(query: string, player?: SmartSearchPlayerContext): { system: string; user: string } {
  const system = `You convert a tennis player's natural-language search into structured JSON matching this exact shape - return ONLY the JSON object, no prose, no markdown fences:

{
  "intent": "FIND_ACTIVITY" | "FIND_PLAYER" | "TEXT_SEARCH",
  "query"?: string,
  "activityType"?: string[] (only from: ${SUPPORTED_ACTIVITY_TYPES.join(", ")}),
  "gameFormat"?: string[] (only from: singles, doubles, mixed),
  "dateFrom"?: string (ISO date, resolved from relative terms like "tonight"/"this weekend"/"Thursday"),
  "dateTo"?: string (ISO date),
  "timeOfDay"?: "morning" | "afternoon" | "evening",
  "location"?: string (a place name mentioned explicitly in the query),
  "usePlayerLocation"?: boolean (true only if the query says "near me" or similar with no explicit place named),
  "maxDistanceKm"?: number,
  "levelMode"?: "PLAYER_LEVEL" | "EXPLICIT" (PLAYER_LEVEL only if the query says "around my level" or similar),
  "level"?: string (only if an explicit level like beginner/intermediate/advanced was named - never invent a specific UTR number),
  "playStyle"?: "SOCIAL" | "COMPETITIVE",
  "usePlayerPreferences"?: boolean (true if the query defers generally to the player's own known preferences, e.g. "anything good for me this weekend")
}

Rules:
- intent is FIND_PLAYER only for requests to find a hitting partner/person to play with (not an event) - e.g. "find someone to hit with Sunday".
- intent is TEXT_SEARCH for a plain name/venue/organiser search with no other interpretable structure (e.g. "Wolli Creek Tennis", "Sydney Tennis Community"), or when you cannot confidently interpret the query at all - text search should not lose the essence of what a normal search box would have matched.
- intent is FIND_ACTIVITY for anything describing a tennis session/event to attend by criteria (format, date, time, level, location, style).
- An explicit requirement in the query ALWAYS overrides anything the player's own profile below says - e.g. if the player prefers doubles but asks for "Singles Saturday", you must return gameFormat: ["singles"], not doubles.
- Never invent a specific UTR range or numeric level the player didn't state.
- Never invent event names, venues, organisers, prices, or availability - you are only extracting search criteria, not creating results.
- If the query is unclear or you are not confident, return {"intent": "TEXT_SEARCH", "query": "<the original query text>"} - this is always a safe, valid answer.
- Return ONLY the JSON object.`;

  const contextLines: string[] = [];
  if (player?.skillLevel) contextLines.push(`Player's level: ${player.skillLevel}`);
  if (player?.preferredArea) contextLines.push(`Player's preferred area: ${player.preferredArea}`);
  if (player?.playRadiusKm) contextLines.push(`Player's preferred distance: within ${player.playRadiusKm} km`);
  if (player?.gameFormat) contextLines.push(`Player's preferred game format: ${player.gameFormat}`);
  if (player?.playStyle) contextLines.push(`Player's preferred play style: ${player.playStyle}`);
  if (player?.availability?.length) contextLines.push(`Player's usual availability: ${player.availability.join(", ")}`);

  const user = contextLines.length
    ? `Player context (use only if the query defers to it - an explicit query requirement always wins):\n${contextLines.join("\n")}\n\nQuery: "${query}"`
    : `Query: "${query}"`;

  return { system, user };
}

/**
 * Parses and validates a raw model response string. Never throws -
 * returns null on anything that isn't valid, matching JSON, so the
 * caller can fall back to plain text search (spec section 14).
 * Strips a markdown code fence if the model wrapped its JSON in one
 * despite being asked not to, since that's a common enough model habit
 * to handle defensively rather than fail on.
 */
export function parseSmartSearchResponse(raw: string): PlaySearchIntent | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    const result = playSearchIntentSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * A safe, always-valid fallback intent - used whenever the AI call
 * fails, times out, or its output doesn't validate. Spec section 14:
 * "fallback to the existing normal text search."
 */
export function fallbackIntent(originalQuery: string): PlaySearchIntent {
  return { intent: "TEXT_SEARCH", query: originalQuery };
}

/**
 * The one piece of this file that actually talks to a model - kept
 * separate from parseSmartSearchResponse/buildSmartSearchPrompt (both
 * pure and unit-tested) since a live network call can't be tested in
 * this sandbox at all. Raw fetch to the Messages API rather than
 * pulling in the SDK - this app has no existing LLM dependency, and a
 * single endpoint call doesn't need one. Returns null on ANY failure
 * (missing key, timeout, non-200, invalid/unvalidated JSON) - callers
 * must always have a fallback path (spec section 14), never treat this
 * as a required dependency.
 */
export async function callSmartSearchLLM(
  query: string,
  player?: SmartSearchPlayerContext
): Promise<PlaySearchIntent | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(JSON.stringify({ event: "smart_search_ai_error", reason: "no_api_key" }));
    return null;
  }

  const { system, user } = buildSmartSearchPrompt(query, player);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

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
        max_tokens: 300,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.log(JSON.stringify({ event: "smart_search_ai_error", reason: "non_200", status: res.status }));
      return null;
    }
    const data = await res.json();
    const text = data?.content?.find((block: any) => block.type === "text")?.text;
    if (typeof text !== "string") {
      console.log(JSON.stringify({ event: "smart_search_ai_error", reason: "no_text_block" }));
      return null;
    }

    const parsed = parseSmartSearchResponse(text);
    if (!parsed) {
      console.log(JSON.stringify({ event: "smart_search_ai_error", reason: "invalid_json_or_schema" }));
      return null;
    }

    console.log(JSON.stringify({ event: "smart_search_ai_success", intent: parsed.intent }));
    return parsed;
  } catch (err: any) {
    console.log(
      JSON.stringify({
        event: "smart_search_ai_error",
        reason: err?.name === "AbortError" ? "timeout" : "network_error",
      })
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Deterministic time-of-day check on a session's OWN local wall-clock
 * hour (same Intl.DateTimeFormat-with-timeZone approach already used
 * in recommendationEngine.ts's availability bucketing) - spec section
 * 6 is explicit that the LLM must not judge whether an event falls in
 * a time window itself; this is the actual, testable backend filter
 * that does.
 */
export function matchesTimeOfDay(
  startAtIso: string,
  timeZone: string | null | undefined,
  timeOfDay: "morning" | "afternoon" | "evening"
): boolean {
  let hour: number;
  if (timeZone) {
    const hourStr = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(
      new Date(startAtIso)
    );
    hour = parseInt(hourStr, 10) % 24;
  } else {
    hour = new Date(startAtIso).getHours();
  }
  if (timeOfDay === "morning") return hour >= 5 && hour < 12;
  if (timeOfDay === "afternoon") return hour >= 12 && hour < 17;
  return hour >= 17 || hour < 5; // evening
}

