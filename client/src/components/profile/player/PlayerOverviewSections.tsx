import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  User,
  Target,
  SlidersHorizontal,
  Images,
  Pencil,
  Plus,
  Sparkles,
  CalendarClock,
  Activity,
  Trophy,
  Users2,
  MapPin,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";

/* =========================================================
   Shared types - all "mock/local" for this first pass, per
   the spec: no backend fields exist yet for these, so editing
   updates local state only. Kept here (not in player-profile.tsx)
   so that file doesn't grow any further.
========================================================= */
export interface LookingForData {
  tags: string[];
}

export interface PlayingPrefsData {
  skillLevel: string;
  preferredCourts: string[];
  gameFormat: string;
  playStyle: string;
  availability: string[];
  playRadiusKm: number;
  courtSurfacePreference: string;
}

export const LOOKING_FOR_OPTIONS = ["Hitting Partner", "Coach", "Playing Events", "Doubles", "Mixed"];
export const AVAILABILITY_OPTIONS = [
  "Weekday mornings",
  "Weekday evenings",
  "Saturday",
  "Sunday",
];
export const GAME_FORMAT_OPTIONS = ["Singles", "Doubles", "Both"];
export const PLAY_STYLE_OPTIONS = ["Social", "Competitive", "Both"];
export const COURT_OPTIONS = ["Hard", "Clay", "Grass", "Synthetic", "Any"];
export const SKILL_LEVEL_OPTIONS = ["Social", "Beginner", "Intermediate", "Advanced", "Pro"];

