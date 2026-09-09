// Single place for client-side image optimisation before upload.
//
// Every upload flow across the site (avatar, cover, club/travel/article
// content images, galleries) used to send the original file straight to
// Supabase Storage - a phone photo at 4-8MB, full resolution, was stored
// and served as-is. This resizes + re-encodes to WebP in the browser
// before the file ever leaves the device: smaller uploads, smaller
// stored objects, faster page loads everywhere those images render.
//
// Named `resizeImage` (not `optimizeImage` or similar) to match the one
// name this concept already had in the codebase, per the "reuse
// resizeImage() instead of introducing duplicate image-processing logic"
// requirement - even though, audited across the whole app, nothing was
// actually calling it yet (the one existing import, in coach-profile.tsx,
// was dead - the real upload path there did a raw fetch that bypassed it
// entirely). This rewrite is what every upload flow now actually calls.

export type ImagePreset = "avatar" | "cover" | "content" | "gallery" | "session-cover";

interface PresetConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  // Center-crop to a square before scaling. Only avatars need this -
  // every <Avatar> in the app renders as a circle/square with
  // object-cover, so shipping a square file avoids the browser doing
  // that same crop over and over on every page that shows it, and
  // guarantees the stored file matches what's actually displayed.
  square?: boolean;
}

// Chosen per type, not a single global size:
// - avatar: small on screen everywhere it appears (nav, cards, lists),
//   so it can be aggressively small and still look sharp.
// - cover: full-width hero banners - needs more width headroom, but
//   height is capped since covers are always cropped to a wide strip,
//   never displayed anywhere near their full uploaded height.
// - content: club/court/article/travel/marketplace/tournament images -
//   general-purpose, displayed at various sizes up to full-width cards.
// - gallery: same ceiling as content; multiple photos per entity, so
//   keeping each one reasonably small matters more here, not less.
const PRESETS: Record<ImagePreset, PresetConfig> = {
  avatar: { maxWidth: 512, maxHeight: 512, quality: 0.8, square: true },
  cover: { maxWidth: 1600, maxHeight: 800, quality: 0.75 },
  // Live-session cover photo (tc-live-v0.1) - same wide-banner shape as
  // a profile cover, just a different upload type on the server side
  // (/api/uploadMedia/session-cover vs /api/uploadMedia/cover).
  "session-cover": { maxWidth: 1600, maxHeight: 800, quality: 0.75 },
  content: { maxWidth: 1600, maxHeight: 1600, quality: 0.75 },
  gallery: { maxWidth: 1600, maxHeight: 1600, quality: 0.75 },
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read the selected file"));

    reader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error("Could not read the selected file"));
        return;
      }

      const img = new Image();
      // Modern browsers already rotate the decoded bitmap to match the
      // file's EXIF orientation tag before handing it to <img>/canvas,
      // so a photo taken sideways on a phone still draws upright here
      // with no extra handling needed - this was checked against actual
      // portrait/landscape EXIF-tagged files, not assumed.
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode the selected file as an image"));
      img.src = e.target.result as string;
    };

    reader.readAsDataURL(file);
  });
}

// Resizes/compresses `file` per `preset` and returns a ready-to-upload
// WebP File - drop the result straight into a FormData "file" field in
// place of the original. Falls back to returning the original file
// untouched if anything about the resize fails (corrupt image, browser
// can't produce a canvas, etc.) - a slightly-too-large upload beats a
// broken one.
export async function resizeImage(
  file: File,
  preset: ImagePreset
): Promise<File> {
  try {
    const config = PRESETS[preset];
    const img = await loadImage(file);

    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;

    if (config.square) {
      const side = Math.min(sw, sh);
      sx = (sw - side) / 2;
      sy = (sh - side) / 2;
      sw = side;
      sh = side;
    }

    // Never upscale - a source image already smaller than the preset
    // ceiling is left at its own size (min(..., 1)).
    const ratio = Math.min(config.maxWidth / sw, config.maxHeight / sh, 1);
    const outWidth = Math.max(1, Math.round(sw * ratio));
    const outHeight = Math.max(1, Math.round(sh * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available");

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", config.quality);
    });

    if (!blob || blob.size === 0) {
      // Encoding failed silently (seen on some older WebViews without
      // WebP canvas export) - fall back rather than upload a 0-byte file.
      return file;
    }

    // Uploading a bigger file than we started with would defeat the
    // point - e.g. a already-tiny, already-compressed source image
    // re-encoded at a fixed quality can occasionally come out larger.
    if (blob.size >= file.size) {
      return file;
    }

    const outName = file.name.replace(/\.[^./\\]+$/, "") + ".webp";
    return new File([blob], outName, { type: "image/webp" });
  } catch (error) {
    console.error("resizeImage: falling back to the original file", error);
    return file;
  }
}
