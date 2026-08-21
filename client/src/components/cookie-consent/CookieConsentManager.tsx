import { useEffect, useState } from "react";
import { CookieConsentBanner } from "./CookieConsentBanner";
import { CookieSettingsModal } from "./CookieSettingsModal";
import {
  acceptAllCookies,
  applyConsentToGtag,
  getStoredConsent,
  OPEN_COOKIE_SETTINGS_EVENT,
  rejectOptionalCookies,
  saveConsent,
  type CookieConsent,
} from "@/lib/cookieConsent";

export function CookieConsentManager() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Make sure any tag that fires before the user answers stays non-tracking.
    const stored = getStoredConsent();
    setConsent(stored);

    if (stored) {
      // Re-apply on every load so consent mode survives a fresh page session.
      applyConsentToGtag(stored);
    } else {
      setBannerVisible(true);
    }

    const handleOpenSettings = () => {
      setBannerVisible(false);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenSettings);

    return () => {
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenSettings);
    };
  }, []);

  const handleAcceptAll = () => {
    setConsent(acceptAllCookies());
    setBannerVisible(false);
  };

  const handleRejectOptional = () => {
    setConsent(rejectOptionalCookies());
    setBannerVisible(false);
  };

  const handleSaveSettings = (choices: {
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  }) => {
    setConsent(saveConsent(choices));
    setBannerVisible(false);
    setSettingsOpen(false);
  };

  return (
    <>
      {bannerVisible && (
        <CookieConsentBanner
          onAcceptAll={handleAcceptAll}
          onRejectOptional={handleRejectOptional}
          onOpenSettings={() => {
            setBannerVisible(false);
            setSettingsOpen(true);
          }}
        />
      )}

      <CookieSettingsModal
        open={settingsOpen}
        initialConsent={consent}
        onOpenChange={(open) => {
          setSettingsOpen(open);

          if (!open && !consent) {
            setBannerVisible(true);
          }
        }}
        onSave={handleSaveSettings}
      />
    </>
  );
}