/* =========================================================
   About Me
========================================================= */
export function AboutMeCard({
  bio,
  isOwner,
  onSave,
}: {
  bio: string;
  isOwner: boolean;
  onSave: (bio: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(bio);

  if (!bio && !isOwner) return null;

  return (
    <Card data-testid="about-me-card" className="border-0 shadow-sm bg-muted/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="w-5 h-5" /> About me
        </CardTitle>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="edit-about-me"
            onClick={() => {
              setDraft(bio);
              setOpen(true);
            }}
          >
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      {bio && (
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">{bio}</p>
        </CardContent>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="edit-about-me-modal">
          <DialogHeader>
            <DialogTitle>About me</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="A short intro - what you play, how often, what you're like on court..."
            className="min-h-[120px]"
            data-testid="input-about-me"
          />
          <p className="text-xs text-muted-foreground text-right">{draft.length}/300</p>
          <DialogFooter>
            <Button
              onClick={() => {
                onSave(draft.trim());
                setOpen(false);
              }}
              data-testid="save-about-me"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =========================================================
   Looking For
========================================================= */
export function LookingForCard({
  data,
  isOwner,
  onSave,
}: {
  data: LookingForData;
  isOwner: boolean;
  onSave: (data: LookingForData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(data.tags);

  if (!data.tags.length && !isOwner) return null;

  const toggle = (tag: string) => {
    setDraft((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <Card data-testid="looking-for-card" className="border-0 shadow-sm bg-muted/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="w-5 h-5" /> Looking for
        </CardTitle>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="edit-looking-for"
            onClick={() => {
              setDraft(data.tags);
              setOpen(true);
            }}
          >
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      {data.tags.length > 0 && (
        <CardContent className="flex flex-wrap gap-2">
          {data.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-sm py-1 px-3">
              {tag}
            </Badge>
          ))}
        </CardContent>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="edit-looking-for-modal">
          <DialogHeader>
            <DialogTitle>Looking for</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {LOOKING_FOR_OPTIONS.map((tag) => (
              <Badge
                key={tag}
                variant={draft.includes(tag) ? "default" : "outline"}
                className="cursor-pointer text-sm py-1.5 px-3"
                onClick={() => toggle(tag)}
                data-testid={`looking-for-option-${tag.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                onSave({ tags: draft });
                setOpen(false);
              }}
              data-testid="save-looking-for"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =========================================================
   Playing Preferences
========================================================= */
export function PlayingPreferencesCard({
  data,
  isOwner,
  onSave,
}: {
  data: PlayingPrefsData;
  isOwner: boolean;
  onSave: (data: PlayingPrefsData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlayingPrefsData>(data);

  const toggleAvailability = (slot: string) => {
    setDraft((prev) => ({
      ...prev,
      availability: prev.availability.includes(slot)
        ? prev.availability.filter((s) => s !== slot)
        : [...prev.availability, slot],
    }));
  };

  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <BarChart3 className="w-4 h-4" />, label: "Level", value: data.skillLevel || "Not set" },
    { icon: <Users2 className="w-4 h-4" />, label: "Play style", value: data.playStyle || "Not set" },
    { icon: <Target className="w-4 h-4" />, label: "Game format", value: data.gameFormat || "Not set" },
    {
      icon: <CalendarClock className="w-4 h-4" />,
      label: "Availability",
      value: data.availability.join(", ") || "Not set",
    },
    {
      icon: <MapPin className="w-4 h-4" />,
      label: "Preferred areas",
      value: data.preferredCourts.join(", ") || "Not set",
    },
    { icon: <MapPin className="w-4 h-4" />, label: "Play radius", value: `Within ${data.playRadiusKm} km` },
    { icon: <Trophy className="w-4 h-4" />, label: "Courts", value: data.courtSurfacePreference || "Any" },
  ];

  return (
    <Card data-testid="playing-preferences-card" className="border-0 shadow-sm bg-muted/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SlidersHorizontal className="w-5 h-5" /> Playing preferences
        </CardTitle>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="edit-playing-preferences"
            onClick={() => {
              setDraft(data);
              setOpen(true);
            }}
          >
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-2">
            <span className="text-primary mt-0.5">{row.icon}</span>
            <div>
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="font-medium">{row.value}</p>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="edit-playing-preferences-modal">
          <DialogHeader>
            <DialogTitle>Playing preferences</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Level</p>
              <div className="flex flex-wrap gap-2">
                {SKILL_LEVEL_OPTIONS.map((opt) => (
                  <Badge
                    key={opt}
                    variant={draft.skillLevel === opt ? "default" : "outline"}
                    className="cursor-pointer py-1.5 px-3"
                    onClick={() => setDraft({ ...draft, skillLevel: opt })}
                  >
                    {opt}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Preferred areas</p>
              <Input
                value={draft.preferredCourts.join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    preferredCourts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="e.g. Bondi Beach, Manly"
                data-testid="input-preferred-areas"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Game format</p>
              <div className="flex flex-wrap gap-2">
                {GAME_FORMAT_OPTIONS.map((opt) => (
                  <Badge
                    key={opt}
                    variant={draft.gameFormat === opt ? "default" : "outline"}
                    className="cursor-pointer py-1.5 px-3"
                    onClick={() => setDraft({ ...draft, gameFormat: opt })}
                  >
                    {opt}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Play style</p>
              <div className="flex flex-wrap gap-2">
                {PLAY_STYLE_OPTIONS.map((opt) => (
                  <Badge
                    key={opt}
                    variant={draft.playStyle === opt ? "default" : "outline"}
                    className="cursor-pointer py-1.5 px-3"
                    onClick={() => setDraft({ ...draft, playStyle: opt })}
                  >
                    {opt}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Availability</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABILITY_OPTIONS.map((slot) => (
                  <Badge
                    key={slot}
                    variant={draft.availability.includes(slot) ? "default" : "outline"}
                    className="cursor-pointer py-1.5 px-3"
                    onClick={() => toggleAvailability(slot)}
                  >
                    {slot}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Court preference</p>
              <div className="flex flex-wrap gap-2">
                {COURT_OPTIONS.map((opt) => (
                  <Badge
                    key={opt}
                    variant={draft.courtSurfacePreference === opt ? "default" : "outline"}
                    className="cursor-pointer py-1.5 px-3"
                    onClick={() => setDraft({ ...draft, courtSurfacePreference: opt })}
                  >
                    {opt}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                onSave(draft);
                setOpen(false);
              }}
              data-testid="save-playing-preferences"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =========================================================
   Photos (max 4 shown, "See all" opens a lightbox-style dialog)
========================================================= */
export function PhotosCard({
  photos,
  isOwner,
  onAddPhoto,
  onDeletePhoto,
}: {
  photos: string[];
  isOwner: boolean;
  onAddPhoto?: () => void;
  onDeletePhoto?: (url: string) => void;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  // The enlarged single-photo view - set to an index to open it
  // directly on that photo (not just the small-thumbnail grid).
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (!photos.length && !isOwner) return null;

  const visible = photos.slice(0, 4);
  const openLightbox = (index: number) => {
    setGalleryOpen(false);
    setLightboxIndex(index);
  };
  const closeLightbox = () => setLightboxIndex(null);
  const showPrev = () =>
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  const showNext = () =>
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  const deleteCurrent = () => {
    if (lightboxIndex === null) return;
    const url = photos[lightboxIndex];
    onDeletePhoto?.(url);
    // Land on a sensible next photo (or close if that was the last one)
    // rather than pointing at a now-stale index.
    if (photos.length <= 1) {
      closeLightbox();
    } else {
      setLightboxIndex(Math.min(lightboxIndex, photos.length - 2));
    }
  };

  return (
    <Card data-testid="photos-card" className="border-0 shadow-sm bg-muted/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Images className="w-5 h-5" /> Photos
        </CardTitle>
        {photos.length > 4 && (
          <Button
            variant="link"
            size="sm"
            onClick={() => setGalleryOpen(true)}
            data-testid="see-all-photos"
          >
            See all ({photos.length})
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {visible.map((url, i) => (
          <button
            key={i}
            className="aspect-square rounded-lg overflow-hidden bg-muted"
            onClick={() => openLightbox(i)}
            data-testid={`photo-thumb-${i}`}
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
        {isOwner && (
          <button
            className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            onClick={onAddPhoto}
            data-testid="add-photo-button"
          >
            <Plus className="w-6 h-6 mb-1" />
            <span className="text-xs">Add photo</span>
          </button>
        )}
      </CardContent>

      {/* Thumbnail grid for browsing everything at once */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-3xl" data-testid="photos-gallery-modal">
          <DialogHeader>
            <DialogTitle>Photos</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto">
            {photos.map((url, i) => (
              <button
                key={i}
                className="aspect-square rounded-lg overflow-hidden bg-muted"
                onClick={() => openLightbox(i)}
                data-testid={`photo-gallery-thumb-${i}`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enlarged single-photo view */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent
          className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0 [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100 [&>button]:bg-black/40 [&>button]:rounded-full [&>button]:p-1.5"
          data-testid="photo-lightbox"
        >
          {/* Visually hidden, not omitted - Radix requires a
              DialogTitle for screen readers even when the dialog is
              a pure image viewer with no visible heading. */}
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {lightboxIndex !== null && (
            <div className="relative flex items-center justify-center min-h-[50vh] max-h-[85vh]">
              <img
                src={photos[lightboxIndex]}
                alt=""
                className="max-w-full max-h-[85vh] object-contain"
                data-testid="photo-lightbox-image"
              />

              {photos.length > 1 && (
                <>
                  <button
                    onClick={showPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                    data-testid="photo-lightbox-prev"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={showNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                    data-testid="photo-lightbox-next"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {isOwner && onDeletePhoto && (
                <button
                  onClick={deleteCurrent}
                  className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-destructive"
                  data-testid="photo-lightbox-delete"
                  aria-label="Delete photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =========================================================
   Sidebar: Good Match (visitor-only, mock percentage/reasons -
   per the spec, do NOT wire this to a real score until real
   matching logic exists)
========================================================= */
export function GoodMatchCard({
  percent,
  reasons,
  onSuggestGame,
}: {
  percent: number;
  reasons: string[];
  onSuggestGame: () => void;
}) {
  // Default/empty state: nothing in common was found yet (usually
  // because one or both profiles haven't filled in preferences) - a
  // friendly invitation instead of either a hollow "0%" or hiding the
  // whole card, so a visitor always sees SOMETHING here, not a gap.
  if (reasons.length === 0) {
    return (
      <Card data-testid="good-match-card" className="border-0 shadow-sm bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" /> Good match for you?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Not enough shared info yet to suggest a match score - but that doesn't mean you shouldn't say hi!
          </p>
          <Button className="w-full" onClick={onSuggestGame} data-testid="suggest-a-game-button">
            Suggest a game
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="good-match-card" className="border-0 shadow-sm bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-primary" /> Good match for you!
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-primary" data-testid="good-match-percent">
            {percent}%
          </div>
          <div>
            <p className="font-medium">Tennis Match</p>
            <ul className="text-sm text-muted-foreground space-y-0.5 mt-1">
              {reasons.map((reason, i) => (
                <li key={i}>✓ {reason}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Based on level, availability and preferred areas - a simple first pass, not a full matching algorithm yet.
        </p>
        <Button className="w-full" onClick={onSuggestGame} data-testid="suggest-a-game-button">
          Suggest a game
        </Button>
      </CardContent>
    </Card>
  );
}

/* =========================================================
   Sidebar: Availability (small quick-view - reuses Playing
   Preferences' own availability data, not a separate field)
========================================================= */
export function AvailabilityQuickCard({
  availability,
  isOwner,
}: {
  availability: string[];
  isOwner: boolean;
}) {
  if (!availability.length) {
    return (
      <Card data-testid="availability-quick-card" className="border-0 shadow-sm bg-muted/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="w-4 h-4" /> Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {isOwner
              ? "You haven't set your availability yet - add it in Playing preferences so other players know when to invite you."
              : "This player hasn't shared their availability yet."}
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card data-testid="availability-quick-card" className="border-0 shadow-sm bg-muted/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="w-4 h-4" /> Availability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">Usually available:</p>
        <div className="flex flex-wrap gap-2">
          {availability.map((slot) => (
            <Badge key={slot} variant="secondary">
              {slot}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================================================
   Sidebar: Latest Activity (max 3, mock for now - the spec
   says this should eventually be generated automatically and
   never manually edited)
========================================================= */
export interface ActivityItem {
  icon: "session" | "competition" | "venue";
  label: string;
  date: string;
}

export function LatestActivityCard({ items }: { items: ActivityItem[] }) {
  if (!items.length) return null;
  const iconFor = (type: ActivityItem["icon"]) =>
    type === "competition" ? (
      <Trophy className="w-4 h-4" />
    ) : type === "venue" ? (
      <MapPin className="w-4 h-4" />
    ) : (
      <Users2 className="w-4 h-4" />
    );

  return (
    <Card data-testid="latest-activity-card" className="border-0 shadow-sm bg-muted/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4" /> Latest activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm" data-testid={`activity-item-${i}`}>
            <span className="text-primary">{iconFor(item.icon)}</span>
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.date}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* =========================================================
   Bottom CTA - visitor-only
========================================================= */
export function PlayerBottomCTA({
  name,
  onInvite,
  onMessage,
}: {
  name: string;
  onInvite: () => void;
  onMessage: () => void;
}) {
  return (
    <div
      className="rounded-2xl bg-primary/5 border border-primary/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      data-testid="player-bottom-cta"
    >
      <div>
        <p className="font-bold text-lg">Let's hit the court!</p>
        <p className="text-muted-foreground text-sm">
          Tennis is better together. Invite {name} to play or send a message.
        </p>
      </div>
      <div className="flex gap-3 shrink-0">
        <Button onClick={onInvite} data-testid="bottom-cta-invite">
          Invite to Play
        </Button>
        <Button variant="outline" onClick={onMessage} data-testid="bottom-cta-message">
          Message
        </Button>
      </div>
    </div>
  );
}
