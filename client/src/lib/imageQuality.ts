/**
 * Loads an image URL just to read its natural dimensions, then warns via
 * the given toast function if it's smaller than recommended. Never blocks
 * the upload — this is guidance, not validation, since we still want to
 * accept whatever the admin provides.
 */
export function warnIfImageTooSmall(
  url: string,
  minWidth: number,
  minHeight: number,
  label: string,
  toast: (opts: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }) => void
) {
  const img = new Image();
  img.onload = () => {
    if (img.naturalWidth < minWidth || img.naturalHeight < minHeight) {
      toast({
        title: "This image is a bit small",
        description: `${label} is ${img.naturalWidth}\u00d7${img.naturalHeight}px. For a sharp result on the live page, aim for at least ${minWidth}\u00d7${minHeight}px.`,
      });
    }
  };
  img.src = url;
}
