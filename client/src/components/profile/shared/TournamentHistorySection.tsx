import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Calendar, Trophy, Edit2, Plus, Trash2, Camera, MapPin } from "lucide-react";

type TournamentDraft = {
  id: string;
  name: string;
  location: string;
  date: string;
  result: string;
  award: string;
  photos: string[];
};

const BLANK_DRAFT: TournamentDraft = {
  id: "",
  name: "",
  location: "",
  date: "",
  result: "",
  award: "",
  photos: [],
};

interface TournamentHistorySectionProps {
  userId: string;
  isOwnProfile: boolean;
}

// Tournament results (win/loss history) — works for players and coaches
// alike, since /api/profile/tournament-history isn't role-restricted.
export function TournamentHistorySection({ userId, isOwnProfile }: TournamentHistorySectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<TournamentDraft[]>([]);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [newTournament, setNewTournament] = useState<TournamentDraft>(BLANK_DRAFT);
  const [editingTournament, setEditingTournament] = useState<TournamentDraft | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(`/api/profile/tournament-history?userId=${userId}`);
        if (res.ok) setTournaments(await res.json());
      } catch (err) {
        console.error("tournaments fetch failed", err);
      }
    })();
  }, [userId]);

  const resetTournamentForm = () => {
    setNewTournament(BLANK_DRAFT);
    setEditingTournament(null);
  };

  const handleSaveTournament = async () => {
    const editingTournamentId = editingTournament?.id ?? null;
    const isEdit = Boolean(editingTournamentId);

    const url = isEdit
      ? `/api/profile/tournament-history/${editingTournamentId}`
      : `/api/profile/tournament-history`;

    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTournament.name,
        location: newTournament.location,
        date: newTournament.date,
        result: newTournament.result,
        award: newTournament.award,
      }),
      credentials: "include",
    });

    const saved = await res.json();

    setTournaments((prev) =>
      prev.some((t) => t.id === saved.id)
        ? prev.map((t) => (t.id === saved.id ? saved : t))
        : [...prev, saved]
    );

    if (isEdit) {
      setIsTournamentModalOpen(false);
      resetTournamentForm();
      toast({ title: "Tournament updated" });
    } else {
      setNewTournament(saved);
      setEditingTournament(saved);
      toast({ title: "Tournament created. Upload photos." });
    }
  };

  const handleTournamentPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !newTournament.id) return;

    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 5 - (newTournament.photos?.length ?? 0);
    const filesToUpload = files.slice(0, remaining);

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/profile/tournament-history/${newTournament.id}/photos`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!res.ok) throw new Error("Upload failed");

        const updatedTournament = await res.json();
        setNewTournament(updatedTournament);
        setTournaments((prev) =>
          prev.map((t) => (t.id === updatedTournament.id ? updatedTournament : t))
        );
      } catch (err) {
        console.error("Tournament image upload failed", err);
      }
    }

    e.target.value = "";
  };

  const removeTournamentPhoto = async (index: number) => {
    if (!newTournament.id) return;

    const res = await fetch(`/api/profile/tournament-history/${newTournament.id}/photos/${index}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      toast({ variant: "destructive", title: "Failed to remove photo" });
      return;
    }

    const updatedTournament = await res.json();
    setNewTournament(updatedTournament);
    setTournaments((prev) =>
      prev.map((t) => (t.id === updatedTournament.id ? updatedTournament : t))
    );
  };

  const handleDeleteTournamentHistory = async (id: string) => {
    const res = await fetch(`/api/profile/tournament-history/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) throw new Error("Delete failed");
    setTournaments((prev) => prev.filter((t) => t.id !== id));
  };

  const today = new Date().toISOString().split("T")[0];
  const sortedTournaments = [...tournaments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const upcoming = sortedTournaments.filter((t) => t.date > today);
  const past = sortedTournaments.filter((t) => t.date <= today);

  const TournamentCard = ({ t }: { t: any }) => (
    <Card key={t.id} className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {t.photos && t.photos.length > 0 && (
            <div className="w-full md:w-48 h-48 md:h-auto shrink-0 bg-muted relative">
              <img src={t.photos[0]} alt={t.name} className="w-full h-full object-cover" />
              {t.photos.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  +{t.photos.length - 1} more
                </div>
              )}
            </div>
          )}

          <div className="grow p-6 flex flex-col justify-between">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xl">{t.name}</h4>
                  {(t.result === "Winner" || t.result === "Champion") && (
                    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1 pl-1 pr-2">
                      <Trophy className="w-3 h-3 fill-current" /> Winner
                    </Badge>
                  )}
                  {(t.result === "Finalist" || t.result === "Runner-up") && (
                    <Badge variant="secondary" className="bg-slate-300 text-slate-800 gap-1 pl-1 pr-2">
                      <Trophy className="w-3 h-3" /> Finalist
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(t.date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {t.location}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <div className="font-bold text-primary text-lg">{t.result}</div>
                  {t.award && <div className="text-sm text-muted-foreground">{t.award}</div>}
                </div>
                {isOwnProfile && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setNewTournament(t);
                        setEditingTournament(t);
                        setIsTournamentModalOpen(true);
                      }}
                      data-testid={`edit-tournament-${t.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTournamentHistory(t.id)}
                      className="text-destructive"
                      data-testid={`delete-tournament-${t.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {t.photos && t.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 pt-2 border-t mt-2">
                {t.photos.map((photo: string, i: number) => (
                  <div
                    key={i}
                    className="w-12 h-12 rounded-md overflow-hidden shrink-0 border bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <img src={photo} className="w-full h-full object-cover" alt={`Gallery ${i}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8" data-testid="tournament-history-section">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Tournament History</h3>
        {isOwnProfile && (
          <Dialog
            open={isTournamentModalOpen}
            onOpenChange={(open) => {
              setIsTournamentModalOpen(open);
              if (!open) resetTournamentForm();
            }}
          >
            <DialogTrigger asChild>
              <Button data-testid="add-tournament-entry">
                <Plus className="w-4 h-4 mr-2" /> Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Tournament Result</DialogTitle>
                <DialogDescription>Add your tournament result and match details.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tournament Name</Label>
                  <Input
                    value={newTournament.name}
                    onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                    placeholder="e.g. Sydney Open 2024"
                    data-testid="tournament-name-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newTournament.date}
                      onChange={(e) => setNewTournament({ ...newTournament, date: e.target.value })}
                      data-testid="tournament-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      value={newTournament.location}
                      onChange={(e) => setNewTournament({ ...newTournament, location: e.target.value })}
                      placeholder="e.g. Homebush"
                      data-testid="tournament-location-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Result</Label>
                    <Select
                      value={newTournament.result}
                      onValueChange={(val) => setNewTournament({ ...newTournament, result: val })}
                    >
                      <SelectTrigger data-testid="tournament-result-select">
                        <SelectValue placeholder="Select Result" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Winner">Winner</SelectItem>
                        <SelectItem value="Runner Up">Runner Up</SelectItem>
                        <SelectItem value="Semi-Finalist">Semi-Finalist</SelectItem>
                        <SelectItem value="Quarter-Finalist">Quarter-Finalist</SelectItem>
                        <SelectItem value="Round of 16">Round of 16</SelectItem>
                        <SelectItem value="Round of 32">Round of 32</SelectItem>
                        <SelectItem value="Participation">Participation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Award/Prize (Optional)</Label>
                    <Input
                      value={newTournament.award}
                      onChange={(e) => setNewTournament({ ...newTournament, award: e.target.value })}
                      placeholder="e.g. Gold Trophy"
                      data-testid="tournament-award-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Tournament Photos (Max 5)
                    {!newTournament.id && (
                      <span className="text-xs text-muted-foreground block">
                        Save tournament first to upload photos
                      </span>
                    )}
                  </Label>
                  <div className="flex flex-wrap gap-4">
                    {newTournament.photos.map((photo, index) => (
                      <div key={index} className="relative w-20 h-20 group">
                        <img src={photo} alt={`Upload ${index}`} className="w-full h-full object-cover rounded-md border" />
                        <button
                          onClick={() => removeTournamentPhoto(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`remove-tournament-photo-${index}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {newTournament.photos.length < 5 && (
                      <label
                        className={`
                          w-20 h-20 border-2 border-dashed rounded-md flex flex-col items-center justify-center
                          transition-colors
                          ${
                            newTournament.id
                              ? "cursor-pointer hover:bg-muted/50 border-muted-foreground/30"
                              : "cursor-not-allowed opacity-50 border-muted-foreground/20"
                          }
                        `}
                      >
                        <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                        <span className="text-[10px] text-muted-foreground">Add Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={!newTournament.id}
                          onChange={handleTournamentPhotoUpload}
                          data-testid="tournament-photo-upload-input"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveTournament} data-testid="save-tournament-entry">
                  {editingTournament ? "Update Entry" : "Save Entry"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold flex items-center gap-2 text-primary">
            <Calendar className="w-5 h-5" /> Upcoming Tournaments
          </h4>
          <div className="grid grid-cols-1 gap-4">
            {upcoming.map((t) => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
          <Trophy className="w-5 h-5" /> Past Tournaments
        </h4>
        <div className="grid grid-cols-1 gap-4">
          {past.map((t) => (
            <TournamentCard key={t.id} t={t} />
          ))}
        </div>
        {past.length === 0 && upcoming.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed" data-testid="tournament-history-empty">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No tournament history added yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
