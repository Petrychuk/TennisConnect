import { Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

// No real photos backend yet, so this is the empty state — matches the
// mockup's "Photos" tab existing as a place to put them once uploads work.
export function PhotosTab() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-dashed border-border"
      data-testid="organiser-session-photos-tab"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <ImageIcon className="w-7 h-7" />
      </div>
      <h3 className="font-display text-lg font-bold">No photos yet</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        Photos from this session will show up here once uploads are wired up.
      </p>
      <Button className="mt-6" disabled data-testid="organiser-session-photos-upload" title="Coming soon">
        <Upload className="w-4 h-4 mr-2" />
        Upload Photos
      </Button>
    </div>
  );
}
