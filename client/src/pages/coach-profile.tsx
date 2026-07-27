import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { ProfileCover } from "@/components/profile/shared/ProfileCover";
import defaultCoachCover from "/assets/images/default_coach_cover.jpg";
import { CoachHero } from "@/components/profile/coach/CoachHero";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Camera, Edit2, Save, Plus, Trophy, Clock, DollarSign, X, ShoppingBag, Mail, Phone, MessageCircle, Send, Check, ChevronsUpDown, Calendar, ChevronRight, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import SEO from "@/components/seo";
import { BecomeOrganizerCard } from "@/components/profile/shared/BecomeOrganizerCard";
import { MySessionsSection } from "@/components/profile/shared/MySessionsSection";
import { MyOrganizedSessionsSection } from "@/components/profile/shared/MyOrganizedSessionsSection";
import { TournamentHistorySection } from "@/components/profile/shared/TournamentHistorySection";
import { useOrganizerStatus } from "@/hooks/use-organizer-status";

import { COACHES_DATA } from "@/lib/dummy-data";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import heroImage from "/assets/images/Coach_default.png";
import avatarImage from "/assets/images/female_tennis_coach_portrait.png";
import gallery1 from "/assets/images/kids_tennis_training_session.png";
import gallery2 from "/assets/images/tennis_match_action_shot_in_sydney.png";
import student1 from "/assets/images/portrait_of_a_young_male_tennis_student.png";
import student2 from "/assets/images/portrait_of_a_female_tennis_student.png";
import student3 from "/assets/images/portrait_of_an_older_male_tennis_student.png";

import bgImage from "/assets/images/subtle_abstract_tennis-themed_background_with_lime_green_accents.png";
import { resizeImage } from "@/lib/image";
import { uploadImage } from "@/lib/uploadImage";
import { deleteImage } from "@/lib/deleteImage";
import { useRoute } from "wouter";

import { Switch } from "@/components/ui/switch";
import racketImg from "/assets/images/professional_tennis_racket_on_a_court_bench.png";
import bagImg from "/assets/images/modern_tennis_gear_bag.png";
import ballsImg from "/assets/images/can_of_new_tennis_balls.png";

import { messageSchema } from "@/lib/validations/messages";

interface MarketplaceItemForm {
  id: string;
  name: string;
  price: string;
  description: string;
  condition: string;
  location: string;
  photos: string[];
  files: File[];
}

export type CoachScheduleDay = {
  active: boolean;
  start: string;
  end: string;
};

export type CoachSchedule = {
  monday: CoachScheduleDay;
  tuesday: CoachScheduleDay;
  wednesday: CoachScheduleDay;
  thursday: CoachScheduleDay;
  friday: CoachScheduleDay;
  saturday: CoachScheduleDay;
  sunday: CoachScheduleDay;
};

export type CoachProfile = {
  hourlyRate: number;
  gallery: any;
  name: string;
  title: string;
  location: string;
  bio: string;
  avatar?: string | null;
  cover?: string | null;
  createdAt?: string;
  rate: string;
  experience: string;
  locations: string[];
  tags: string[];
  photos?: string[]; 
  schedule: CoachSchedule;
  response_time: string;
  accepting_students: boolean;
  active_students: string;
  rating: number | null;
  hours_taught: string;
  attendance: number;
  phone: string;
  email: string;
  marketplace: any[];
};

export const DEFAULT_COACH_PROFILE: CoachProfile = {
  name: "Nataliia Petrychuk",
  title: "Tennis Coach | Beginner & Intermediate Specialist",
  location: "Manly, Sydney",
  bio: "Passionate tennis coach dedicated to helping beginners and intermediate players fall in love with the game.",

  avatar: null,
  cover: null,

  rate: "70",
  experience: "10",
  locations: ["Manly", "Mosman", "Freshwater", "Brookvale"],
  tags: ["High Performance", "Kids", "Technique"],
  photos: [],

  schedule: {
    monday: { active: true, start: "07:00", end: "19:00" },
    tuesday: { active: true, start: "07:00", end: "19:00" },
    wednesday: { active: true, start: "07:00", end: "19:00" },
    thursday: { active: true, start: "07:00", end: "19:00" },
    friday: { active: true, start: "07:00", end: "17:00" },
    saturday: { active: true, start: "08:00", end: "14:00" },
    sunday: { active: false, start: "09:00", end: "17:00" },
  },

  response_time: "Usually within 1 hr",
  accepting_students: true,
  active_students: "24",
  rating: 4.9,
  hours_taught: "150+",
  attendance: 100,

  phone: "",
  email: "",
  marketplace: [],
  gallery: undefined,
  hourlyRate: 0
};

// Top 10 Popular Locations
const POPULAR_LOCATIONS = [
  "Bondi Beach", "Manly", "Surry Hills", "Mosman", "Coogee", 
  "Parramatta", "Chatswood", "Newtown", "Freshwater", "Brookvale"
];

