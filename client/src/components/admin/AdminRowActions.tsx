import { Edit, ExternalLink, Eye, Globe, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// The action buttons at the end of an Admin table row (clubs, travel
// packages, articles). Icon-only, so every button has a spoken name and a
// tooltip that say what it does to which item. The publish toggle is the
// lime button while the item is live, outline while it is hidden/draft.
// Wraps onto a second line on narrow screens instead of overflowing.
export interface AdminRowActionsProps {
  itemName: string;
  published: boolean;
  onEdit: () => void;
  onPreview?: () => void;
  /** Public page, opened in a new tab. */
  liveHref?: string;
  onTogglePublish: () => void;
  onDelete: () => void;
  testIds?: Partial<Record<"edit" | "preview" | "live" | "toggle" | "delete", string>>;
}

export function AdminRowActions({ itemName, published, onEdit, onPreview, liveHref, onTogglePublish, onDelete, testIds = {} }: AdminRowActionsProps) {
  const publishLabel = published ? `Unpublish ${itemName}` : `Publish ${itemName}`;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Edit ${itemName}`} title="Edit" data-testid={testIds.edit}>
        <Edit aria-hidden="true" />
      </Button>
      {onPreview && (
        <Button size="icon" variant="ghost" onClick={onPreview} aria-label={`Preview ${itemName}`} title="Preview" data-testid={testIds.preview}>
          <Eye aria-hidden="true" />
        </Button>
      )}
      {liveHref && (
        <Button size="icon" variant="ghost" asChild title="View live page" data-testid={testIds.live}>
          <a href={liveHref} target="_blank" rel="noopener noreferrer" aria-label={`View live page for ${itemName} (opens in a new tab)`}>
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      )}
      <Button
        size="icon"
        variant={published ? "default" : "outline"}
        onClick={onTogglePublish}
        aria-label={publishLabel}
        title={published ? "Published - click to unpublish" : "Not published - click to publish"}
        data-testid={testIds.toggle}
      >
        <Globe aria-hidden="true" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onDelete}
        aria-label={`Delete ${itemName}`}
        title="Delete"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        data-testid={testIds.delete}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}
