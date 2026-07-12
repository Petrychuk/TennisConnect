import { useRef, useState } from "react";

import { Upload, X, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  uploadContentImage,
  deleteContentImage,
  type ContentFolder,
} from "@/lib/uploadContentImage";

interface GalleryUploaderProps {
  folder: ContentFolder;
  entityId: string;
  value: string[];
  max?: number;
  label: string;
  description?: string;
  onChange: (urls: string[]) => void;
}

/**
 * Multi-image gallery uploader (up to `max` photos), supporting both
 * file upload and pasting an existing image URL. Each uploaded file gets
 * its own storage path (a per-image sub id under the shared entityId) so
 * gallery photos never overwrite one another or the entity's cover/logo.
 */
export function GalleryUploader({
  folder,
  entityId,
  value,
  max = 10,
  label,
  description,
  onChange,
}: GalleryUploaderProps) {

  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const images = value || [];
  const canAddMore = images.length < max;

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    const file = e.target.files?.[0];

    if (!file) return;

    if (!canAddMore) {
      toast({
        variant: "destructive",
        title: `Maximum ${max} photos allowed`,
      });
      e.target.value = "";
      return;
    }

    try {

      setLoading(true);

      const subId =
        `${entityId}-gallery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const result = await uploadContentImage(
        file,
        folder,
        subId,
        "image"
      );

      onChange([...images, result.url]);

    } catch (err) {

      console.error(err);

      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Unable to upload image.",
      });

    } finally {

      setLoading(false);
      e.target.value = "";

    }

  }

  function handleAddUrl() {

    const url = urlInput.trim();

    if (!url) return;

    if (!canAddMore) {
      toast({
        variant: "destructive",
        title: `Maximum ${max} photos allowed`,
      });
      return;
    }

    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Please enter a valid image URL.",
      });
      return;
    }

    onChange([...images, url]);
    setUrlInput("");
  }

  async function handleRemove(index: number) {

    const url = images[index];
    const next = images.filter((_, i) => i !== index);

    onChange(next);

    // Best-effort cleanup for our own uploaded files. Pasted external
    // URLs won't match our /media/ path and are simply skipped.
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.split("/media/").pop();
      if (path) await deleteContentImage(path);
    } catch {
      // external URL, or already removed — nothing to clean up
    }
  }

  return (

    <section
      className="space-y-4"
      data-testid="gallery-uploader"
    >

      <div>
        <Label className="text-base font-semibold">
          {label}
        </Label>

        {description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUpload}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

        {images.map((url, i) => (

          <div
            key={`${url}-${i}`}
            className="relative group rounded-xl overflow-hidden border bg-muted/20"
            data-testid={`gallery-item-${i}`}
          >

            <img
              src={url}
              alt={`${label} ${i + 1}`}
              className="h-28 w-full object-cover"
            />

            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="
                absolute
                top-1.5
                right-1.5
                rounded-full
                bg-black/60
                p-1
                text-white
                opacity-0
                group-hover:opacity-100
                transition-opacity
              "
              data-testid={`gallery-remove-${i}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>

          </div>

        ))}

        {canAddMore && (

          <button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            className="
              flex
              h-28
              flex-col
              items-center
              justify-center
              gap-1
              rounded-xl
              border
              border-dashed
              bg-muted/20
              text-muted-foreground
              hover:bg-muted/40
              transition-colors
            "
            data-testid="gallery-upload-btn"
          >

            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}

            <span className="text-xs">
              {loading ? "Uploading..." : "Upload photo"}
            </span>

          </button>

        )}

      </div>

      <p className="text-xs text-muted-foreground">
        {images.length} / {max} photos
      </p>

      {canAddMore && (

        <div className="flex gap-2" data-testid="gallery-url-row">

          <Input
            placeholder="Or paste an image URL"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            data-testid="gallery-url-input"
          />

          <Button
            type="button"
            variant="outline"
            onClick={handleAddUrl}
            data-testid="gallery-url-add-btn"
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            Add
          </Button>

        </div>

      )}

    </section>
  );
}
