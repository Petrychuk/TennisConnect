import { useRef } from "react";
import type { ClubFormData } from "../ClubForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownToolbar } from "@/components/admin/common/MarkdownToolbar";

import { CLUB_CATEGORIES } from "@shared/constants/clubs";

interface ClubBasicSectionProps {
    form: ClubFormData;
  
    updateField: <K extends keyof ClubFormData>(
      key: K,
      value: ClubFormData[K]
    ) => void;
  }

export function ClubBasicSection({
  form,
  updateField,
}: ClubBasicSectionProps) {
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  return (
    <section className="space-y-8">

      {/* Heading */}
      <div>
        <h2 className="text-2xl font-display font-semibold">
          Basic Information
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Basic information displayed on the club listing.
        </p>
      </div>

      {/* Name */}
     
      <div className="space-y-2">

        <Label htmlFor="club-name">
          Club / Community Name *
        </Label>

        <Input
          id="club-name"
          data-testid="club-name"
          placeholder="e.g. Lyne Park Tennis Centre"
          value={form.name}
          onChange={(e) =>
            updateField("name", e.target.value)
          }
        />

      </div>

      {/* Slug */}

      <div className="space-y-2">

        <Label htmlFor="club-slug">
          Slug
        </Label>

        <Input
          id="club-slug"
          data-testid="club-slug"
          placeholder="lyne-park-tennis-centre"
          value={form.slug}
          onChange={(e) =>
            updateField("slug", e.target.value)
          }
        />

        <p className="text-xs text-muted-foreground">
          Used for the public club page URL.
        </p>

      </div>

      {/* Category */}
 
      <div className="space-y-2">
        <Label htmlFor="club-category">
            Category *
        </Label>

        <Select
            value={form.category}
            onValueChange={(value) =>
            updateField("category", value)
            }
        >
            <SelectTrigger
            id="club-category"
            data-testid="club-category"
            >
            <SelectValue placeholder="Select category" />
            </SelectTrigger>

            <SelectContent>
            {CLUB_CATEGORIES.map((category) => (
                <SelectItem
                key={category.value}
                value={category.value}
                >
                {category.label}
                </SelectItem>
            ))}
            </SelectContent>
        </Select>
        </div>
      
      {/* Short Description */}
      <div className="space-y-2">

        <Label htmlFor="club-short-description">
          Short Description
        </Label>

        <Textarea
          id="club-short-description"
          data-testid="club-short-description"
          placeholder="Displayed on the club card..."
          rows={3}
          value={form.shortDescription}
          onChange={(e) =>
            updateField(
                "shortDescription",
                e.target.value
              )
          }
        />

        <p className="text-xs text-muted-foreground">
          Recommended 120–180 characters.
        </p>

      </div>
     
      {form.listingType === "premium" && (
       <>
      
      {/* Description */}     
      <div className="space-y-2">

        <Label htmlFor="club-description">
          Full Description *
        </Label>

        <p className="text-xs text-muted-foreground">
          Use the toolbar to format headings, bold text, lists and more —
          it's rendered properly on the club's live page.
        </p>

        <MarkdownToolbar
          textareaRef={descriptionRef}
          value={form.description}
          onChange={(v) => updateField("description", v)}
        />

        <Textarea
          ref={descriptionRef}
          id="club-description"
          data-testid="club-description"
          placeholder="Describe the club, community, facilities and atmosphere..."
          rows={8}
          className="rounded-t-none"
          value={form.description}
          onChange={(e) =>
            updateField(
                "description",
                e.target.value
              )
          }
        />

      </div>
      </>
    )}

    </section>
  );
}