// Comprehensive list of Sydney Suburbs
const ALL_SYDNEY_SUBURBS = [
  // Eastern Suburbs
  "Bondi", "Bondi Beach", "Bondi Junction", "Bronte", "Coogee", "Clovelly", "Darling Point", "Double Bay", "Dover Heights", "Edgecliff", "Elizabeth Bay", "Maroubra", "Paddington", "Point Piper", "Potts Point", "Randwick", "Rose Bay", "Rushcutters Bay", "Surry Hills", "Vaucluse", "Watsons Bay", "Waverley", "Woollahra", "Woolloomooloo",
  // North Shore
  "Artarmon", "Cammeray", "Castle Cove", "Castlecrag", "Chatswood", "Chatswood West", "Cremorne", "Cremorne Point", "Crows Nest", "East Lindfield", "East Willoughby", "Gordon", "Greenwich", "Hornsby", "Hunters Hill", "Killara", "Kirribilli", "Lane Cove", "Lane Cove North", "Lane Cove West", "Lavender Bay", "Lindfield", "Linley Point", "Longueville", "McMahons Point", "Middle Cove", "Milsons Point", "Mosman", "Naremburn", "Neutral Bay", "North Sydney", "North Willoughby", "Northbridge", "Northwood", "Pymble", "Riverview", "Roseville", "Roseville Chase", "St Leonards", "Turramurra", "Wahroonga", "Waitara", "Warrawee", "Waverton", "Willoughby", "Wollstonecraft",
  // Northern Beaches
  "Allambie Heights", "Avalon Beach", "Balgowlah", "Balgowlah Heights", "Bayview", "Beacon Hill", "Belrose", "Bilgola Plateau", "Brookvale", "Church Point", "Clontarf", "Collaroy", "Collaroy Plateau", "Cromer", "Curl Curl", "Davidson", "Dee Why", "Duffys Forest", "Elanora Heights", "Fairlight", "Forestville", "Frenchs Forest", "Freshwater", "Ingleside", "Killarney Heights", "Manly", "Manly Vale", "Mona Vale", "Narrabeen", "Narraweena", "Newport", "North Balgowlah", "North Curl Curl", "North Manly", "North Narrabeen", "Oxford Falls", "Palm Beach", "Queenscliff", "Seaforth", "Terrey Hills", "Warriewood", "Whale Beach", "Wheeler Heights",
  // Inner West
  "Abbotsford", "Annandale", "Ashbury", "Ashfield", "Balmain", "Balmain East", "Birchgrove", "Breakfast Point", "Burwood", "Burwood Heights", "Cabarita", "Camperdown", "Canada Bay", "Chiswick", "Concord", "Concord West", "Croydon", "Croydon Park", "Drummoyne", "Dulwich Hill", "Enfield", "Enmore", "Erskineville", "Five Dock", "Forest Lodge", "Glebe", "Haberfield", "Homebush", "Leichhardt", "Lewisham", "Lilyfield", "Marrickville", "Newtown", "North Strathfield", "Petersham", "Rhodes", "Rodd Point", "Rozelle", "Russell Lea", "St Peters", "Stanmore", "Strathfield", "Summer Hill", "Sydenham", "Tempe", "Wareemba",
  // Western Suburbs
  "Auburn", "Bankstown", "Blacktown", "Cabramatta", "Canley Vale", "Fairfield", "Granville", "Guildford", "Harris Park", "Lidcombe", "Liverpool", "Merrylands", "Parramatta", "Penrith", "Rosehill", "Rydalmere", "Silverwater", "Westmead", "Wentworthville",
  // South Sydney & St George
  "Allawah", "Arncliffe", "Banksia", "Bardwell Park", "Bardwell Valley", "Bexley", "Bexley North", "Blakehurst", "Brighton-Le-Sands", "Carlton", "Carss Park", "Connells Point", "Cronulla", "Dolls Point", "Hurstville", "Kogarah", "Kogarah Bay", "Kyle Bay", "Lugarno", "Miranda", "Monterey", "Mortdale", "Oatley", "Peakhurst", "Penshurst", "Ramsgate", "Ramsgate Beach", "Rockdale", "Sandringham", "Sans Souci", "South Hurstville", "Sutherland", "Sylvania", "Turrella", "Wolli Creek",
  // Hills District
  "Baulkham Hills", "Beaumont Hills", "Bella Vista", "Castle Hill", "Cherrybrook", "Dural", "Glenhaven", "Kellyville", "Kenthurst", "North Rocks", "Pennant Hills", "Rouse Hill", "Seven Hills", "West Pennant Hills", "Winston Hills"
].sort();

