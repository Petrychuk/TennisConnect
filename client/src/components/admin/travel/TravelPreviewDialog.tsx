import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, ExternalLink } from "lucide-react";

interface TravelPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  pkg: any;
}

export function TravelPreviewDialog({
  open,
  onClose,
  pkg,
  onEdit,
  onToggleStatus,
}: TravelPreviewDialogProps) {
  if (!pkg) return null;

  const isPublished = !!pkg.isActive;

  const formatDate = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString("en-AU", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "TBA";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        className="w-[95vw] max-w-[900px] max-h-[92vh] overflow-y-auto"
        data-testid="travel-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle data-testid="travel-preview-title">
            Travel Package Preview
          </DialogTitle>

          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
            <div className="flex items-center gap-2">
              <Badge>{isPublished ? "Published" : "Hidden"}</Badge>
              <p className="text-sm text-muted-foreground">
                {isPublished
                  ? "This package is live on the Travel page."
                  : "This package is hidden from the public Travel page."}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6" data-testid="travel-preview-content">
          <p
            className="text-sm text-muted-foreground"
            data-testid="travel-preview-description"
          >
            This is how your package will appear on the Travel page.
          </p>

          <div className="group overflow-hidden border-none shadow-lg rounded-2xl">
            <div className="relative aspect-4/3 overflow-hidden bg-secondary/50">
              <img
                src={pkg.coverImage}
                alt={pkg.title}
                className="w-full h-full object-cover"
              />
              {pkg.isFeatured && (
                <div className="absolute top-3 left-3">
                  <Badge className="bg-primary text-primary-foreground font-bold border-none">
                    Featured
                  </Badge>
                </div>
              )}
              {typeof pkg.spotsLeft === "number" && pkg.spotsLeft <= 5 && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-red-500 text-white border-none">
                    {pkg.spotsLeft} spots
                  </Badge>
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <h3 className="font-bold text-xl mb-1 line-clamp-1">
                  {pkg.title}
                </h3>
                <div className="flex items-center gap-1 text-sm opacity-90">
                  <MapPin className="w-3 h-3" /> {pkg.destination}
                </div>
              </div>
            </div>

            <div className="p-5 bg-card">
              <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {formatDate(pkg.startDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {pkg.duration}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {pkg.description}
              </p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-display font-bold">
                  ${pkg.price}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    {pkg.currency}
                  </span>
                </p>
                <a
                  href={`/travel/${pkg.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="travel-preview-open-full-page"
                >
                  Open full page <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-between pt-6 border-t"
          data-testid="travel-preview-footer"
        >
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="travel-preview-cancel-btn"
          >
            Cancel
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onEdit}
              data-testid="travel-preview-edit-btn"
            >
              Edit
            </Button>

            <Button
              onClick={onToggleStatus}
              data-testid="travel-preview-publish-btn"
            >
              {isPublished ? "Hide" : "Publish"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
