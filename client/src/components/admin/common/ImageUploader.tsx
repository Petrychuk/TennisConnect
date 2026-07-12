import { useRef, useState } from "react";

import { Upload, Trash2, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  uploadContentImage,
  deleteContentImage,
  type ContentFolder,
  type ContentImageType,
} from "@/lib/uploadContentImage";

interface ImageUploaderProps {
  folder: ContentFolder;
  entityId: string;
  type: ContentImageType;
  value?: string;
  label: string;
  description?: string;

  // When true, also shows a "paste an image URL" input as an alternative
  // to uploading a file. Off by default so existing usages (e.g. Clubs)
  // are unaffected.
  allowUrl?: boolean;

  onUploaded: (url: string) => void;
  onDeleted?: () => void;
}

export function ImageUploader({
  folder,
  entityId,
  type,
  value,
  label,
  description,
  allowUrl = false,
  onUploaded,
  onDeleted,
}: ImageUploaderProps) {

  const inputRef =
    useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [loading, setLoading] =
    useState(false);
  const [urlInput, setUrlInput] =
    useState("");

  // Upload Image
 
  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    const file = e.target.files?.[0];

    if (!file) return;

    try {

      setLoading(true);

      const result =
        await uploadContentImage(
          file,
          folder,
          entityId,
          type
        );

      onUploaded(result.url);

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
  
  // Delete Image

  async function handleDelete() {

    if (!value) return;

    try {

      setLoading(true);

      const url = new URL(value);
      const path = url.pathname
        .split("/media/")
        .pop();

      if (!path) {
        throw new Error("Invalid image path");
      }

      await deleteContentImage(path);

      onDeleted?.();

    } catch (err) {

      console.error(err);

      alert("Failed to delete image.");

    } finally {

      setLoading(false);

    }

  }

  // Use a pasted image URL directly (no upload)

  function handleUseUrl() {

    const url = urlInput.trim();

    if (!url) return;

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

    onUploaded(url);
    setUrlInput("");
  }

  return (

    <section
      className="space-y-4"
      data-testid={`${type}-uploader`}
    >
    
    {/* Heading */}
     
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

      {/* Hidden Input */}

      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUpload}
      />

      {/* Preview */}
      
      <div
        className="
          rounded-2xl
          border
          border-dashed
          bg-muted/20
          p-5
        "
      >

        {value ? (

          <img
            src={value}
            alt={label}
            data-testid={`${type}-preview`}
            className="
              h-56
              w-full
              rounded-xl
              object-cover
            "
          />

        ) : (

          <div
            className="
              flex
              h-56
              flex-col
              items-center
              justify-center
              rounded-xl
              bg-muted/40
            "
          >

            <Upload
              className="mb-4 h-10 w-10 text-muted-foreground"
            />
            <p className="font-medium">
              No image uploaded
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              PNG, JPG or WEBP
            </p>
            <p className="text-sm text-muted-foreground">
              Maximum file size 10 MB
            </p>
          </div>

        )}

      </div>
      {/* Actions */}

      <div className="flex flex-wrap gap-3">

        <Button
          type="button"
          variant={value ? "outline" : "default"}
          disabled={loading}
          data-testid={`${type}-upload-btn`}
          onClick={() => inputRef.current?.click()}
        >

          {loading ? (

            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>

          ) : value ? (

            <>
              <Upload className="mr-2 h-4 w-4" />
              Replace Image
            </>

          ) : (

            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Image
            </>

          )}

        </Button>

        {value && (

          <Button
            type="button"
            variant="destructive"
            disabled={loading}
            data-testid={`${type}-delete-btn`}
            onClick={handleDelete}
          >

            <Trash2 className="mr-2 h-4 w-4" />

            Delete

          </Button>

        )}
      </div>

      {allowUrl && (

        <div
          className="flex gap-2"
          data-testid={`${type}-url-row`}
        >

          <Input
            placeholder="Or paste an image URL"
            value={urlInput}
            onChange={(e) =>
              setUrlInput(e.target.value)
            }
            data-testid={`${type}-url-input`}
          />

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleUseUrl}
            data-testid={`${type}-url-use-btn`}
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            Use URL
          </Button>

        </div>

      )}
    </section>
  );
}