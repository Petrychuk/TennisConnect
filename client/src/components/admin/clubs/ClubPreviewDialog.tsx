import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog"; 
  import { Button } from "@/components/ui/button";
  import { ClubCard } from "@/components/clubs/ClubCard";
  import { Badge } from "@/components/ui/badge";
  
  interface ClubPreviewDialogProps {
    open: boolean;
    onClose: () => void;
    onEdit: () => void;
    onToggleStatus: () => void;
    club: any;
    }
  
  export function ClubPreviewDialog({
    open,
    onClose,
    club,
    onEdit,
    onToggleStatus,
  }: ClubPreviewDialogProps) {
  
    if (!club) return null;
  
    const isPremium =
      club.listingType === "premium";
  
    return (  
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
  
        <DialogContent
            className="
            w-[95vw]
            max-w-[900px]
            max-h-[92vh]
            overflow-y-auto"
            data-testid="club-preview-dialog"> 
          <DialogHeader>
            <DialogTitle data-testid="club-preview-title">  
              Club Preview
              </DialogTitle>

              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <div className="flex items-center gap-2">

                    <Badge>
                        {club.listingType === "premium"
                            ? "Premium Listing"
                            : "Free Listing"}
                    </Badge>

                    <p className="text-sm text-muted-foreground">
                        {club.listingType === "premium"
                            ? "This club will have its own Premium page."
                            : "This club will appear in the public directory."}
                    </p>

                </div>
            </div>
          </DialogHeader>
  
          <div className="space-y-10"
              data-testid="club-preview-content">
           
        {/* Directory Preview */}       
            <section data-testid="club-directory-preview"> 
              <p 
                className="text-sm text-muted-foreground mb-5"
                data-testid="club-directory-preview-description"> 

                This is how your club will appear in the Clubs directory.  
              </p> 
              <ClubCard
                club={club}
                preview
                disableAnimation
              />
  
            </section>

            {/* Premium Preview */} 
            {isPremium && (
  
              <section
                className="
                  rounded-2xl
                  border
                  bg-muted/20
                  p-8
                "
                data-testid="club-premium-preview"
              > 
                <h3 
                className="text-xl font-bold"
                data-testid="club-premium-preview-title"> 
                  Premium Club Page 
                </h3>  
                <p 
                className="mt-3 text-muted-foreground"
                data-testid="club-premium-preview-description">  
                  Premium Club Page Preview will be available soon.  
                </p>  
                <ul className="mt-6 space-y-2 text-sm"
                data-testid="club-premium-preview-features">
  
                  <li>✓ Hero Banner</li>
                  <li>✓ Club Logo</li>
                  <li>✓ Image Gallery</li>
                  <li>✓ About Club</li>
                  <li>✓ Court Information</li>
                  <li>✓ Competitions</li>
                  <li>✓ Contact Person</li>
                  <li>✓ Booking CTA</li>
  
                </ul> 
              </section> 
            )}
  
          </div>
  
          <div
            className="flex items-center justify-between pt-6 border-t"
            data-testid="club-preview-footer"
            >

            <Button
                variant="outline"
                onClick={onClose}
                data-testid="club-preview-cancel-btn"
            >
                Cancel
            </Button>

            <div className="flex gap-3">

                <Button
                variant="outline"
                onClick={onEdit}
                data-testid="club-preview-edit-btn"
                >
                Edit
                </Button>

                <Button
                onClick={onToggleStatus}
                data-testid="club-preview-publish-btn"
                >
                {club.status === "published"
                    ? "Hide"
                    : "Publish"}
                </Button>
            </div>
            </div>  
        </DialogContent>  
      </Dialog> 
    );  
  }