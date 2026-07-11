import type { ClubFormData } from "../ClubForm";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
interface ClubSeoSectionProps {
  form: ClubFormData;
  updateField: <
    K extends keyof ClubFormData
  >(
    key: K,
    value: ClubFormData[K]
  ) => void;
}

export function ClubSeoSection({
  form,
  updateField,
}: ClubSeoSectionProps) {

  const isPremium =
    form.listingType === "premium";

  return (

    <section
      className="space-y-8"
      data-testid="club-seo-section"
    >
      {/* Heading */}

      <div>
        <h2
          className="text-2xl font-display font-semibold"
        >
          SEO
        </h2>
        <p
          className="mt-1 text-sm text-muted-foreground"
        >
          Improve your visibility in Google Search with
          custom SEO metadata.
        </p>

      </div>

      {/* Free Listing */}

      {!isPremium && (
        <div
          className="
            rounded-2xl
            border
            border-dashed
            bg-muted/30
            p-6
          "
          data-testid="seo-premium-required"
        >
          <h3 className="font-semibold">
            Premium Feature
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            SEO optimisation is available only for
            Premium Club Communities.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            <li>✓ Custom SEO Title</li>
            <li>✓ Meta Description</li>
            <li>✓ Meta Keywords</li>
            <li>✓ Google Search Preview</li>
            <li>✓ Better Google ranking</li>
          </ul>
        </div>
      )}

      {/* Premium SEO */}

      {isPremium && (
        <>
          {/* SEO Title */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-title">
                SEO Title
              </Label>
              <span
                className={`text-xs ${
                  form.seoTitle.length > 60
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {form.seoTitle.length} / 60
              </span>
            </div>

            <Input
              id="seo-title"
              data-testid="club-seo-title"
              placeholder="Royal Sydney Tennis Club | TennisConnect"
              value={form.seoTitle}
              onChange={(e) =>
                updateField(
                  "seoTitle",
                  e.target.value
                )
              }
            />

            <p className="text-xs text-muted-foreground">
              Recommended length: 50–60 characters.
            </p>

          </div>
              
          {/* Meta Description */}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="meta-description">
                Meta Description
              </Label>
              <span
                className={`text-xs ${
                  form.metaDescription.length > 160
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {form.metaDescription.length} / 160
              </span>

            </div>

            <Textarea
              id="meta-description"
              data-testid="club-meta-description"
              rows={4}
              className="
                flex
                w-full
                rounded-xl
                border
                bg-background
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:ring-2
                focus:ring-lime-500
              "
              placeholder="Describe this club for Google Search results..."
              value={form.metaDescription}
              onChange={(e) =>
                updateField(
                  "metaDescription",
                  e.target.value
                )
              }
            />

            <p className="text-xs text-muted-foreground">
              Recommended length:
              140–160 characters.
            </p>
          </div>

          {/* Meta Keywords */}

          <div className="space-y-2">

            <Label htmlFor="meta-keywords">
              Meta Keywords
            </Label>

            <Input
              id="meta-keywords"
              data-testid="club-meta-keywords"
              placeholder="tennis club, Sydney, tennis courts, coaching..."
              value={form.metaKeywords}
              onChange={(e) =>
                updateField(
                  "metaKeywords",
                  e.target.value
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Separate keywords with commas.
            </p>
          </div>
        
          {/* Google Preview */}

          <div
            className="rounded-2xl border bg-muted/30 p-6"
            data-testid="club-google-preview"
          >
            <h3 className="font-semibold">
              Google Search Preview
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              This is approximately how your club may
              appear in Google Search.
            </p>

            <div className="mt-6 rounded-xl border bg-background p-5">
              <p className="text-xs text-green-700">
                www.tennisconnect.com.au/clubs/
                {form.slug || "your-club"}

              </p>

              <h4 className="mt-2 text-lg font-semibold text-blue-700">

                {form.seoTitle ||
                  form.name ||
                  "Club Name"}
              </h4>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {form.metaDescription ||
                  form.shortDescription ||
                  "Your club description will appear here."}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}