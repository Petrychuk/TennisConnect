// client/src/lib/cookieConsent.ts
//
// Lightweight cookie-consent manager.
// - Stores the user's choice in localStorage (no backend needed).
// - Maps categories onto Google's Consent Mode v2 signals so GA4 / Google Ads /
//   GTM tags stay dormant until the relevant category is granted.
// - Fully additive: nothing here is imported by existing code, so it can't
//   break anything already shipping.

export type CookieCategory = "essential" | "analytics" | "marketing" | "preferences";

export interface CookieConsent {
  essential: true; // always on, can't be disabled
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  version: number;
  acceptedAt: string;
}

const STORAGE_KEY = "tennisconnect_cookie_consent";
export const CONSENT_VERSION = 1;

export const CONSENT_UPDATED_EVENT = "cookie-consent-updated";
export const OPEN_COOKIE_SETTINGS_EVENT = "open-cookie-settings";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

function gtag(...args: any[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

export function getStoredConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CookieConsent;

    // If we ever bump CONSENT_VERSION (e.g. new cookie category added),
    // treat old consent as stale so the banner reappears.
    if (!parsed || parsed.version !== CONSENT_VERSION) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function hasConsented(): boolean {
  return getStoredConsent() !== null;
}

function persist(consent: CookieConsent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: consent }));
}

/** Push the current consent state into Google Consent Mode v2. */
export function applyConsentToGtag(consent: CookieConsent) {
  gtag("consent", "update", {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
    functionality_storage: consent.preferences ? "granted" : "denied",
    personalization_storage: consent.preferences ? "granted" : "denied",
    security_storage: "granted",
  });
}

/**
 * Call once as early as possible (before consent is known) so any tags
 * that fire before the user answers stay non-tracking by default.
 */
export function applyDefaultDeniedConsent() {
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "granted",
  });
}

export function saveConsent(
  choices: Pick<CookieConsent, "analytics" | "marketing" | "preferences">
): CookieConsent {
  const consent: CookieConsent = {
    essential: true,
    analytics: choices.analytics,
    marketing: choices.marketing,
    preferences: choices.preferences,
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };

  persist(consent);
  applyConsentToGtag(consent);

  return consent;
}

export function acceptAllCookies(): CookieConsent {
  return saveConsent({ analytics: true, marketing: true, preferences: true });
}

export function rejectOptionalCookies(): CookieConsent {
  return saveConsent({ analytics: false, marketing: false, preferences: false });
}

/** Re-open the settings modal from anywhere (e.g. a footer "Manage Cookies" link). */
export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
}
