import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import heroImage from "@assets/generated_images/dynamic_tennis_ball_on_court_line_with_dramatic_lighting.png";
import avatarImage from "@assets/generated_images/female_tennis_coach_portrait.png";
import gallery1 from "@assets/generated_images/kids_tennis_training_session.png";
import gallery2 from "@assets/generated_images/tennis_match_action_shot_in_sydney.png";

import student1 from "@assets/generated_images/portrait_of_a_young_male_tennis_student.png";
import student2 from "@assets/generated_images/portrait_of_a_female_tennis_student.png";
import student3 from "@assets/generated_images/portrait_of_an_older_male_tennis_student.png";

// Default profile for initialization
const DEFAULT_PROFILE = {
  name: "Nataliia Petrychuk",
  title: "Tennis Coach | Beginner & Intermediate Specialist",
  location: "Manly, Sydney",
  bio: "Passionate tennis coach dedicated to helping beginners and intermediate players fall in love with the game. I actively compete in local amateur tournaments, so I understand the journey of improving your game firsthand. My sessions focus on building solid fundamentals, improving consistency, and most importantly - having fun on the court! Whether you're just starting out or looking to level up your rally game, I'd love to help you reach your goals.",
  rate: "70",
  experience: "10",
  locations: ["Manly", "Mosman", "Freshwater", "Brookvale"],
  tags: ["High Performance", "Kids", "Technique"],
  photos: [gallery1, gallery2],
  avatar: avatarImage,
  cover: heroImage,
  schedule: {
    monday: { active: true, start: "07:00", end: "19:00" },
    tuesday: { active: true, start: "07:00", end: "19:00" },
    wednesday: { active: true, start: "07:00", end: "19:00" },
    thursday: { active: true, start: "07:00", end: "19:00" },
    friday: { active: true, start: "07:00", end: "17:00" },
    saturday: { active: true, start: "08:00", end: "14:00" },
    sunday: { active: false, start: "09:00", end: "17:00" }
  }
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

import { COACHES_DATA } from "@/lib/dummy-data";
import { useRoute } from "wouter";

import { Switch } from "@/components/ui/switch";

export default function CoachProfile() {
  const [match, params] = useRoute("/coach/:id");
  const profileId = params?.id;
  
  const { user, isAuthenticated, updateUser } = useAuth();
  const [, setLocation] = useLocation();

  // Determine if this is the user's own profile (editable)
  // 1. /coach/profile (or empty id) is always the user's own profile (requires auth)
  // 2. /coach/1 is the user's profile IF they are logged in (assuming ID 1 is the user)
  const isGenericProfileRoute = !profileId || profileId === "profile";
  const isOwnProfile = isGenericProfileRoute || (isAuthenticated && profileId === "1");

  const [isEditing, setIsEditing] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const { toast } = useToast();
  
  // State for profile data
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  // Load profile logic
  useEffect(() => {
    // Redirect if trying to access generic profile route without auth
    if (isGenericProfileRoute && !isAuthenticated) {
      setLocation("/auth");
      return;
    }

    // Case 1: Viewing another profile (Read Only) or Guest viewing ID 1
    if (!isOwnProfile && profileId) {
      const coachData = COACHES_DATA.find(c => c.id === parseInt(profileId));
      if (coachData) {
        let displayData = { ...coachData };

        // SIMULATION: If viewing ID 1 (the default demo user), check if there is 
        // updated data in localStorage and show that instead of the static dummy data.
        // This makes the prototype feel "real" even when viewing as a guest.
        if (profileId === "1") {
           const savedProfile = localStorage.getItem("tennis_connect_coach_profile");
           if (savedProfile) {
             try {
               const parsed = JSON.parse(savedProfile);
               displayData = {
                 ...displayData,
                 name: parsed.name || displayData.name,
                 title: parsed.title || displayData.title,
                 bio: parsed.bio || displayData.bio,
                 // Handle rate as string or number
                 rate: parsed.rate ? parseInt(parsed.rate) : displayData.rate,
                 // Handle experience formatting
                 experience: parsed.experience ? (parsed.experience.includes('year') ? parsed.experience : `${parsed.experience} years`) : displayData.experience,
                 image: parsed.avatar || displayData.image,
                 cover: parsed.cover || displayData.cover,
                 tags: parsed.tags || displayData.tags || [],
                 locations: parsed.locations || displayData.locations,
                 schedule: parsed.schedule || displayData.schedule || DEFAULT_PROFILE.schedule
               };
             } catch (e) {
               console.error("Failed to sync guest view with local storage", e);
             }
           }
        }

        setProfile({
            name: displayData.name,
            title: displayData.title,
            location: displayData.location, // Main location
            bio: displayData.bio,
            rate: displayData.rate.toString(),
            experience: displayData.experience.replace(' years', ''),
            locations: displayData.locations || [displayData.location],
            tags: displayData.tags || [],
            photos: displayData.photos || [],
            avatar: displayData.image,
            cover: displayData.cover || heroImage,
            schedule: displayData.schedule || DEFAULT_PROFILE.schedule
        });
      }
      return;
    }

    // Case 2: Viewing own profile (Editable)
    // Only loads here if isOwnProfile is true (which means authenticated)
    const savedProfile = localStorage.getItem("tennis_connect_coach_profile");
    if (savedProfile) {
        // ... existing loading logic ...
      try {
        const parsedProfile = JSON.parse(savedProfile);
        // Merge with DEFAULT_PROFILE to ensure all fields exist (like tags)
        // This fixes the crash if localStorage has an old version of the profile
        const mergedProfile = { ...DEFAULT_PROFILE, ...parsedProfile };
        
        // Ensure tags is at least an empty array if somehow missing from both
        if (!mergedProfile.tags) mergedProfile.tags = [];
        
        setProfile(mergedProfile);
        
        // Sync auth user if needed
        if (user && (user.name !== mergedProfile.name || user.avatar !== mergedProfile.avatar)) {
           updateUser({ 
               name: mergedProfile.name,
               avatar: mergedProfile.avatar
           });
        }
      } catch (e) {
        console.error("Failed to parse profile", e);
      }
    } else if (user) {
      // Initialize with user data if available
      setProfile(prev => ({
        ...prev,
        name: user.name || prev.name,
        avatar: user.avatar || prev.avatar
      }));
    }
  }, [isAuthenticated, user, setLocation, isOwnProfile, profileId]);


  const availableLocations = [
    "Bondi Beach", "Manly", "Surry Hills", "Mosman", "Coogee", "Parramatta", "Chatswood", "Newtown", "Freshwater", "Brookvale"
  ];

  const handleSave = () => {
    setIsEditing(false);
    
    try {
      // Save to localStorage
      localStorage.setItem("tennis_connect_coach_profile", JSON.stringify(profile));
      
      // Update global auth state (so navbar updates immediately)
      updateUser({ name: profile.name, avatar: profile.avatar });
      
      // Dispatch custom event to notify other components (like Coaches list)
      window.dispatchEvent(new Event('profile-updated'));
  
      toast({
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      console.error("Storage quota exceeded", error);
      toast({
        variant: "destructive",
        title: "Storage Limit Reached",
        description: "Your media files are too large to save permanently in this browser prototype. Changes are saved for this session only.",
      });
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...profile.photos];
    newPhotos.splice(index, 1);
    setProfile({
      ...profile,
      photos: newPhotos
    });
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimensions
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'avatar' | 'cover' | 'photo') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        let result: string;

        // If it's an image, resize it
        if (file.type.startsWith('image/')) {
          result = await resizeImage(file);
        } else {
          // For videos, still check size limit strictly
          if (file.size > 5 * 1024 * 1024) {
             toast({
              variant: "destructive",
              title: "Video too large",
              description: "Please select a video under 5MB for this prototype.",
            });
            return;
          }
          
          // Read video as base64
          result = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        }

        if (field === 'avatar') {
          setProfile({ ...profile, avatar: result });
          updateUser({ avatar: result });
          toast({ title: "Avatar Updated", description: "Don't forget to save changes." });
        } else if (field === 'cover') {
          setProfile({ ...profile, cover: result });
          toast({ title: "Cover Updated", description: "Don't forget to save changes." });
        } else if (field === 'photo') {
          setProfile({ ...profile, photos: [...profile.photos, result] });
          toast({ title: "Media Added", description: "New item added to gallery." });
        }
      } catch (error) {
        console.error("Error processing file", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to process file.",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <main className="pb-24">
        {/* Hidden File Inputs */}
        <input 
          type="file" 
          id="avatar-upload" 
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
        />
        <input 
          type="file" 
          id="photo-upload" 
          className="hidden" 
          accept="image/*,video/*"
          onChange={(e) => handleFileChange(e, 'photo')}
        />

        {/* Profile Header / Hero */}
        <div className="relative h-[300px] md:h-[400px] w-full overflow-hidden group">
          <div className="absolute inset-0 bg-black/40 z-10" />
          <img 
            src={profile.cover} 
            alt="Cover" 
            className="w-full h-full object-cover transition-transform duration-700"
          />
          {isEditing && (
             <div 
               onClick={() => document.getElementById('cover-upload')?.click()}
               className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
             >
               <Button variant="secondary" className="gap-2 pointer-events-none">
                 <Camera className="w-5 h-5" /> Change Cover Photo
               </Button>
             </div>
          )}
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent z-20" />
        </div>

        <div className="container mx-auto px-4 relative z-40 -mt-20 pointer-events-none">
          <div className="flex flex-col md:flex-row gap-8 items-start pointer-events-auto">
            {/* Avatar Column */}
            <div className="flex-shrink-0 relative">
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-background shadow-2xl overflow-hidden bg-muted relative group">
                <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                {isEditing && (
                  <div 
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>
              <div className="mt-4 text-center md:text-left">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
                    Verified Coach
                  </Badge>
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground px-3 py-1">
                    Sydney, AU
                  </Badge>
                </div>
              </div>
            </div>

            {/* Info Column */}
            <div className="flex-grow pt-4 md:pt-12 w-full">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="text-center md:text-left space-y-4 w-full max-w-2xl">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input 
                          value={profile.name} 
                          onChange={(e) => setProfile({...profile, name: e.target.value})} 
                          className="text-2xl font-bold font-display"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Professional Title</Label>
                        <Input 
                          value={profile.title} 
                          onChange={(e) => setProfile({...profile, title: e.target.value})} 
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-3xl md:text-5xl font-display font-bold">{profile.name}</h1>
                      <p className="text-xl text-muted-foreground">{profile.title}</p>
                    </>
                  )}
                </div>

                {/* Edit Action Button - Placed here for better UX */}
                <div className="flex-shrink-0 w-full md:w-auto mt-4 md:mt-0 flex justify-center md:justify-end">
                  {isOwnProfile && (
                    isEditing ? (
                      <Button onClick={handleSave} size="lg" className="w-full md:w-auto bg-primary text-primary-foreground font-bold shadow-md gap-2 animate-in fade-in zoom-in duration-300">
                        <Save className="w-5 h-5" /> Save Changes
                      </Button>
                    ) : (
                      <Button onClick={() => setIsEditing(true)} size="lg" variant="outline" className="w-full md:w-auto border-primary/20 hover:bg-primary/5 hover:border-primary/50 font-bold shadow-sm gap-2">
                        <Edit2 className="w-5 h-5" /> Edit Profile
                      </Button>
                    )
                  )}
                  {!isOwnProfile && (
                      <Button size="lg" className="w-full md:w-auto bg-primary text-primary-foreground font-bold shadow-md gap-2">
                        <MessageCircle className="w-5 h-5" /> Contact Coach
                      </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Tabs */}
          <div className="mt-12 pointer-events-auto">
            <Tabs defaultValue="about" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">About</TabsTrigger>
                <TabsTrigger value="photos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">Photos</TabsTrigger>
                <TabsTrigger value="schedule" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">Schedule & Locations</TabsTrigger>
                <TabsTrigger value="practice" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">Hitting Partner</TabsTrigger>
                <TabsTrigger value="students" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">My Students</TabsTrigger>
                <TabsTrigger value="marketplace" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">Marketplace</TabsTrigger>
                <TabsTrigger value="contact" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">Contact</TabsTrigger>
              </TabsList>

              <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Content (2 cols) */}
                <div className="lg:col-span-2 space-y-8">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <Card>
                         <CardContent className="p-6 flex items-center gap-4">
                           <div className="p-3 rounded-full bg-primary/10 text-primary">
                             <Trophy className="w-6 h-6" />
                           </div>
                           <div>
                             <p className="text-sm text-muted-foreground">Experience</p>
                             {isEditing ? (
                               <div className="flex items-center gap-2">
                                 <Input 
                                   value={profile.experience} 
                                   onChange={(e) => setProfile({...profile, experience: e.target.value})} 
                                   className="w-20 h-8"
                                 />
                                 <span>years</span>
                               </div>
                             ) : (
                               <p className="text-xl font-bold">{profile.experience} Years</p>
                             )}
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
                             {isEditing ? (
                               <div className="flex items-center gap-2">
                                 <Input 
                                   value={profile.rate} 
                                   onChange={(e) => setProfile({...profile, rate: e.target.value})} 
                                   className="w-20 h-8"
                                 />
                                 <span>AUD</span>
                               </div>
                             ) : (
                               <p className="text-xl font-bold">${profile.rate} AUD</p>
                             )}
                           </div>
                         </CardContent>
                       </Card>
                    </div>

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
                      {profile.photos.map((item, index) => {
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
                      })}
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
                           {Object.entries(profile.schedule).map(([day, schedule]) => (
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
                             <div className="flex flex-wrap gap-2 min-h-[40px]">
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

                  <TabsContent value="practice" className="mt-0">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-primary" />
                          Hitting Partner / Practice Sessions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="bg-muted/30 p-6 rounded-lg border border-border/50">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary/10 rounded-full text-primary">
                              <Trophy className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold mb-2">Need a Hitting Partner?</h3>
                              <p className="text-muted-foreground mb-4">
                                Apart from coaching, I also offer hitting sessions for players who want to practice match play, improve consistency, or just get a good workout without technical instruction.
                              </p>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="w-4 h-4 text-primary" />
                                  <span>Match Play Simulation</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="w-4 h-4 text-primary" />
                                  <span>Drill Repetition</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="w-4 h-4 text-primary" />
                                  <span>Tie-break Practice</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="w-4 h-4 text-primary" />
                                  <span>High Intensity Rallying</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between bg-background p-4 rounded-md border">
                                <div>
                                  <span className="text-sm text-muted-foreground block">Session Rate</span>
                                  <span className="text-xl font-bold">$50 <span className="text-sm font-normal text-muted-foreground">/ hour</span></span>
                                </div>
                                <Button>Book Practice</Button>
                              </div>
                            </div>
                          </div>
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
                          Coach's Marketplace
                        </CardTitle>
                        {isEditing && (
                          <Button size="sm" variant="outline" className="gap-2">
                            <Plus className="w-4 h-4" /> Add Item
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent>
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
                            <Button className="font-bold">List Your First Item</Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="contact" className="mt-0">
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
                              <p className="font-bold text-lg">+61 4XX XXX XXX</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                              <Mail className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Email Address</p>
                              <p className="font-bold text-lg">Show Email</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                          <h3 className="font-bold text-lg">Send a Message</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Your Name</Label>
                              <Input placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                              <Label>Your Email</Label>
                              <Input placeholder="john@example.com" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Message</Label>
                            <Textarea placeholder="Hi, I'm interested in booking a lesson..." className="min-h-[120px]" />
                          </div>
                          <Button className="w-full font-bold gap-2">
                            <Send className="w-4 h-4" /> Send Message
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-6">
                  <Card className="bg-primary/5 border-primary/20 sticky top-24">
                    <CardHeader>
                      <CardTitle className="text-xl">Coach Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-primary/10">
                        <span className="text-muted-foreground">Profile Visibility</span>
                        <Badge className="bg-green-500 hover:bg-green-600">Public</Badge>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-primary/10">
                        <span className="text-muted-foreground">Verification</span>
                        <Badge variant="outline" className="text-primary border-primary">Verified</Badge>
                      </div>
                      <div className="space-y-2">
                         <span className="text-sm font-bold block">Quick Stats</span>
                         <div className="grid grid-cols-2 gap-2">
                           <div className="bg-background p-3 rounded-lg text-center">
                             <div className="text-xl font-bold text-primary">24</div>
                             <div className="text-xs text-muted-foreground">Students</div>
                           </div>
                           <div className="bg-background p-3 rounded-lg text-center">
                             <div className="text-xl font-bold text-primary">4.9</div>
                             <div className="text-xs text-muted-foreground">Rating</div>
                           </div>
                         </div>
                      </div>
                      
                      {!isEditing && (
                         <Button className="w-full font-bold" variant="outline">
                           View Public Profile
                         </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </Tabs>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
