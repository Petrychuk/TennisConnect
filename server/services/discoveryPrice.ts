// [PLAY][AI] TC Discovery Agent, spec section 27 - "Extract, don't
// invent", applied to price.
//
// The model is NOT asked for a price. It copies the source's own price
// wording verbatim (`priceText`), and this deterministic function turns
// that wording into:
//
//   price      numeric, for future filtering/sorting. It is the price a
//              non-member / general player pays - never a member-only or
//              conditional figure - or null when that can't be known.
//   priceLabel the DISPLAY value and the source of truth for what players
//              see. It keeps every price the source stated, including the
//              conditions ("Free for SSC tennis members · $20 per week for
//              non-members"), so no price is chosen over another and none
//              is lost.
//   review     why an admin should look (null when the wording was clear).
//
// The rule that must never break: price = 0 is stored ONLY when the
// source says the activity is free (or "$0") for the general player.
// "Free for members" is not that. Missing or unreadable wording is null.
//
// This is deliberately not a tariff system: one number, one label. Two
// levels (member / everyone else) are understood because that is what
// clubs actually publish; anything more exotic is kept as the source's own
// words and flagged.

export interface PriceResult {
  price: number | null;
  label: string | null;
  review: string | null;
}

const NONE: PriceResult = { price: null, label: null, review: null };

const AMOUNT = /\$\s*(\d[\d,]*(?:\.\d+)?)/g;
const FREE_TOKEN = /\bfree\b|\bno\s+(?:cost|charge|fee)\b|\bcomplimentary\b/i;
// "free for kids", "free during the first week" ... - free only under a condition.
const CONDITION_AFTER_FREE = /\bfree\s+(?:for|to|if|when|during|in|on|after|before|until|trial|taster|intro|introductory|first)\b/i;
const CONDITION_ANYWHERE = /\b(?:week of|first|trial|taster|intro|introductory|promo|promotion|launch|until|during)\b/i;
// "non-members", "non-tennis members", "casual players", "visitors", "guests"
const NON_MEMBER = /\bnon[-\s]?(?:[a-z]+[-\s])?members?\b|\bcasual\b|\bvisitors?\b|\bguests?\b|\bpublic\b/i;
const MEMBER = /\bmembers?\b/i;
const UNIT = /(?:\bper|\/|\beach|\bevery|\ba)\s*(session|week|term|visit|day|month|class|game|hour)\b/i;

// Where one tier ends and the next begins: sentence ends, " / ", a slash
// before a tier word ("Members free/Non-members $20" - but NOT "$20/session"),
// ";", "·", "|", ", ", newlines, "and"/"but"/"while".
const SEGMENT_SPLIT =
  /\s\/\s|\/(?=\s*(?:non|member|visitor|casual|guest|public|free|adult|kid|junior|student|concession))|[\n;·|]|,\s+|(?<=[.!?])\s+|\s+(?:and|but|while|whereas)\s+/i;
const SENTENCE_SPLIT = /(?<=[.!?])\s+|\n+/;

interface Segment {
  kind: "member" | "nonmember" | "general";
  amounts: number[];
  free: boolean; // free token or an explicit $0
  unit: string | null;
  text: string;
}

function classify(text: string): Segment {
  const amounts = Array.from(text.matchAll(AMOUNT)).map((m) => parseFloat(m[1].replace(/,/g, "")));
  const nonMember = NON_MEMBER.test(text);
  const unit = UNIT.exec(text);
  return {
    kind: nonMember ? "nonmember" : MEMBER.test(text) ? "member" : "general",
    amounts,
    free: FREE_TOKEN.test(text) || amounts.includes(0),
    unit: unit ? `per ${unit[1].toLowerCase()}` : null,
    text,
  };
}

type TierValue =
  | { kind: "amount"; amount: number; unit: string | null }
  | { kind: "free" }
  | { kind: "none" }
  | { kind: "conflict" };

/** What one tier (member / non-member / general) charges, or "conflict"
    if the source gave it two different answers. */
function tierValue(segs: Segment[]): TierValue {
  const positives = Array.from(new Set(segs.flatMap((s) => s.amounts.filter((a) => a > 0))));
  const hasFree = segs.some((s) => s.free);
  if (positives.some((a) => !Number.isInteger(a)) || positives.length > 1) return { kind: "conflict" };
  if (positives.length === 1) {
    if (hasFree && segs.some((s) => s.free && s.amounts.length === 0)) return { kind: "conflict" };
    return { kind: "amount", amount: positives[0], unit: segs.find((s) => s.unit)?.unit ?? null };
  }
  return hasFree ? { kind: "free" } : { kind: "none" };
}

const dollars = (n: number) => `$${n.toLocaleString("en-AU")}`;
const money = (v: { amount: number; unit: string | null }) => `${dollars(v.amount)}${v.unit ? ` ${v.unit}` : ""}`;

