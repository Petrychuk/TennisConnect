import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FIELDS, type AdminFieldDef } from "@/lib/adminFields";
import { AdminFieldRenderer } from "@/components/admin/common/AdminFieldRenderer";
import { SeoPreviewCard } from "@/components/admin/common/SeoPreviewCard";
import { ImageUploader } from "@/components/admin/common/ImageUploader";

export interface ArticleFormProps {
  mode?: "create" | "edit";
  initialData?: any; // full article record when editing
  onClose: () => void;
  onSaved?: () => void;
}

const ALL_FIELDS = FIELDS.articles as AdminFieldDef[];

const DETAIL_FIELDS = ALL_FIELDS.filter((f) => f.name !== "coverImage");

function blankForm(): Record<string, any> {
  const data: Record<string, any> = {};
  ALL_FIELDS.forEach((f) => {
    data[f.name] = f.type === "checkbox" ? false : "";
  });
  return data;
}

function hydrateForm(item: any): Record<string, any> {
  const data: Record<string, any> = {};
  ALL_FIELDS.forEach((f) => {
    const v = item?.[f.name];
    if (f.type === "list") {
      data[f.name] = Array.isArray(v) ? v.join(", ") : v || "";
    } else if (f.type === "checkbox") {
      data[f.name] = !!v;
    } else {
      data[f.name] = v ?? "";
    }
  });
  return data;
}

function buildPayload(form: Record<string, any>) {
  const payload: Record<string, any> = {};

  ALL_FIELDS.forEach((f) => {
    let v = form[f.name];

    if (v === "" || v === undefined || v === null) return;

    if (f.type === "number") v = Number(v);

    if (f.type === "list") {
      v = String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    payload[f.name] = f.type === "checkbox" ? !!v : v;
  });

  return payload;
}

export function ArticleForm({
  mode = "create",
  initialData,
  onClose,
  onSaved,
}: ArticleFormProps) {
  const [step, setStep] = useState<"details" | "media">("details");
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState(initialData?.id ?? "");
  const [form, setForm] = useState<Record<string, any>>(() =>
    mode === "edit" && initialData ? hydrateForm(initialData) : blankForm()
  );
  const { toast } = useToast();

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm(hydrateForm(initialData));
      setSavedId(initialData.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id]);

  const updateField = (name: string, value: any) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const payload = buildPayload(form);

      // New articles start as drafts — the admin explicitly publishes once
      // they've reviewed the media step / full preview.
      if (mode === "create") payload.isPublished = false;

      const url =
        mode === "create"
          ? "/api/admin/articles"
          : `/api/admin/articles/${savedId}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save article");
      }

      const saved = await res.json();

      setSavedId(saved.id);
      setForm((prev) => ({
        ...prev,
        slug: saved.slug ?? prev.slug,
        coverImage: saved.coverImage || prev.coverImage,
      }));
      setStep("media");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveMedia = async (data: Partial<{ coverImage: string }>) => {
    if (!savedId) return;
    try {
      const payload = { ...buildPayload(form), ...data };

      const res = await fetch(`/api/admin/articles/${savedId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save media");
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Unable to save media changes.",
      });
    }
  };

  const handleBack = () => setStep("details");

  const handleDone = () => {
    toast({
      description:
        mode === "create"
          ? "Article has been successfully created."
          : "Article has been successfully updated.",
    });
    onSaved?.();
    onClose();
  };

  return (
    <div className="space-y-10" data-testid="article-form">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {step === "details" ? "Article Details" : "Upload Media"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Step {step === "details" ? "1" : "2"} of 2
          </p>
        </div>
      </div>

      {/* STEP 1 */}
      {step === "details" && (
        <>
          <AdminFieldRenderer
            fields={DETAIL_FIELDS}
            values={form}
            onChange={updateField}
            isFieldVisible={(f, values) =>
              f.name !== "legalType" || values.category === "Legal"
            }
          />

          <SeoPreviewCard
            title={form.seoTitle || form.title}
            description={form.metaDescription || form.excerpt}
            path={`/articles/${form.slug || "your-article"}`}
          />
        </>
      )}

      {/* STEP 2 */}
      {step === "media" && (
        <div className="space-y-8" data-testid="article-media-section">
          <div>
            <h3 className="text-lg font-semibold">Article Image</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the cover image displayed on article cards and at the
              top of the article page.
            </p>
          </div>

          <ImageUploader
            folder="articles"
            entityId={savedId}
            type="cover"
            value={form.coverImage}
            label="Cover Image"
            description="Displayed on article cards and at the top of the article page."
            allowUrl
            onUploaded={async (url) => {
              updateField("coverImage", url);
              await saveMedia({ coverImage: url });
            }}
            onDeleted={async () => {
              updateField("coverImage", "");
              await saveMedia({ coverImage: "" });
            }}
          />
        </div>
      )}

      {/* FOOTER */}
      <div className="flex items-center justify-between">
        {step === "details" ? (
          <>
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="article-cancel-btn"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSave}
              disabled={loading}
              data-testid="article-save-btn"
            >
              {loading
                ? mode === "create"
                  ? "Saving..."
                  : "Updating..."
                : mode === "create"
                ? "Save & Continue"
                : "Update & Continue"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={handleBack}
              data-testid="article-back-btn"
            >
              ← Back
            </Button>

            <Button onClick={handleDone} data-testid="article-done-btn">
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