export default function CoachProfile() {
  const [match, params] = useRoute("/coach/:slug");
  const profileSlug = params?.slug;
  const { user, isAuthenticated, updateUserLocal, fetchCurrentUser} = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [openCombobox, setOpenCombobox] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfile>(DEFAULT_COACH_PROFILE);
  const [originalProfile, setOriginalProfile] = useState<CoachProfile>(DEFAULT_COACH_PROFILE);
  const [profileData, setProfileData] = useState<any>(null);
  const [coachUserId, setCoachUserId] = useState<string>("");
  const [marketplaceItems, setMarketplaceItems] = useState<any[]>([]);
  const [profileIsOrganizer, setProfileIsOrganizer] = useState(false);
  const isOwnProfile =
    isAuthenticated &&
    user?.role === "coach" &&
    user?.slug === profileSlug;
  const organizerStatus = useOrganizerStatus(isOwnProfile);
  // Deliberately not the same as isOwnProfile - that also requires
  // user.role === "coach", so an organiser whose base account role is
  // something else would never see their own Organising tab here even
  // though it's genuinely their account and they do have organiser
  // access. This only needs to know "is this literally my account".
  const isMyAccount = isAuthenticated && user?.slug === profileSlug;
  const showOrganisingTab = isMyAccount
    ? !!user?.isOrganizer
    : profileIsOrganizer;
  
  /* =========================
     EDITING STATE
  ========================= */

  const [isEditing, setIsEditing] = useState(false);

  /* =========================
     BUY / CONTACT STATE
  ========================= */
  const [buyName, setBuyName] = useState("");
  const [buyEmail, setBuyEmail] = useState("");
  const [buyPhone, setBuyPhone] = useState("");
  const [buyMessage, setBuyMessage] = useState("");

  const [contactSubject, setContactSubject] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [showCoachEmail, setShowCoachEmail] = useState(false);
  const [showCoachPhone, setShowCoachPhone] = useState(false);

  const [activeTab, setActiveTab] = useState("about");

  /* =========================
     MODALS
  ========================= */
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [selectedBuyItem, setSelectedBuyItem] = useState<any>(null);

  /* =========================
     MARKETPLACE STATE
  ========================= */
  const [newItem, setNewItem] = useState<MarketplaceItemForm>({
    id: "",
    name: "",
    price: "",
    condition: "Used - Good",
    location: "",
    description: "",
    photos: [] as string[],
    files: [],
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  /* =========================
     HANDLERS — FILE UPLOAD
  ========================= */
  type UploadField = "avatar" | "cover" | "gallery";

    const handleFileChange = async (
      e: React.ChangeEvent<HTMLInputElement>,
      field: UploadField
    ) => {
      const file = e.target.files?.[0];
      if (!file || !user || !isOwnProfile) return;

      // 📸 ГАЛЕРЕЯ ТРЕНЕРА
      if (field === "gallery") {
        const formData = new FormData();
        formData.append("file", file);

        const resUpload = await fetch("/api/upload/coach-gallery", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!resUpload.ok) throw new Error("Upload failed");

        const { url } = await resUpload.json();

        const updatedPhotos = [...(profile.photos ?? []), url];

        setProfile(prev => ({ ...prev, photos: updatedPhotos }));

        await fetch("/api/me/coach-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ photos: updatedPhotos }),
        });

        return;
      }

      // 🧑‍🏫 AVATAR / COVER
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
        description: `${field === 'avatar' ? 'Avatar' : 'Cover'} updated successfully`,
      });
    };

  /* =========================
     MARKETPLACE HANDLERS
  ========================= */
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) {
      toast({ variant: "destructive", title: "Missing data" });
      return;
    }
  
    try {
      const res = await fetch("/api/profile/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newItem.name,
          price: newItem.price,
          condition: newItem.condition || "Used - Good",
          description: newItem.description || "",
          location: newItem.location || profile.location || "",
        }),
      });
  
      if (!res.ok) throw new Error("Save failed");
  
      const savedItem = await res.json();
  
      // Загрузка фото (если есть)
      if (newItem.files?.length) {
        for (const file of newItem.files.slice(0, 3)) {
          const formData = new FormData();
          formData.append("file", file);
          await fetch(`/api/profile/marketplace/${savedItem.id}/photos`, {
            method: "POST",
            body: formData,
            credentials: "include",
          });
        }
      }
  
      // Рефетч
      const refreshed = await fetch("/api/profile/marketplace", { credentials: "include" });
      setMarketplaceItems(await refreshed.json());
  
      setNewItem({ id: "", name: "", price: "", condition: "Used - Good", location: "", description: "", photos: [], files: [] });
      setIsItemModalOpen(false);
      toast({ title: "Item added" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to add item" });
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/profile/marketplace/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setMarketplaceItems(prev => prev.filter(i => i.id !== id));
      toast({ title: "Item deleted" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to delete item" });
    }
  };

  /* =========================
   CONTACT / SAVE
  ========================= */
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

    // Проверяем что получили ID коуча
    if (!coachUserId) {
      console.error("coachUserId is empty");

      toast({
        variant: "destructive",
        title: "Coach not found",
      });
      return;
    }

    try {
      console.log("Sending message to coach:", coachUserId);
      
      setIsSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId: coachUserId,
          recipientType: "coach",
          subject: contactSubject,
          phone: contactPhone,
          content: contactMessage,
        }),
      });

      const data = await res.json();

      console.log("Message API response:", data);

      if (!res.ok) {
        throw new Error(data?.message || "Failed to send");
      }

      toast({
        title: "Message sent",
        description: "The coach will receive your message shortly.",
      });

      setContactMessage("");

    } catch (error) {
      console.error("Message send error:", error);

      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: "Please try again later.",
      });
    }
    finally {
      setIsSending(false);
    }
  };

  const handleSave = async () => {
      try {
        const res = await fetch("/api/me/coach-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: profile.name,
          
            title: profile.title,
            location: profile.location,
            bio: profile.bio,
          
            tags: profile.tags,
            photos: profile.photos,
          
            rate: profile.rate,
            experience: profile.experience,
          
            phone: profile.phone,
            email: profile.email,
          
            locations: profile.locations,
            schedule: profile.schedule,
          
            response_time: profile.response_time,
            accepting_students: profile.accepting_students,
          
            active_students: profile.active_students,
            rating: profile.rating,
            hours_taught: profile.hours_taught,
            attendance: profile.attendance,
          }),
        });

        if (!res.ok) throw new Error();

        const updatedProfile = await res.json();

        setProfile(prev => ({
          ...prev,
          ...updatedProfile,
        }));

         await fetchCurrentUser();

        setIsEditing(false);

        setIsEditing(false);

        toast({
          title: "Profile updated",
          description: "Your changes were saved",
        });
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save profile",
        });
      }
    };

    const handleRemovePhoto = async (index: number) => {
      try {
        if (!profile.photos) return;

        const url = profile.photos[index];
        if (!url) return;

        // 1️⃣ удаляем файл из Storage
        await deleteImage(url);

        // 2️⃣ обновляем локально
        const updatedPhotos = profile.photos.filter((_, i) => i !== index);
        setProfile(prev => ({ ...prev, photos: updatedPhotos }));

        // 3️⃣ сохраняем в БД
        await fetch("/api/me/coach-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ photos: updatedPhotos }),
        });
      } catch (err) {
        console.error("Failed to remove photo", err);
      }
    };

    /* =========================
     LOAD PUBLIC PROFILE
     (guest / any user)
  ========================= */
  const loadPublicProfile = async () => {
    if (!profileSlug) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/coaches/${profileSlug}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(prev => ({
          ...prev,
          ...data,
        }));
        setIsDemo(false);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn("Public profile fetch failed");
    }

    // 🔁 DEMO FALLBACK (важно — НЕ УДАЛЯТЬ)
    const demoCoach = COACHES_DATA.find(c => c.slug === profileSlug);
    if (demoCoach) {
      setProfile(prev => ({
        ...prev,
        name: demoCoach.name,
        title: demoCoach.title,
        bio: demoCoach.bio,
        location: demoCoach.location,
        rate: String(demoCoach.rate),
        tags: demoCoach.tags,
        photos: demoCoach.photos,
        avatar: demoCoach.image,
        cover: demoCoach.cover,
      }));
      setIsDemo(true);
      setLoading(false);
      return;
    }

    setLocation("/coaches");
  };
 
  /* =========================
     LOAD PRIVATE PROFILE
     (ONLY OWNER)
  ========================= */
  const loadPrivateProfile = async () => {
    if (!isOwnProfile) return;

    try {
      
      const res = await fetch("/api/me/coach-profile", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();

        if (data) {
          setProfileData(data);

          setProfile(prev => ({
            ...prev,

            // user
            name: user?.name || prev.name,
            avatar: user?.avatar || prev.avatar,
            cover: user?.cover || prev.cover,
            email: user?.email || prev.email,

            // profile
            title: data.title ?? prev.title,
            bio: data.bio ?? prev.bio,
            location: data.location ?? prev.location,
            locations: data.locations ?? prev.locations,
            tags: data.tags ?? prev.tags,
            schedule: data.schedule ?? prev.schedule,
            phone: data.phone ?? prev.phone,
            rate: String(data.rate ?? prev.rate),
            experience: data.experience ?? prev.experience,
            photos: data.photos?.length ? data.photos : prev.photos,

            active_students: data.active_students ?? prev.active_students,
            rating: data.rating ?? prev.rating,
            attendance: data.attendance ?? prev.attendance,
          }));
        }
      }

      const marketplaceRes = await fetch("/api/profile/marketplace", {
        credentials: "include",
      });

      if (marketplaceRes.ok) {
        setMarketplaceItems(await marketplaceRes.json());
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load private profile",
      });
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     EFFECTS
  ========================= */
  useEffect(() => {
      if (!profileSlug) return;

      async function loadProfile() {
        try {
          setLoading(true);

          // 1️⃣ PUBLIC DATA
          const res = await fetch(`/api/coaches/${profileSlug}`, {
            credentials: "include",
          });

          if (!res.ok) throw new Error("Not found");

          const data = await res.json();
          setCoachUserId(data.user.id);
          setProfileIsOrganizer(!!data.user.isOrganizer);
          console.log("Coach ID:", data.user.id);

          setProfile(prev => ({
            ...DEFAULT_COACH_PROFILE,

            // user-level
            name: data.user.name,
            avatar: data.user.avatar ?? DEFAULT_COACH_PROFILE.avatar,
            cover: data.user.cover ?? DEFAULT_COACH_PROFILE.cover,
            createdAt: data.user.createdAt,

            // profile-level
            title: data.profile.title ?? DEFAULT_COACH_PROFILE.title,
            location: data.profile.location ?? DEFAULT_COACH_PROFILE.location,
            bio: data.profile.bio ?? DEFAULT_COACH_PROFILE.bio,

            rate: data.profile.rate ?? DEFAULT_COACH_PROFILE.rate,
            experience: data.profile.experience ?? DEFAULT_COACH_PROFILE.experience,
            locations: data.profile.locations ?? DEFAULT_COACH_PROFILE.locations,
            tags: data.profile.tags ?? DEFAULT_COACH_PROFILE.tags,
            photos: data.profile.photos ?? DEFAULT_COACH_PROFILE.photos,

            schedule: data.profile.schedule ?? DEFAULT_COACH_PROFILE.schedule,

            response_time: data.profile.response_time ?? DEFAULT_COACH_PROFILE.response_time,
            accepting_students: data.profile.accepting_students ?? DEFAULT_COACH_PROFILE.accepting_students,
            active_students: data.profile.active_students ?? DEFAULT_COACH_PROFILE.active_students,
            rating: data.profile.rating ?? DEFAULT_COACH_PROFILE.rating,
            hours_taught: data.profile.hours_taught ?? DEFAULT_COACH_PROFILE.hours_taught,
            attendance: data.profile.attendance ?? DEFAULT_COACH_PROFILE.attendance,

            phone: data.profile.phone ?? "",
            email: data.profile.email ?? ""

          }));

          const marketplaceRes = await fetch(
              `/api/profile/marketplace/public/${data.user.id}`,
              { credentials: "include" }
            );
            if (marketplaceRes.ok) {
              setMarketplaceItems(await marketplaceRes.json());
            }

        } catch (e) {
          // Try to find in demo data
          const demoCoach = COACHES_DATA.find(c => c.slug === profileSlug);
          if (demoCoach) {
            setProfile(prev => ({
              ...DEFAULT_COACH_PROFILE,
              name: demoCoach.name,
              avatar: demoCoach.image,
              cover: heroImage,
              title: demoCoach.title || DEFAULT_COACH_PROFILE.title,
              location: demoCoach.location,
              bio: demoCoach.bio || DEFAULT_COACH_PROFILE.bio,
              rate: String(demoCoach.rate),
              experience: demoCoach.experience,
              tags: demoCoach.tags || [],
              schedule: demoCoach.schedule || DEFAULT_COACH_PROFILE.schedule,
            }));
            setIsDemo(true);
          } else {
            setLocation("/coaches");
          }
        } finally {
          setLoading(false);
        }
      }

      loadProfile();
    }, [profileSlug]);

    const handleBuyRequest = async (itemId: string) => {
      console.log("Buy request for:", itemId);
    };  
   
    console.log({
      isAuthenticated,
      role: user?.role,
      userSlug: user?.slug,
      profileSlug,
      isOwnProfile,
    });

  return (
    <>
      <SEO
        title={
          profile.name
            ? `${profile.name} | Tennis Coach | TennisConnect`
            : "Tennis Coach Profile | TennisConnect"
        }
        description={
          profile.bio ||
          `Tennis coach in ${profile.location || "Australia"}`
        }
        canonical={`/coach/${profileSlug}`}
      />

      <div className="min-h-screen bg-background font-sans relative">
        {/* Background Image with Overlay */}
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
        
          <main className="pb-24">
          {/* Hidden File Inputs */}
          <input 
            type="file" 
            id="avatar-upload"
            data-testid="avatar-upload" 
            className="hidden" 
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'avatar')}
          />
          <input 
            type="file" 
            id="cover-upload" 
            className="hidden" 
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'cover')}
            data-testid="cover-upload"
          />
          <input 
            type="file" 
            id="photo-upload" 
            className="hidden" 
            accept="image/*,video/*"
            onChange={(e) => handleFileChange(e, 'gallery')}
          />
         
         {loading ? (
           <Skeleton
             className="w-full h-48 sm:h-56 md:h-64 lg:h-72 rounded-none"
             data-testid="coach-cover-skeleton"
           />
         ) : (
           <ProfileCover
              cover={profile.cover}
              defaultCover={defaultCoachCover}
              isOwner={isOwnProfile}
              onEdit={() =>
                document.getElementById("cover-upload")?.click()
              }
            />
         )}
          <div className="container mx-auto px-4 relative z-40 -mt-20">
            
          {loading ? (
            <div
              className="container mx-auto max-w-6xl px-4 relative -mt-2 sm:-mt-6 md:-mt-16 lg:-mt-20"
              data-testid="coach-hero-skeleton"
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
          <CoachHero
              profile={profile}
              isEditing={isEditing}
              isOwnProfile={isOwnProfile}
              isAuthenticated={!!user}
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
              onContact={() => {
                setActiveTab("contact");

                document
                  .querySelector('[data-state="active"]')
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
              }}
            />
          )}

            {/* Main Content Tabs */}
            {loading ? (
              <div className="mt-12 container mx-auto max-w-6xl px-4 space-y-4" data-testid="coach-tabs-skeleton">
                <div className="flex gap-4">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-9 w-24" />
                </div>
                <Skeleton className="h-40 w-full rounded-2xl" />
                <Skeleton className="h-40 w-full rounded-2xl" />
              </div>
            ) : (
            <div className="mt-12 pointer-events-auto">
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="w-full
                    overflow-x-auto
                    whitespace-nowrap
                    flex
                    justify-start
                    border-b
                    rounded-none
                    h-auto
                    p-0
                    bg-transparent
                    gap-2
                    md:pl-8
                    scrollbar-hide">
                  <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">About</TabsTrigger>
                  <TabsTrigger value="sessions" data-testid="my-sessions-tab" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">My Sessions</TabsTrigger>
                  {showOrganisingTab && (
                    <TabsTrigger value="organizing" data-testid="my-organized-sessions-tab" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">Organising</TabsTrigger>
                  )}
                  <TabsTrigger value="tournaments" data-testid="tournaments-tab" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">Tournaments</TabsTrigger>
                  <TabsTrigger value="photos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">Photos</TabsTrigger>
                  <TabsTrigger value="schedule" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">Schedule & Locations</TabsTrigger>
                  <TabsTrigger value="students" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">My Students</TabsTrigger>
                  <TabsTrigger value="marketplace" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">Selling ({marketplaceItems.length})</TabsTrigger>
                  {!isOwnProfile && (
                    <TabsTrigger value="contact" data-testid="contact-tab" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm md:text-base">Contact</TabsTrigger>
                  )}
                </TabsList>

                <div className="mt-8 space-y-8">
                    <TabsContent value="about" className="space-y-8 mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle>Biography</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {isEditing ? (
                            <Textarea 
                              value={profile.bio} 
                              onChange={(e) => setProfile({...profile, bio: e.target.value})} 
                              className="min-h-[150px]"
                            />
                          ) : (
                            <p className="text-muted-foreground leading-relaxed text-lg">
                              {profile.bio}
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      {isOwnProfile && organizerStatus.data && (
                        <BecomeOrganizerCard
                          status={organizerStatus.data}
                          onChange={() => organizerStatus.refresh()}
                        />
                      )}

                      {isEditing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card>
                            <CardContent className="p-6 flex items-center gap-4">
                              <div className="p-3 rounded-full bg-primary/10 text-primary">
                                <Trophy className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Experience</p>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    value={profile.experience} 
                                    onChange={(e) => setProfile({...profile, experience: e.target.value})} 
                                    className="w-20 h-8"
                                    data-testid="input-coach-experience"
                                  />
                                  <span>years</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-6 flex items-center gap-4">
                              <div className="p-3 rounded-full bg-green-500/10 text-green-600">
                                <DollarSign className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Hourly Rate</p>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    value={profile.rate} 
                                    onChange={(e) => setProfile({...profile, rate: e.target.value})} 
                                    className="w-20 h-8"
                                    data-testid="input-coach-rate"
                                  />
                                  <span>AUD</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Contact Info Editing */}
                          <Card>
                            <CardHeader>
                              <CardTitle>Contact Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Phone Number</Label>
                                  <Input 
                                    value={profile.phone} 
                                    onChange={(e) => setProfile({...profile, phone: e.target.value})} 
                                    placeholder="+61 4XX XXX XXX"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Email Address</Label>
                                  <Input 
                                    value={profile.email} 
                                    onChange={(e) => setProfile({...profile, email: e.target.value})} 
                                    placeholder="coach@example.com"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      <Card>
                        <CardHeader>
                          <CardTitle>Specialties (Tags)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {profile.tags?.map((tag) => (
                              <Badge key={tag} variant="secondary" className="px-3 py-1.5 text-sm flex gap-2">
                                {tag}
                                {isEditing && (
                                  <button 
                                    onClick={() => setProfile({...profile, tags: profile.tags.filter(t => t !== tag)})}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                )}
                              </Badge>
                            ))}
                            
                            {isEditing && (
                              <div className="flex items-center gap-2">
                                <Input 
                                  className="w-[150px] h-8" 
                                  placeholder="Add tag..." 
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = e.currentTarget.value.trim();
                                      if (val && !profile.tags?.includes(val)) {
                                        setProfile({...profile, tags: [...(profile.tags || []), val]});
                                        e.currentTarget.value = '';
                                      }
                                      e.preventDefault();
                                    }
                                  }}
                                />
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
                                  // Find the input and trigger logic (simplified for prototype)
                                  const input = document.querySelector('input[placeholder="Add tag..."]') as HTMLInputElement;
                                  if (input) {
                                    const val = input.value.trim();
                                    if (val && !profile.tags.includes(val)) {
                                      setProfile({...profile, tags: [...profile.tags, val]});
                                      input.value = '';
                                    }
                                  }
                                }}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="sessions" className="space-y-8 mt-0" data-testid="my-sessions-tab-content">
                      <MySessionsSection isOwnProfile={isMyAccount} isAuthenticated={isAuthenticated} />
                    </TabsContent>

                    {showOrganisingTab && (
                      <TabsContent value="organizing" className="space-y-8 mt-0" data-testid="my-organized-sessions-tab-content">
                        <MyOrganizedSessionsSection isOwnProfile={isMyAccount} profileSlug={profileSlug} />
                      </TabsContent>
                    )}

                    <TabsContent value="tournaments" className="mt-0" data-testid="tournaments-tab-content">
                      <TournamentHistorySection userId={coachUserId} isOwnProfile={isOwnProfile} />
                    </TabsContent>

                    <TabsContent value="photos" className="mt-0">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Upload Button */}
                        {isEditing && (
                          <div 
                            onClick={() => document.getElementById('photo-upload')?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center cursor-pointer group"
                          >
                            <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary mb-2" />
                            <span className="text-sm font-medium text-muted-foreground group-hover:text-primary">Add Photo/Video</span>
                          </div>
                        )}
                        
                        {/* Gallery Items */}
                        {/* {profile.gallery.map((item, index) => {
                          const isVideo = item.startsWith('data:video') || item.match(/\.(mp4|webm|ogg)$/i);
                          return (
                            <motion.div 
                              key={index} 
                              whileHover={{ scale: 1.02 }} 
                              className="aspect-square rounded-xl overflow-hidden relative group bg-black"
                            >
                              {isVideo ? (
                                <video 
                                  src={item} 
                                  className="w-full h-full object-cover" 
                                  controls={!isEditing}
                                  muted
                                  playsInline
                                />
                              ) : (
                                <img src={item} className="w-full h-full object-cover" alt={`Gallery ${index + 1}`} />
                              )}
                              
                              {isEditing && (
                                <button 
                                  onClick={() => handleRemovePhoto(index)}
                                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </motion.div>
                          );
                        })} */}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="schedule" className="mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            Weekly Schedule
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {profile.schedule && Object.entries(profile.schedule).map(([day, schedule]) => (
                              <div key={day} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                  <div className="w-24 capitalize font-medium">{day}</div>
                                  {isEditing ? (
                                    <Switch 
                                      checked={schedule.active}
                                      onCheckedChange={(checked) => {
                                        setProfile({
                                          ...profile,
                                          schedule: {
                                            ...profile.schedule,
                                            [day]: { ...schedule, active: checked }
                                          }
                                        });
                                      }}
                                    />
                                  ) : (
                                    <div className={cn("w-2 h-2 rounded-full", schedule.active ? "bg-green-500" : "bg-muted-foreground/30")} />
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {schedule.active ? (
                                    isEditing ? (
                                      <div className="flex items-center gap-2">
                                        <Input 
                                          type="time" 
                                          value={schedule.start}
                                          onChange={(e) => {
                                              setProfile({
                                                ...profile,
                                                schedule: {
                                                  ...profile.schedule,
                                                  [day]: { ...schedule, start: e.target.value }
                                                }
                                              });
                                          }}
                                          className="w-24 h-8"
                                        />
                                        <span className="text-muted-foreground">-</span>
                                        <Input 
                                          type="time" 
                                          value={schedule.end}
                                          onChange={(e) => {
                                              setProfile({
                                                ...profile,
                                                schedule: {
                                                  ...profile.schedule,
                                                  [day]: { ...schedule, end: e.target.value }
                                                }
                                              });
                                          }}
                                          className="w-24 h-8"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-sm font-medium">
                                        {new Date(`2000-01-01T${schedule.start}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(`2000-01-01T${schedule.end}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-sm text-muted-foreground italic">Unavailable</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-primary" />
                            Available Locations
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-6">
                            {/* Current Locations */}
                            <div>
                              <Label className="mb-2 block text-muted-foreground">Selected Locations</Label>
                              <div className="flex flex-wrap gap-2 min-h-10">
                                {profile.locations.length === 0 && (
                                  <span className="text-sm text-muted-foreground italic flex items-center h-8">No locations selected</span>
                                )}
                                {profile.locations.map((loc) => (
                                  <Badge key={loc} variant="secondary" className="px-3 py-1.5 text-sm flex gap-2 bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90">
                                    <MapPin className="w-3 h-3" />
                                    {loc}
                                    {isEditing && (
                                      <button 
                                        onClick={() => setProfile({...profile, locations: profile.locations.filter(l => l !== loc)})}
                                        className="ml-1 hover:text-white/80"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            {isEditing && (
                              <>
                                {/* Popular Locations */}
                                <div>
                                  <Label className="mb-2 block">Popular Locations</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {POPULAR_LOCATIONS.map(loc => {
                                        const isSelected = profile.locations.includes(loc);
                                        return (
                                        <Badge 
                                          key={loc} 
                                          variant={isSelected ? "default" : "outline"}
                                          className={cn(
                                            "cursor-pointer px-3 py-1.5 transition-all border-2", 
                                            isSelected 
                                              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90" 
                                              : "bg-muted/30 border-muted-foreground/10 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                                          )}
                                          onClick={() => {
                                            if (isSelected) {
                                              setProfile({...profile, locations: profile.locations.filter(l => l !== loc)});
                                            } else {
                                              setProfile({...profile, locations: [...profile.locations, loc]});
                                            }
                                          }}
                                        >
                                          {isSelected && <Check className="w-3 h-3 mr-1" />}
                                          {loc}
                                        </Badge>
                                        );
                                    })}
                                  </div>
                                </div>

                                {/* Search All Suburbs */}
                                <div className="flex flex-col gap-2">
                                  <Label>Search All Suburbs</Label>
                                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between"
                                      >
                                        Select suburb...
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                      <Command>
                                        <CommandInput placeholder="Search suburb..." />
                                        <CommandList>
                                          <CommandEmpty>No suburb found.</CommandEmpty>
                                          <CommandGroup className="max-h-[300px] overflow-auto">
                                            {ALL_SYDNEY_SUBURBS.map((suburb) => (
                                              <CommandItem
                                                key={suburb}
                                                value={suburb}
                                                onSelect={(currentValue) => {
                                                  // The value from CommandItem is lowercased by default in some versions, 
                                                  // so we use the original 'suburb' string to ensure correct casing
                                                  if (!profile.locations.includes(suburb)) {
                                                    setProfile({...profile, locations: [...profile.locations, suburb]});
                                                    toast({
                                                      description: `Added ${suburb} to locations`
                                                    });
                                                  }
                                                  setOpenCombobox(false);
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    profile.locations.includes(suburb) ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                {suburb}
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>


                    <TabsContent value="students" className="mt-0">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            My Students
                          </CardTitle>
                          {isEditing && (
                            <Button size="sm" variant="outline" className="gap-2">
                              <Plus className="w-4 h-4" /> Add Student
                            </Button>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Student 1 */}
                            <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                              <Avatar className="w-12 h-12 border-2 border-primary/20">
                                <AvatarImage src={student1} />
                                <AvatarFallback>JD</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <h4 className="font-bold">Jason Davis</h4>
                                <p className="text-sm text-muted-foreground">Intermediate • Training for 6 months</p>
                              </div>
                              <Badge variant="outline" className="ml-auto">Active</Badge>
                            </div>

                            {/* Student 2 */}
                            <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                              <Avatar className="w-12 h-12 border-2 border-primary/20">
                                <AvatarImage src={student2} />
                                <AvatarFallback>SM</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <h4 className="font-bold">Sarah Miller</h4>
                                <p className="text-sm text-muted-foreground">Beginner • Training for 2 months</p>
                              </div>
                              <Badge variant="outline" className="ml-auto">Active</Badge>
                            </div>

                            {/* Student 3 */}
                            <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                              <Avatar className="w-12 h-12 border-2 border-primary/20">
                                <AvatarImage src={student3} />
                                <AvatarFallback>RT</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <h4 className="font-bold">Robert Thompson</h4>
                                <p className="text-sm text-muted-foreground">Advanced • Training for 1.5 years</p>
                              </div>
                              <Badge variant="outline" className="ml-auto">Active</Badge>
                            </div>

                            {/* Add New Placeholder */}
                            {isEditing && (
                              <div className="flex items-center justify-center gap-2 p-4 rounded-lg border border-dashed hover:bg-muted/50 transition-colors cursor-pointer text-muted-foreground h-[88px]">
                                <Plus className="w-5 h-5" />
                                <span>Add another student</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="marketplace" className="mt-0">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-primary" />
                            My Items for Sale
                          </CardTitle>
                          {isEditing && marketplaceItems.length < 3 && (
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsItemModalOpen(true)}>
                              <Plus className="w-4 h-4" /> Add Item
                            </Button>
                          )}
                        </CardHeader>
                        <CardContent>
                          {marketplaceItems.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-xl bg-muted/20">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                  <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-bold mb-2">No items for sale yet</h3>
                                <p className="text-muted-foreground max-w-sm mb-6">
                                  {isEditing 
                                    ? "You haven't listed any items in your marketplace. Add rackets, gear, or training packages to sell." 
                                    : "This coach hasn't listed any items for sale yet. Check back later!"}
                                </p>
                                {isEditing && (
                                  <Button className="font-bold" onClick={() => setIsItemModalOpen(true)}>List Your First Item</Button>
                                )}
                              </div>
                          ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {marketplaceItems.map((item) => (
                                      <div key={item.id} className="group border rounded-xl overflow-hidden bg-card hover:shadow-lg transition-all duration-300 flex flex-col">
                                          <div className="aspect-4/3 bg-muted relative overflow-hidden">
                                              <img 
                                                src={item.image || racketImg} 
                                                alt={item.title} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                              />
                                              <div className="absolute top-2 right-2 flex gap-2">
                                                <Badge className="bg-black/70 backdrop-blur-sm text-white hover:bg-black/80">{item.condition}</Badge>
                                              </div>
                                              {isEditing && (
                                                  <Button 
                                                    variant="destructive" 
                                                    size="icon" 
                                                    className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleDeleteItem(item.id)}
                                                  >
                                                      <X className="w-4 h-4" />
                                                  </Button>
                                              )}
                                          </div>
                                          <div className="p-4 flex flex-col grow">
                                              <div className="flex justify-between items-start mb-2">
                                                  <h3 className="font-bold text-lg leading-tight line-clamp-2">{item.title}</h3>
                                                  <span className="font-bold text-lg text-primary whitespace-nowrap ml-2">${item.price}</span>
                                              </div>
                                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                                                  <MapPin className="w-3 h-3" /> {item.location || profile.location}
                                              </div>
                                              <p className="text-sm text-muted-foreground line-clamp-2 mb-4 grow">
                                                  {item.description}
                                              </p>
                                              <Button className="w-full font-bold mt-auto" onClick={() => {
                                                  setSelectedBuyItem(item);
                                                  setIsBuyModalOpen(true);
                                                  // Pre-fill user data if logged in
                                                  if (user) {
                                                      setBuyName(user.name || "");
                                                      setBuyEmail(user.email || "");
                                                  }
                                              }}>
                                                  Buy / Order
                                              </Button>
                                          </div>
                                      </div>
                                  ))}
                                  {isEditing && marketplaceItems.length < 3 && (
                                      <div 
                                        className="border-2 border-dashed border-muted rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-muted/10 hover:border-primary/50 transition-colors min-h-[300px]"
                                        onClick={() => setIsItemModalOpen(true)}
                                      >
                                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                                              <Plus className="w-6 h-6" />
                                          </div>
                                          <h3 className="font-bold">Add Another Item</h3>
                                          <p className="text-sm text-muted-foreground mt-1">You can list up to 3 items</p>
                                      </div>
                                  )}
                              </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Add Item Modal */}
                      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
                          <DialogContent className="max-w-lg">
                              <DialogHeader>
                                  <DialogTitle>List an Item for Sale</DialogTitle>
                                  <DialogDescription>Add gear, rackets, or accessories to your marketplace.</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-2">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <Label>Product Name</Label>
                                          <Input 
                                            placeholder="e.g. Wilson Pro Staff" 
                                            value={newItem.name}
                                            onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <Label>Price (AUD)</Label>
                                          <Input 
                                            placeholder="150" 
                                            type="number"
                                            value={newItem.price}
                                            onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                                          />
                                      </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
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
                                                  <SelectItem value="Used - Like New">Used - Like New</SelectItem>
                                                  <SelectItem value="Used - Good">Used - Good</SelectItem>
                                                  <SelectItem value="Used - Fair">Used - Fair</SelectItem>
                                              </SelectContent>
                                          </Select>
                                      </div>
                                      <div className="space-y-2">
                                          <Label>Location</Label>
                                          <Input 
                                            placeholder="Pickup location" 
                                            value={newItem.location}
                                            onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                                          />
                                      </div>
                                  </div>

                                  <div className="space-y-2">
                                      <Label>Description</Label>
                                      <Textarea 
                                        placeholder="Describe the item condition, specs, etc." 
                                        className="min-h-20"
                                        value={newItem.description}
                                        onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                                      />
                                  </div>

                                  <div className="space-y-2">
                                      <Label>Photos (Max 3)</Label>
                                      <div className="flex gap-2 flex-wrap">
                                      {newItem.photos.map((photo, i) => (
                                        <div key={i} className="w-20 h-20 relative">
                                          <img src={photo} className="w-full h-full object-cover rounded" alt="" />
                                        </div>
                                      ))}
                                      {newItem.files?.map((file: File, i: number) => (
                                        <div key={`f-${i}`} className="w-20 h-20 relative">
                                          <img
                                            src={URL.createObjectURL(file)}
                                            className="w-full h-full object-cover rounded"
                                            alt=""
                                          />
                                        </div>
                                      ))}
                                      {(newItem.photos?.length ?? 0) + (newItem.files?.length ?? 0) < 3 && (
                                        <label className="w-20 h-20 border-dashed border flex items-center justify-center cursor-pointer rounded">
                                          +
                                          <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
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
                              </div>
                              <DialogFooter>
                                  <Button variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
                                  <Button onClick={handleAddItem} className="font-bold">List Item</Button>
                              </DialogFooter>
                          </DialogContent>
                      </Dialog>

                      {/* Buy Item Modal */}
                      <Dialog open={isBuyModalOpen} onOpenChange={setIsBuyModalOpen}>
                          <DialogContent>
                              <DialogHeader>
                                  <DialogTitle>Order Request: {selectedBuyItem?.name}</DialogTitle>
                                  <DialogDescription>
                                      Send a request to {profile.name} to purchase this item.
                                  </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-2">
                                  <div className="p-3 bg-muted/30 rounded-lg flex gap-3 items-center border">
                                      <img src={selectedBuyItem?.photos?.[0] || racketImg} className="w-16 h-16 rounded object-cover bg-muted" />
                                      <div>
                                          <p className="font-bold">{selectedBuyItem?.name}</p>
                                          <p className="text-primary font-bold">${selectedBuyItem?.price}</p>
                                      </div>
                                  </div>

                                  <div className="space-y-2">
                                      <Label>Your Name</Label>
                                      <Input 
                                        value={buyName} 
                                        onChange={(e) => setBuyName(e.target.value)} 
                                        placeholder="John Doe"
                                      />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <Label>Email</Label>
                                          <Input 
                                            value={buyEmail} 
                                            onChange={(e) => setBuyEmail(e.target.value)} 
                                            placeholder="john@example.com"
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <Label>Phone</Label>
                                          <Input 
                                            value={buyPhone} 
                                            onChange={(e) => setBuyPhone(e.target.value)} 
                                            placeholder="04XX XXX XXX"
                                          />
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <Label>Message</Label>
                                      <Textarea 
                                        value={buyMessage} 
                                        onChange={(e) => setBuyMessage(e.target.value)} 
                                        placeholder="Hi, is this still available? When can I pick it up?" 
                                      />
                                  </div>
                              </div>
                              <DialogFooter>
                                  <Button variant="outline" onClick={() => setIsBuyModalOpen(false)}>Cancel</Button>
                                  <Button onClick={() =>
                                        selectedBuyItem && handleBuyRequest(selectedBuyItem.id)
                                      }
                                    className="font-bold bg-primary text-primary-foreground"
                                  >
                                    Send Request
                                  </Button>

                              </DialogFooter>
                          </DialogContent>
                      </Dialog>
                    </TabsContent>

                    <TabsContent value="contact" className="mt-0" data-testid="contact-tab-content">
                      {!isOwnProfile && (
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
                              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                                <Phone className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Phone Number</p>
                                {showCoachPhone ? (
                                  <p className="font-bold text-lg">{profile.phone || "No phone listed"}</p>
                                ) : (
                                  <Button 
                                    variant="link" 
                                    className="font-bold text-lg p-0 h-auto text-primary"
                                    onClick={() => setShowCoachPhone(true)}
                                    disabled={!profile.phone}
                                  >
                                    {profile.phone ? "Show Number" : "No Phone Listed"}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                                <Mail className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Email Address</p>
                                {showCoachEmail ? (
                                  <p className="font-bold text-lg">{profile.email || "No email listed"}</p>
                                ) : (
                                  <Button 
                                    variant="link" 
                                    className="font-bold text-lg p-0 h-auto text-primary"
                                    onClick={() => setShowCoachEmail(true)}
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
                                  placeholder="Lesson enquiry"
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
                                placeholder="Hi, I'm interested in booking a lesson..." 
                                className="min-h-[120px]"
                                value={contactMessage}
                                onChange={(e) => setContactMessage(e.target.value)}
                              />
                            </div>
                            <Button
                              onClick={handleContactSubmit}
                              disabled={
                                isSending ||
                                !contactSubject.trim() ||
                                !contactMessage.trim()
                              }
                            >
                              <Send className="w-4 h-4 mr-2" />

                              {isSending ? "Sending..." : "Send Message"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      )}
                    </TabsContent>
                </div>
              </Tabs>
            </div>
            )}
          </div>
        </main>

        <Footer />
        </div>
      </div>
    </>
  );
}
