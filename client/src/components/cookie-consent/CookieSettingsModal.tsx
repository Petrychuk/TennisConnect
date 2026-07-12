import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, BarChart3, Megaphone, Settings2 } from "lucide-react";
import type { CookieConsent } from "@/lib/cookieConsent";

interface CookieSettingsModalProps {
  open: boolean;
  initialConsent: CookieConsent | null;
  onOpenChange: (open: boolean) => void;
  onSave: (choices: { analytics: boolean; marketing: boolean; preferences: boolean }) => void;
}

export function CookieSettingsModal({
  open,
  initialConsent,
  onOpenChange,
  onSave,
}: CookieSettingsModalProps) {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [preferences, setPreferences] = useState(false);

  // Re-sync local toggle state whenever the modal is (re)opened.
  useEffect(() => {
    if (!open) return;

    setAnalytics(initialConsent?.analytics ?? false);
    setMarketing(initialConsent?.marketing ?? false);
    setPreferences(initialConsent?.preferences ?? false);
  }, [open, initialConsent]);

  const handleSave = () => {
    onSave({ analytics, marketing, preferences });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cookie Settings</DialogTitle>
          <DialogDescription>
            Choose which cookies TennisConnect is allowed to use. You can change these settings
            at any time from the "Manage Cookies" link in the footer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Essential */}
          <div className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    Essential Cookies
                    <Badge variant="secondary" className="text-[10px]">
                      Always Active
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Required for login, security, and core site functionality. These cannot be
                    switched off.
                  </p>
                </div>
              </div>
              <Switch checked disabled aria-label="Essential cookies (always active)" />
            </div>
          </div>

          {/* Analytics */}
          <div className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold">Analytics Cookies</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Helps us measure traffic and understand how visitors use the site.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Google Analytics 4</p>
                </div>
              </div>
              <Switch
                checked={analytics}
                onCheckedChange={setAnalytics}
                aria-label="Toggle analytics cookies"
                data-testid="cookie-settings-analytics-toggle"
              />
            </div>
          </div>

          {/* Marketing */}
          <div className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold">Marketing Cookies</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Used to personalize ads, measure campaign performance, and remarketing.
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-0.5 list-disc list-inside">
                    <li>Google Ads</li>
                    <li>Remarketing</li>
                    <li>Conversion Tracking</li>
                    <li>Meta Pixel (if enabled in future)</li>
                  </ul>
                </div>
              </div>
              <Switch
                checked={marketing}
                onCheckedChange={setMarketing}
                aria-label="Toggle marketing cookies"
                data-testid="cookie-settings-marketing-toggle"
              />
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold">Preference Cookies</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Remembers your language, region, and other display preferences.
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences}
                onCheckedChange={setPreferences}
                aria-label="Toggle preference cookies"
                data-testid="cookie-settings-preferences-toggle"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setAnalytics(false);
              setMarketing(false);
              setPreferences(false);
            }}
            className="cursor-pointer"
          >
            Reject All Optional
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold cursor-pointer"
            data-testid="cookie-settings-save-button"
          >
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