function memberPhrase(segs: Segment[]): string {
  for (const s of segs) {
    // "FREE for SSC tennis members" -> "SSC tennis members"
    const m = /\bfor\s+((?:[A-Za-z0-9&'.-]+\s+){0,4}?members?)\b/i.exec(s.text);
    if (m) return m[1].trim();
  }
  return "members";
}

function nonMemberNoun(segs: Segment[]): string {
  const t = segs.map((s) => s.text).join(" ");
  if (/\bcasual\b/i.test(t)) return "casual players";
  if (/\bvisitors?\b/i.test(t)) return "visitors";
  if (/\bguests?\b/i.test(t)) return "guests";
  if (/\bpublic\b/i.test(t)) return "the public";
  return "non-members";
}

/** The source's own words, kept as the label when they can't be structured
    - so nothing the source said is discarded - but flagged for review. */
function raw(text: string, reason: string): PriceResult {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return { price: null, label: collapsed.length <= 140 ? collapsed : null, review: reason };
}

export function resolvePrice(priceText: string | null | undefined): PriceResult {
  const text = (priceText ?? "").trim();
  if (!text) return NONE;

  const segs = text
    .split(SEGMENT_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(classify)
    .filter((s) => s.amounts.length > 0 || s.free);
  if (segs.length === 0) return raw(text, "The source has price wording that couldn't be read as an amount");

  const members = segs.filter((s) => s.kind === "member");
  const nons = segs.filter((s) => s.kind === "nonmember");
  const generals = segs.filter((s) => s.kind === "general");

  // ---- Two levels: a member price and a price for everyone else ----
  if (members.length > 0 || nons.length > 0) {
    const memVal = tierValue(members);
    const publicSegs = nons.length > 0 ? nons : generals;
    const pubVal = tierValue(publicSegs);
    if (memVal.kind === "conflict" || pubVal.kind === "conflict") {
      return raw(text, "The source states several different prices for the same group");
    }

    const memText =
      memVal.kind === "free" ? `Free for ${memberPhrase(members)}`
      : memVal.kind === "amount" ? `${money(memVal)} for ${memberPhrase(members)}`
      : null;

    const suffix = nons.length > 0 ? ` for ${nonMemberNoun(nons)}` : "";
    const pubText =
      pubVal.kind === "free" ? `Free${suffix}`
      : pubVal.kind === "amount" ? `${money(pubVal)}${suffix}`
      : null;

    const price = pubVal.kind === "amount" ? pubVal.amount : pubVal.kind === "free" ? 0 : null;
    const label = [memText, pubText].filter(Boolean).join(" · ") || null;

    // Only one side is known. Never fill in the other - in particular, a
    // member-only "free" must not become the activity's price.
    if (pubVal.kind === "none") {
      return { price: null, label, review: "Only member pricing is stated - the price for everyone else is unknown" };
    }
    return { price, label, review: null };
  }

  // ---- No member/non-member wording: one price for everyone ----
  const positives = Array.from(new Set(segs.flatMap((s) => s.amounts.filter((a) => a > 0))));
  const explicitZero = segs.some((s) => s.amounts.includes(0));
  const sentences = text.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
  const freeSentences = sentences.filter((s) => FREE_TOKEN.test(s));
  const plainFree = freeSentences.some((s) => !CONDITION_AFTER_FREE.test(s) && !CONDITION_ANYWHERE.test(s));

  if (positives.some((a) => !Number.isInteger(a))) return raw(text, "The source's price isn't a whole-dollar amount");
  if (positives.length > 1) return raw(text, "The source states several different prices (e.g. a range)");

  if (positives.length === 1) {
    if (explicitZero || freeSentences.length > 0) {
      return raw(text, "The source mixes a free option with a paid price");
    }
    const unit = segs.find((s) => s.unit)?.unit ?? null;
    return { price: positives[0], label: money({ amount: positives[0], unit }), review: null };
  }

  if (explicitZero || plainFree) return { price: 0, label: "Free", review: null };
  if (freeSentences.length > 0) return raw(text, "The source says 'free' only under a condition (e.g. a trial period)");
  return raw(text, "The source has price wording that couldn't be read as an amount");
}

const PIECE = " · ";

/** The label split into display lines (Quick View shows one per line). */
export function priceLabelLines(label: string | null | undefined): string[] {
  return (label ?? "").split(PIECE).map((s) => s.trim()).filter(Boolean);
}

/**
 * Compact form for the Play card. A member/general pair reads best as the
 * price most players pay first, then the member deal:
 *   "Free for SSC tennis members · $20 per week for non-members"
 *     -> "$20 · Free for members"
 * Anything that isn't that shape is shown as the full label.
 */
export function summariseLabelForCard(label: string | null | undefined, price: number | null | undefined): string | null {
  if (!label) return null;
  const parts = priceLabelLines(label);
  if (parts.length === 2 && price != null && /\bfor\b.*\bmembers?\b/i.test(parts[0]) && !NON_MEMBER.test(parts[0])) {
    return `${price === 0 ? "Free" : dollars(price)}${PIECE}${parts[0].replace(/\bfor\b.*$/i, "for members")}`;
  }
  return label;
}
