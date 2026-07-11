import { Eye, EyeOff, Pencil, Trash2, Globe, Star, } from "lucide-react";
  
  import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import { Card } from "@/components/ui/card";
  
  interface ClubAdminCardProps {
    club: {
      id: string;
      name: string;
      image?: string;
      state?: string;
      suburb?: string;
      listingType: "free" | "premium";
      status: "draft" | "published" | "hidden";
    };
  
    onEdit: () => void;
    onPreview: () => void;
    onToggleStatus: () => void;
    onDelete: () => void;
  }
  
  export function ClubAdminCard({
    club,
    onEdit,
    onPreview,
    onToggleStatus,
    onDelete,
  }: ClubAdminCardProps) {
    return (
      <Card className="overflow-hidden rounded-2xl shadow-sm">
  
        {/* Image */}
  
        <div className="relative aspect-16/10 overflow-hidden bg-muted">
  
          <img
            src={
              club.image ||
              "/assets/images/default-club.jpg"
            }
            alt={club.name}
            className="h-full w-full object-cover"
          />
  
          {club.listingType === "premium" && (
            <Badge
              className="
                absolute
                right-3
                top-3
                bg-primary
                text-primary-foreground
              "
            >
              <Star className="mr-1 h-3 w-3 fill-current" />
              Premium
            </Badge>
          )}
  
        </div>
  
        {/* Content */}
  
        <div className="space-y-1 p-4">
  
          <h3 className="line-clamp-1 text-lg font-semibold">
            {club.name}
          </h3>
  
          <p className="text-sm text-muted-foreground">
            {[club.suburb, club.state]
              .filter(Boolean)
              .join(", ")}
          </p>
  
        </div>
  
        {/* Actions */}
  
        <div
          className="
            flex
            items-center
            justify-center
            gap-2
            border-t
            p-3
          "
        >
  
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
  
          <Button
            size="icon"
            variant="ghost"
            onClick={onPreview}
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </Button>
  
          <Button
            size="icon"
            variant={
              club.status === "published"
                ? "default"
                : "outline"
            }
            onClick={onToggleStatus}
            title={
              club.status === "published"
                ? "Hide"
                : "Publish"
            }
          >
            {club.status === "published" ? (
            <EyeOff className="h-4 w-4" />
            ) : (
            <Globe className="h-4 w-4" />
            )}
          </Button>
  
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            title="Delete"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
  
        </div>
  
      </Card>
    );
  }