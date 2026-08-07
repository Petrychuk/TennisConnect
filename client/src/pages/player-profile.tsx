import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileCover } from "@/components/profile/shared/ProfileCover";
import { Skeleton } from "@/components/ui/skeleton";
import defaultPlayerCover from "/assets/images/default_player_cover.jpg";
import { PlayerHero } from "@/components/profile/player/PlayerHero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLocation, useRoute, useSearch } from "wouter";
import { MapPin, Calendar, Trophy, Edit2, ShoppingBag, Plus, Trash2, Camera, Globe, Phone, Mail, MessageCircle, Send, LogIn, User, ClipboardList, Users2, Heart, Award } from "lucide-react";
import { PARTNERS_DATA } from "@/lib/dummy-data";
import bgImage from "/assets/images/subtle_abstract_tennis-themed_background_with_lime_green_accents.png";
import SEO from "@/components/seo";
import { Footer } from "@/components/footer";
import { BecomeOrganizerCard } from "@/components/profile/shared/BecomeOrganizerCard";
import { messageSchema } from "@/lib/validations/messages";
import { MySessionsSection } from "@/components/profile/shared/MySessionsSection";
import { MyClubsSection } from "@/components/profile/shared/MyClubsSection";
import { MyOrganizedSessionsSection } from "@/components/profile/shared/MyOrganizedSessionsSection";
import { useOrganizerStatus } from "@/hooks/use-organizer-status";
import { TennisLoader } from "@/components/ui/tennisLoader";

type MarketplaceDraft = {
  id: string;
  name: string;
  price: string;
  description: string;
  condition: string;
  location: string;
  photos: string[];
  files?: File[];
};

type TournamentDraft = {
  id: string;
  name: string;
  location: string;
  date: string;
  result: string;
  award: string;
  photos: string[];
};

export type PlayerProfile = {
  name: string;
  location: string;
  age: string;
  country: string;
  skillLevel: string;
  bio: string;
  avatar?: string | null;
  cover?: string | null;
  createdAt?: string;
  preferredCourts: string[];
  photos?: string[];
  coaches: number[];          
  marketplaceItems: any[];
  tournaments: any[];
  phone: string;
  email: string;
};

// Default Profile State
export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  name: "New Player",
  location: "Sydney, NSW",
  age: "25",
  country: "Australia",
  skillLevel: "Intermediate",
  bio: "Hi! I love tennis and I'm looking for partners to play with on weekends.",
  avatar: null,
  cover: null,
  preferredCourts: ["Bondi Beach", "Manly"],
  photos: [],
  coaches: [1], // IDs of connected coaches
  marketplaceItems: [] as any[],
  tournaments: [] as any[],
  phone: "",
  email: "",
};

// The "main" type split inside My Sessions - everything else (social,
// americano, round-robin, etc.) falls under "Sessions", these two
// under "Tournaments". Kept as an explicit list rather than deriving
// it, since it's a genuinely small, stable set.
const TOURNAMENT_TYPES = ["tournament", "club-championship"];

