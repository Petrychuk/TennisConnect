import type { ExtractedActivity } from "./discoveryExtraction";
import {
  normaliseLevelText,
  normaliseFormatText,
  normaliseAustralianState,
  resolveTimeZoneForState,
  resolveRegistrationUrl,
} from "./discoveryNormalization";
import { parseRecurrenceText, type ParsedRecurrence } from "./discoveryOccurrences";
import { resolvePrice } from "./discoveryPrice";

// [PLAY][AI] TC Discovery Agent - everything that turns what the model
// EXTRACTED into what the Agent STORES is deterministic and lives here
// (spec sections 6, 9-11, 27). Kept separate from the orchestrator so it
// can be unit-tested against real page content, without a network or a
// model: the model only supplies wording; this decides what it means.

export interface RecordContext {
  /** State configured on the source - used only when the page itself
      doesn't state one (e.g. an address that sits outside the extracted text). */
  sourceState: string | null;
  /** City configured on the source - a single-venue club's city. Left
      null for a source spanning several cities (e.g. a state body). */
  sourceCity: string | null;
  pageUrl: string;
}

export interface BuiltRecord {
  record: {
    title: string;
    description: string | null;
    activityType: string | null;
    gameFormat: string | null;
    startDate: string | null;
    endDate: string | null;
    startTime: string | null;
    endTime: string | null;
    recurrenceFrequency: string | null;
    recurrenceDayOfWeek: string | null;
    venueName: string | null;
    address: string | null;
    suburb: string | null;
    city: string | null;
    state: string | null;
    postcode: string | null;
    timeZone: string | null;
    originalLevelText: string | null;
    normalisedLevel: string | null;
    price: number | null;
    /** Display value; keeps member / non-member pricing. */
    priceLabel: string | null;
    currency: string;
    organiserName: string | null;
    registrationUrl: string | null;
  };
  recurrence: ParsedRecurrence | null;
  /** True when the repeat pattern (if any) can be turned into real dates. */
  recurrenceUnderstood: boolean;
  /** Why an admin should look at the price (null when the wording was clear). */
  priceReview: string | null;
  /** The source's own price wording, kept as evidence. */
  priceWording: string | null;
}

export function buildActivityRecord(extracted: ExtractedActivity, ctx: RecordContext): BuiltRecord {
  const state = normaliseAustralianState(extracted.state) ?? normaliseAustralianState(ctx.sourceState);
  const recurrence = parseRecurrenceText(extracted.recurrenceText);
  // Price: the model only COPIES the source's wording; the amount and the
  // label are decided here (discoveryPrice.ts). A bare number with no
  // wording behind it is unsupported - never trusted, and flagged.
  const priceWording = extracted.priceText ?? extracted.evidence?.price ?? null;
  const priced = resolvePrice(priceWording);
  const unsupportedPrice = priceWording === null && extracted.price != null;
  // Only the source's own labels for THIS activity - never its description,
  // which routinely mentions other things ("coaching team", "doubles").
  const { activityType, gameFormat } = normaliseFormatText(
    [extracted.activityTypeText, extracted.gameFormatText, extracted.title].filter(Boolean).join(" ")
  );

  return {
    record: {
      title: extracted.title,
      description: extracted.description,
      activityType,
      gameFormat,
      startDate: extracted.startDate,
      endDate: extracted.endDate,
      startTime: extracted.startTime,
      endTime: extracted.endTime,
      recurrenceFrequency: recurrence?.frequency ?? null,
      recurrenceDayOfWeek: recurrence?.dayOfWeek ?? null,
      venueName: extracted.venueName,
      address: extracted.address,
      suburb: extracted.suburb,
      city: extracted.city ?? ctx.sourceCity,
      state,
      postcode: extracted.postcode,
      timeZone: resolveTimeZoneForState(state),
      originalLevelText: extracted.levelText,
      normalisedLevel: normaliseLevelText(extracted.levelText),
      // numeric: what a general (non-member) player pays, or null. 0 ONLY when
      // the source says it's free. priceLabel: what players are shown.
      price: priced.price,
      priceLabel: priced.label,
      currency: extracted.currency ?? "AUD",
      organiserName: extracted.organiserName,
      registrationUrl: resolveRegistrationUrl(extracted.registrationUrl, ctx.pageUrl),
    },
    recurrence,
    // A fortnightly pattern is only placeable when the source gave an
    // anchor date to count from.
    recurrenceUnderstood:
      !recurrence || (recurrence.understood && (recurrence.frequency !== "FORTNIGHTLY" || !!extracted.startDate)),
    priceWording,
    priceReview: unsupportedPrice ? "A price was returned with no price wording from the page" : priced.review,
  };
}