export default function PlayerProfile() {
  const [match, params] = useRoute("/player/:slug");
  const profileSlug = params?.slug; 
  const { user, isAuthenticated, updateUserProfile, updateUserLocal, fetchCurrentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const profileSearch = useSearch();
  const initialTabParams = new URLSearchParams(profileSearch);
  const initialTab = initialTabParams.has("joinSession")
    ? "organizing"
    : initialTabParams.get("tab") || "overview";

  const isOwnProfile = isAuthenticated && user?.slug === profileSlug; 
  const organizerStatus = useOrganizerStatus(isOwnProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [showPlayerPhone, setShowPlayerPhone] = useState(false);
  const [showPlayerEmail, setShowPlayerEmail] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [playerUserId, setPlayerUserId] = useState<string>("");
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PLAYER_PROFILE);
  const [originalProfile, setOriginalProfile] = useState<PlayerProfile>(DEFAULT_PLAYER_PROFILE);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileIsOrganizer, setProfileIsOrganizer] = useState(false);
  const showOrganisingTab = isOwnProfile
    ? !!user?.isOrganizer
    : profileIsOrganizer;
  
    // Tournament State
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [newTournament, setNewTournament] = useState<TournamentDraft>({
      id: "",
      name: "",
      location: "",
      date: "",
      result: "",
      award: "",
      photos: [],
    });
  const [tournaments, setTournaments] = useState<TournamentDraft[]>([]);
  const [editingTournament, setEditingTournament] = useState<TournamentDraft | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  
  // Marketplace State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState<MarketplaceDraft>({
      id: "",
      name: "",
      price: "",
      description: "",
      condition: "Used - Good",
      location: "",
      photos: [],
      files: [],
    });
  const [marketplaceItems, setMarketplaceItems] = useState<any[]>([]);

   useEffect(() => {
    if (!profileSlug) return;

      const loadPublicProfile = async () => {
        try {
          setLoading(true);

          /* ===== PROFILE ===== */
          const res = await fetch(`/api/players/${profileSlug}`, {
            credentials: "include",
          });

          if (!res.ok) throw new Error("Not found");

          const data = await res.json();

          const normalizedUser = {
            ...data.user,
            avatar: data.user.avatar
              ? `${data.user.avatar}?t=${Date.now()}`
              : null,
            cover: data.user.cover
              ? `${data.user.cover}?t=${Date.now()}`
              : null,
          };

          setProfile({
            ...DEFAULT_PLAYER_PROFILE,
            name: normalizedUser.name,
            avatar: normalizedUser.avatar || DEFAULT_PLAYER_PROFILE.avatar,
            cover: normalizedUser.cover || DEFAULT_PLAYER_PROFILE.cover,
            createdAt: data.user.createdAt,
            location: data.profile?.location || DEFAULT_PLAYER_PROFILE.location,
            age: data.profile?.age || DEFAULT_PLAYER_PROFILE.age,
            country: data.profile?.country || DEFAULT_PLAYER_PROFILE.country,
            skillLevel: data.profile?.skillLevel || DEFAULT_PLAYER_PROFILE.skillLevel,
            bio: data.profile?.bio || DEFAULT_PLAYER_PROFILE.bio,
            preferredCourts:
              data.profile?.preferredCourts ||
              DEFAULT_PLAYER_PROFILE.preferredCourts,
            phone: data.profile?.phone ?? "",
            email: data.profile?.email ?? "",
          });

          setProfileData(data.profile || null);
          setProfileIsOrganizer(!!data.user.isOrganizer);
          setPlayerUserId(data.user.id);

          /* ===== PUBLIC TOURNAMENTS ===== */
          const tournamentsRes = await fetch(
            `/api/profile/tournament-history?userId=${data.user.id}`
          );
          if (!tournamentsRes.ok) {
            console.error("❌ tournaments fetch failed", tournamentsRes.status);
          } else {
            const tournamentsData = await tournamentsRes.json();
            console.log("✅ PUBLIC TOURNAMENTS:", tournamentsData);
            setTournaments(tournamentsData);
          }

          /* ===== PUBLIC MARKETPLACE ===== */
          const marketplaceRes = await fetch(
            `/api/profile/marketplace/public/${data.user.id}`
          );
          if (marketplaceRes.ok) {
            setMarketplaceItems(await marketplaceRes.json());
          }

        } catch (err) {
          console.error("Public profile load failed", err);
          // Try to find in demo data
          const demoPlayer = PARTNERS_DATA.find(p => p.slug === profileSlug);
          if (demoPlayer) {
            setProfile({
              ...DEFAULT_PLAYER_PROFILE,
              name: demoPlayer.name,
              avatar: demoPlayer.avatar,
              location: demoPlayer.location,
              //age: demoPlayer.age,
              //country: demoPlayer.country,
              skillLevel: demoPlayer.skillLevel,
              bio: demoPlayer.bio,
              //preferredCourts: demoPlayer.courts || [],
            });
            setIsDemo(true);
          }
        } finally {
          setLoading(false);
        }
      };

      loadPublicProfile();
    }, [profileSlug]);
      
    useEffect(() => {
      if (!isOwnProfile) return;

      const loadPrivateData = async () => {
        try {
          const res = await fetch("/api/me/player-profile", {
            credentials: "include",
          });

          if (res.ok) {
            const data = await res.json();

            setProfileData(data);

            setProfile(prev => ({
              ...prev,
              location: data.location,
              age: data.age,
              country: data.country,
              skillLevel: data.skillLevel,
              bio: data.bio,
              preferredCourts: data.preferredCourts,
            }));
          }
        } catch (e) {
          console.error("Private data load failed", e);
        }
      };

      loadPrivateData();
    }, [isOwnProfile]);

  const handleContactSubmit = async () => {
    const validation = messageSchema.safeParse({
      subject: contactSubject,
      message: contactMessage,
      phone: contactPhone,
    });

    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    if (!playerUserId) {
      toast({
        variant: "destructive",
        title: "Player not found",
      });
      return;
    }

    try {
      setIsSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: playerUserId,
          recipientType: "player",
          subject: contactSubject,
          phone: contactPhone,
          content: contactMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to send");
      }

      toast({
        title: "Message sent",
        description: "The player will receive your message shortly.",
      });
      setContactSubject("");
      setContactMessage("");
      setContactPhone("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: error.message || "Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch("/api/me/player-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          location: profile.location,
          age: profile.age,
          country: profile.country,
          skillLevel: profile.skillLevel,
          bio: profile.bio,
          preferredCourts: profile.preferredCourts,
        }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update profile");

      const updatedProfile = await res.json();
      setProfile(prev => ({
        ...prev,
        ...updatedProfile,
      }));
      //await fetchCurrentUser();
      setIsEditing(false);

      toast({
        title: "Profile Updated",
        description: "Your changes have been saved.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save profile",
      });
    }
  };

  const handleSaveItem = async () => {
    const isEdit = Boolean(newItem.id);

    const url = isEdit
      ? `/api/profile/marketplace/${newItem.id}`
      : `/api/profile/marketplace`;

    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: newItem.name,
        price: newItem.price,
        condition: newItem.condition,
        description: newItem.description,
        location: newItem.location,
      }),
    });

    if (!res.ok) throw new Error("Save failed");

    const savedItem = await res.json();

    /* 🔥 ЗАГРУЖАЕМ ФОТО ДЛЯ НОВОГО ТОВАРА */
    if (!isEdit && newItem.files?.length) {
      for (const file of newItem.files.slice(0, 3)) {
        const formData = new FormData();
        formData.append("file", file);

        await fetch(
          `/api/profile/marketplace/${savedItem.id}/photos`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );
      }
    }

    /* 🔥 РЕФЕТЧ ПОСЛЕ ВСЕГО */
    const refreshed = await fetch(`/api/profile/marketplace`, {
      credentials: "include",
    });

    setMarketplaceItems(await refreshed.json());

    // очищаем форму
    setNewItem({
      id: "",
      name: "",
      price: "",
      description: "",
      condition: "Used - Good",
      location: "",
      photos: [],
      files: [],
    });

    setIsItemModalOpen(false);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/profile/marketplace/${id}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to delete item");
      
      setMarketplaceItems(prev => prev.filter(item => item.id !== id));
      toast({ title: "Item Deleted", description: "Your item has been removed." });
    } catch (error) {
      console.error("Failed to delete item", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete marketplace item"
      });
    }
  };

  /* ======================
   TOURNAMENTS (CRUD + PHOTOS)
   ====================== */  
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

  setTournaments(prev =>
    prev.some(t => t.id === saved.id)
      ? prev.map(t => (t.id === saved.id ? saved : t))
      : [...prev, saved]
  );

  if (isEdit) {
    setIsTournamentModalOpen(false);
    resetTournamentForm();
    toast({ title: "Tournament updated" });
  } else {
    setNewTournament(saved); // ⬅️ теперь есть id
    setEditingTournament(saved);
    toast({ title: "Tournament created. Upload photos." });
  }
  };

  const handleTournamentPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user || !newTournament.id) return;

    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 5 - (newTournament.photos?.length ?? 0);
    const filesToUpload = files.slice(0, remaining);

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `/api/profile/tournament-history/${newTournament.id}/photos`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );

        if (!res.ok) {
          throw new Error("Upload failed");
        }

        /**
         * ✅ backend возвращает ОБНОВЛЁННЫЙ турнир из БД
         * { id, name, ..., photos: string[] }
         */
        const updatedTournament = await res.json();

        // ✅ обновляем форму (модалка)
        setNewTournament(updatedTournament);

        // ✅ обновляем список турниров
        setTournaments(prev =>
          prev.map(t =>
            t.id === updatedTournament.id ? updatedTournament : t
          )
        );

      } catch (err) {
        console.error("Tournament image upload failed", err);
      }
    }

    // reset input (важно, чтобы можно было загрузить тот же файл снова)
    e.target.value = "";
  };
        
  const removeTournamentPhoto = async (index: number) => {
    if (!newTournament.id) return;

      const res = await fetch(
      `/api/profile/tournament-history/${newTournament.id}/photos/${index}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!res.ok) {
      toast({ variant: "destructive", title: "Failed to remove photo" });
      return;
    }

    const updatedTournament = await res.json();

    // обновляем форму
    setNewTournament(updatedTournament);

    // обновляем список
    setTournaments(prev =>
      prev.map(t =>
        t.id === updatedTournament.id ? updatedTournament : t
      )
    );
  };
 
  const resetTournamentForm = () => {
    setNewTournament({
      id: "",
      name: "",
      location: "",
      date: "",
      result: "",
      award: "",
      photos: [],
    });
    setEditingTournament(null);
  };

  const handledeleteTournamentHistory = async (id: string) => {
    const res = await fetch(
      `/api/profile/tournament-history/${id}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!res.ok) throw new Error("Delete failed");

    // ❗️после delete — сразу рефетч или обновление state
    setTournaments(prev => prev.filter(t => t.id !== id));
  };

 const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "avatar" | "cover"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 🧠 DEBUG
    console.log("UPLOAD:", {
      field,
      name: file.name,
      sizeKB: Math.round(file.size / 1024),
      type: file.type,
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const resUpload = await fetch(`/api/uploadMedia/${field}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const contentType = resUpload.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await resUpload.text();
        console.error("❌ NON-JSON RESPONSE:", text);
        throw new Error("Server returned non-JSON response");
      }

      const data = await resUpload.json();

      if (!resUpload.ok) {
        throw new Error(data?.message || `Upload failed (${resUpload.status})`);
      }

      const { url: imageUrl, user: updatedUserObject } = data;

      if (!imageUrl || !updatedUserObject) {
        throw new Error("Invalid server response");
      }

      setProfile(prev => ({
        ...prev,
        [field]: imageUrl,
      }));
      
      updateUserLocal(updatedUserObject);

      toast({
        title: "Photo updated",
        description: `${field} updated successfully`,
      });

    } catch (err) {
      
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      e.target.value = "";
    }
  };

  return (
    <>
      <SEO
        title={`${profile.name} | TennisConnect`}
        description={
          profile.bio ||
          `Tennis player from ${profile.location}`
        }
        canonical={`/player/${profileSlug}`}
      />
        <div className="min-h-screen bg-background font-sans relative pb-20">
          <div 
            className="fixed inset-0 z-0 pointer-events-none opacity-[0.15]" 
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
              mixBlendMode: 'multiply'
            }}
          />         
          <div className="relative z-10">
            <Navbar />
            
            <input
              type="file"
              id="avatar-upload"
              className="hidden"
              accept="image/*"
              data-testid="avatar-upload"
              onChange={(e) => handleFileChange(e, "avatar")}
            />

            <input
              type="file"
              id="cover-upload"
              className="hidden"
              accept="image/*"
              onChange={(e) => handleFileChange(e, "cover")}
              data-testid="cover-upload"
            />

            {loading ? (
              <Skeleton
                className="w-full h-[280px] sm:h-[300px] md:h-[380px] lg:h-[460px] rounded-t-3xl"
                data-testid="player-cover-skeleton"
              />
            ) : (
              <ProfileCover
                  cover={profile.cover}
                  defaultCover={defaultPlayerCover}
                  isOwner={isOwnProfile}
                  onEdit={() =>
                      document.getElementById("cover-upload")?.click()
                  }
              />
            )}
            <div className="container mx-auto px-4 -mt-20 relative z-30 max-w-6xl">
            
            {loading ? (
              <div
                className="relative"
                data-testid="player-hero-skeleton"
              >
                <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md shadow-lg pt-28 sm:pt-28 md:pt-8 pb-5 sm:pb-7 md:pb-8 px-4 sm:px-5 md:px-8 md:pl-56">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <Skeleton className="w-16 h-16 md:w-20 md:h-20 rounded-full shrink-0" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 md:h-8 w-48" />
                      <Skeleton className="h-4 w-64 max-w-full" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 md:gap-4 mt-8">
                    <Skeleton className="h-16 md:h-20 rounded-xl" />
                    <Skeleton className="h-16 md:h-20 rounded-xl" />
                    <Skeleton className="h-16 md:h-20 rounded-xl" />
                    <Skeleton className="h-16 md:h-20 rounded-xl" />
                  </div>
                </div>
              </div>
            ) : (
            <PlayerHero
                profile={profile}
                isEditing={isEditing}
                isOwnProfile={isOwnProfile}
                setProfile={setProfile}
                onAvatarEdit={() =>
                    document.getElementById("avatar-upload")?.click()
                }
                onEdit={() => {
                  setOriginalProfile(profile);
                  setIsEditing(true);
                }}
                onCancel={() => {
                  setProfile(originalProfile);
                  setIsEditing(false);
                }}
                onSave={handleSave}
             />
            )}
              {loading ? (
                <div className="mt-12 space-y-4" data-testid="player-tabs-skeleton">
                  <div className="flex gap-4">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                  <Skeleton className="h-40 w-full rounded-2xl" />
                  <Skeleton className="h-40 w-full rounded-2xl" />
                </div>
              ) : (
              <Tabs defaultValue={initialTab} className="mt-12 space-y-8">
                <TabsList className="w-full
                      flex
                      overflow-x-auto
                      whitespace-nowrap
                      justify-start
                      border-b
                      rounded-none
                      h-auto
                      p-0
                      bg-transparent
                      gap-2
                      scrollbar-hide">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><User className="w-4 h-4" />Overview</TabsTrigger>
                  <TabsTrigger value="communities" data-testid="my-communities-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><Users2 className="w-4 h-4" />Communities</TabsTrigger>
                  <TabsTrigger value="courts" data-testid="my-courts-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><Heart className="w-4 h-4" />My Courts</TabsTrigger>
                  <TabsTrigger value="sessions" data-testid="my-sessions-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><Trophy className="w-4 h-4" />My Sessions</TabsTrigger>
                  <TabsTrigger value="results" data-testid="my-results-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><Award className="w-4 h-4" />Results</TabsTrigger>
                  {showOrganisingTab && (
                    <TabsTrigger value="organizing" data-testid="my-organized-sessions-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><ClipboardList className="w-4 h-4" />Organising</TabsTrigger>
                  )}
                  {/* Selling tab hidden for now, per request - marketplace items still exist in marketplaceItems if this needs to come back */}
                  {/* <TabsTrigger value="marketplace" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><ShoppingBag className="w-4 h-4" />Selling ({marketplaceItems.length})</TabsTrigger> */}
                  {!isOwnProfile && (
                    <TabsTrigger value="contact" data-testid="contact-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><MessageCircle className="w-4 h-4" />Contact</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="overview" className="space-y-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Playing Preferences</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label className="text-muted-foreground mb-2 block">Skill Level</Label>
                          {isEditing ? (
                            <Select 
                              value={profile.skillLevel} 
                              onValueChange={(val) => setProfile({...profile, skillLevel: val})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Beginner">Beginner</SelectItem>
                                <SelectItem value="Intermediate">Intermediate</SelectItem>
                                <SelectItem value="Advanced">Advanced</SelectItem>
                                <SelectItem value="Pro">Pro</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-xl font-medium">{profile.skillLevel}</div>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground mb-2 block">Preferred Locations</Label>
                          {isEditing ? (
                            <Input 
                              value={profile.preferredCourts.join(", ")} 
                              onChange={(e) => setProfile({...profile, preferredCourts: e.target.value.split(", ")})}
                              placeholder="e.g. Bondi, Manly"
                            />
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {profile.preferredCourts.map((court, i) => (
                                <Badge key={i} variant="secondary" className="text-base py-1 px-3">
                                  <MapPin className="w-3 h-3 mr-1" /> {court}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {isOwnProfile && organizerStatus.data && (
                    <BecomeOrganizerCard
                      status={organizerStatus.data}
                      onChange={() => organizerStatus.refresh()}
                    />
                  )}
                </TabsContent>

                <TabsContent value="communities" className="space-y-6" data-testid="my-communities-tab-content">
                  <MyClubsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} mode="communities" />
                </TabsContent>

                <TabsContent value="courts" className="space-y-6" data-testid="my-courts-tab-content">
                  <MyClubsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} mode="courts" />
                </TabsContent>

                <TabsContent value="sessions" className="space-y-6" data-testid="my-sessions-tab-content">
                  <Tabs defaultValue="regular">
                    <TabsList>
                      <TabsTrigger value="regular" data-testid="my-sessions-type-regular">Sessions</TabsTrigger>
                      <TabsTrigger value="tournament" data-testid="my-sessions-type-tournament">
                        <Trophy className="w-4 h-4 mr-1.5" />
                        Tournaments
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="regular" className="mt-6">
                      <Tabs defaultValue="upcoming">
                        <TabsList>
                          <TabsTrigger value="upcoming" data-testid="my-sessions-regular-subtab-upcoming">Upcoming</TabsTrigger>
                          <TabsTrigger value="history" data-testid="my-sessions-regular-subtab-history">History</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upcoming" className="mt-6">
                          <MySessionsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} excludeTypes={TOURNAMENT_TYPES} timeframe="upcoming" />
                        </TabsContent>
                        <TabsContent value="history" className="mt-6">
                          <MySessionsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} excludeTypes={TOURNAMENT_TYPES} timeframe="past" />
                        </TabsContent>
                      </Tabs>
                    </TabsContent>

                    <TabsContent value="tournament" className="mt-6">
                      <MySessionsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} sessionTypes={TOURNAMENT_TYPES} timeframe="upcoming" />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                    <TabsContent value="results" className="space-y-8" data-testid="my-results-tab-content">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Results</h3>
                    {isOwnProfile && (
                      <Dialog
                        open={isTournamentModalOpen}
                        onOpenChange={(open) => {
                          setIsTournamentModalOpen(open);
                          if (!open) resetTournamentForm();
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button data-testid="add-result-button"><Plus className="w-4 h-4 mr-2" /> Add Result</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Add Result</DialogTitle>
                            <DialogDescription>
                              Record a result from a tournament, session, or match — including ones played
                              outside TennisConnect. Not every organiser runs their sessions through here yet.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input 
                                value={newTournament.name} 
                                onChange={(e) => setNewTournament({...newTournament, name: e.target.value})} 
                                placeholder="e.g. Sydney Open 2024, or Saturday Social Tennis" 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Date</Label>
                                <Input 
                                  type="date"
                                  value={newTournament.date} 
                                  onChange={(e) => setNewTournament({...newTournament, date: e.target.value})} 
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Location</Label>
                                <Input 
                                  value={newTournament.location} 
                                  onChange={(e) => setNewTournament({...newTournament, location: e.target.value})} 
                                  placeholder="e.g. Homebush" 
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Result</Label>
                                <Select
                                  value={
                                    ["Winner", "Runner Up", "Semi-Finalist", "Quarter-Finalist", "Round of 16", "Round of 32", "Participation"].includes(newTournament.result)
                                      ? newTournament.result
                                      : newTournament.result
                                      ? "Custom"
                                      : ""
                                  }
                                  onValueChange={(val) => setNewTournament({ ...newTournament, result: val === "Custom" ? "" : val })}
                                >
                                  <SelectTrigger data-testid="result-preset-select">
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
                                    <SelectItem value="Custom">Custom (e.g. a score)</SelectItem>
                                  </SelectContent>
                                </Select>
                                {!["Winner", "Runner Up", "Semi-Finalist", "Quarter-Finalist", "Round of 16", "Round of 32", "Participation"].includes(newTournament.result) && (
                                  <Input
                                    className="mt-2"
                                    value={newTournament.result}
                                    onChange={(e) => setNewTournament({ ...newTournament, result: e.target.value })}
                                    placeholder="e.g. Won 6-4, 6-3, or Won 3-1"
                                    data-testid="result-custom-input"
                                  />
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Award/Prize (Optional)</Label>
                                <Input 
                                  value={newTournament.award} 
                                  onChange={(e) => setNewTournament({...newTournament, award: e.target.value})} 
                                  placeholder="e.g. Gold Trophy" 
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>
                                Photos (Max 5)
                                {!newTournament.id && (
                                  <span className="text-xs text-muted-foreground block">
                                    Save first to upload photos
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
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSaveTournament}>{editingTournament ? "Update Entry" : "Save Entry"}</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  {/* Tournament Lists */}
                  {(() => {
                    const sortedTournaments = [...tournaments].sort((a, b) => {
                      // Sort descending by date
                      return new Date(b.date).getTime() - new Date(a.date).getTime();
                    });

                    const TournamentCard = ({ t }: { t: any }) => (
                      <Card key={t.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex flex-col md:flex-row">
                            {/* Image Gallery Column - Only if photos exist */}
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
                            
                            {/* Content Column */}
                            <div className="grow p-6 flex flex-col justify-between">
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-xl">{t.name}</h4>
                                      {(t.result === 'Winner' || t.result === 'Champion') && (
                                          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1 pl-1 pr-2">
                                            <Trophy className="w-3 h-3 fill-current" /> Winner
                                          </Badge>
                                      )}
                                      {(t.result === 'Finalist' || t.result === 'Runner-up') && (
                                          <Badge variant="secondary" className="bg-slate-300 text-slate-800 gap-1 pl-1 pr-2">
                                            <Trophy className="w-3 h-3" /> Finalist
                                          </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(t.date).toLocaleDateString()}</div>
                                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {t.location}</div>
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
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>

                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handledeleteTournamentHistory(t.id)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    )}
                                </div>
                              </div>
                              
                              {/* Photo Preview Strip (if more than 1 photo) */}
                              {t.photos && t.photos.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2 pt-2 border-t mt-2">
                                  {t.photos.map((photo: string, i: number) => (
                                    <div key={i} className="w-12 h-12 rounded-md overflow-hidden shrink-0 border bg-muted cursor-pointer hover:opacity-80 transition-opacity">
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
                      <div className="space-y-4">
                        {tournaments.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No results added yet.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4">
                            {sortedTournaments.map(t => <TournamentCard key={t.id} t={t} />)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                    </TabsContent>

                {showOrganisingTab && (
                  <TabsContent value="organizing" className="space-y-8" data-testid="my-organized-sessions-tab-content">
                    <MyOrganizedSessionsSection isOwnProfile={isOwnProfile} profileSlug={profileSlug} />
                  </TabsContent>
                )}

                {/* Selling tab content hidden for now, per request */}
                {false && (
                <TabsContent value="marketplace" className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">My Items for Sale</h3>
                    {isOwnProfile && (
                      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
                        <DialogTrigger asChild>
                          <Button><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Sell an Item</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Item Name</Label>
                              <Input 
                                value={newItem.name} 
                                onChange={(e) => setNewItem({...newItem, name: e.target.value})} 
                                placeholder="e.g. Wilson Racket" 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Price (AUD)</Label>
                              <Input 
                                value={newItem.price} 
                                onChange={(e) => setNewItem({...newItem, price: e.target.value})} 
                                placeholder="e.g. 150" 
                                type="number" 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Condition</Label>
                              <Select 
                                value={newItem.condition} 
                                onValueChange={(val) => setNewItem({...newItem, condition: val})}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="New">New</SelectItem>
                                  <SelectItem value="Like New">Like New</SelectItem>
                                  <SelectItem value="Used - Good">Used - Good</SelectItem>
                                  <SelectItem value="Used - Fair">Used - Fair</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea 
                                value={newItem.description} 
                                onChange={(e) => setNewItem({...newItem, description: e.target.value})} 
                                placeholder="Tell potential buyers about your item..." 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Location</Label>
                              <Input
                                value={newItem.location}
                                onChange={(e) =>
                                  setNewItem({ ...newItem, location: e.target.value })
                                }
                                placeholder="e.g. Sydney"
                              />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {newItem.photos.map((photo, i) => (
                                <div key={i} className="w-20 h-20 relative">
                                  <img
                                    src={photo}
                                    className="w-full h-full object-cover rounded"
                                  />
                                </div>
                              ))}

                              {newItem.photos.length < 3 && (
                                <label className="w-20 h-20 border-dashed border flex items-center justify-center cursor-pointer">
                                  +
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) =>
                                      setNewItem(prev => ({
                                        ...prev,
                                        files: Array.from(e.target.files || []),
                                      }))
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSaveItem}>
                            {newItem.id ? "Update Item" : "List Item"}
                          </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {marketplaceItems.map(item => (
                      <Card key={item.id}>
                        <div className="aspect-square bg-muted relative">
                          <img src={item.photos?.[0]} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                        <CardHeader>
                          <CardTitle className="flex justify-between items-start text-lg">
                            <span>{item.title}</span>
                            <span className="text-primary">${item.price}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{item.description}</p>
                          <div className="flex justify-between items-center">
                            <Badge variant="outline">{item.condition}</Badge>
                            {isOwnProfile && (
                              <><Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setNewItem({
                                    id: item.id,
                                    name: item.title,
                                    price: item.price,
                                    description: item.description,
                                    condition: item.condition,
                                    location: item.location,
                                    photos: item.photos || [],
                                  });
                                  setIsItemModalOpen(true);
                                } }
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button><Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-4 h-4" />
                                </Button></>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {marketplaceItems.length === 0 && (
                      <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>You haven't listed any items yet.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                )}

                {!isOwnProfile && (
                  <TabsContent value="contact" className="space-y-8" data-testid="contact-tab-content">
                    {!isAuthenticated ? (
                      <Card data-testid="player-contact-signed-out">
                        <CardContent className="py-10 text-center space-y-3">
                          <p className="text-muted-foreground">Sign in to see contact details and send a message.</p>
                          <Button asChild size="sm" data-testid="player-contact-sign-in">
                            <a href={`/auth?returnTo=${encodeURIComponent(`/player/${profileSlug}?tab=contact`)}`}>
                              <LogIn className="w-4 h-4 mr-2" />
                              Sign In
                            </a>
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-primary" />
                            Get in Touch
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                              <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-primary shadow-sm">
                                <Phone className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Phone Number</p>
                                {showPlayerPhone ? (
                                  <p className="font-bold text-lg">{profile.phone || "No phone listed"}</p>
                                ) : (
                                  <Button
                                    variant="link"
                                    className="font-bold text-lg p-0 h-auto text-primary"
                                    onClick={() => setShowPlayerPhone(true)}
                                    disabled={!profile.phone}
                                  >
                                    {profile.phone ? "Show Number" : "No Phone Listed"}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                              <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-primary shadow-sm">
                                <Mail className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Email Address</p>
                                {showPlayerEmail ? (
                                  <p className="font-bold text-lg">{profile.email || "No email listed"}</p>
                                ) : (
                                  <Button
                                    variant="link"
                                    className="font-bold text-lg p-0 h-auto text-primary"
                                    onClick={() => setShowPlayerEmail(true)}
                                    disabled={!profile.email}
                                  >
                                    {profile.email ? "Show Email" : "No Email Listed"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4 pt-4 border-t">
                            <h3 className="font-bold text-lg">Send a Message</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Subject *</Label>
                                <Input
                                  placeholder="Let's play tennis"
                                  value={contactSubject}
                                  onChange={(e) => setContactSubject(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Phone (optional)</Label>
                                <Input
                                  placeholder="+61 4XX XXX XXX"
                                  value={contactPhone}
                                  onChange={(e) => setContactPhone(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Message</Label>
                              <Textarea
                                placeholder="Hi, would you like to play a match sometime..."
                                className="min-h-[120px]"
                                value={contactMessage}
                                onChange={(e) => setContactMessage(e.target.value)}
                              />
                            </div>
                            <Button
                              onClick={handleContactSubmit}
                              disabled={isSending || !contactSubject.trim() || !contactMessage.trim()}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              {isSending ? "Sending..." : "Send Message"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                )}
              </Tabs>
              )}
            </div>
          </div>
        </div>
        <Footer />
    </>
  );
 }

