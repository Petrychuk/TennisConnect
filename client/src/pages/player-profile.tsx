import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLocation, useRoute } from "wouter";
import { MapPin, Calendar, Trophy, Edit2, Save, ShoppingBag, Plus, Trash2, Camera, Globe } from "lucide-react";
import { COACHES_DATA, MARKETPLACE_DATA } from "@/lib/dummy-data";
import bgImage from "/assets/images/subtle_abstract_tennis-themed_background_with_lime_green_accents.png";
import { uploadImage } from "@/lib/uploadImage";
import { deleteImage } from "@/lib/deleteImage";

export type PlayerProfile = {
  name: string;
  location: string;
  age: string;
  country: string;
  skillLevel: string;
  bio: string;

  avatar?: string | null;
  cover?: string | null;

  preferredCourts: string[];
  photos: string[];

  coaches: number[];          // связи
  marketplaceItems: any[];
  tournaments: any[];
};

// Default Profile State
export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  name: "New Player",
  location: "Sydney, NSW",
  age: "25",
  country: "Australia",
  skillLevel: "Intermediate",
  bio: "Hi! I love tennis and I'm looking for partners to play with on weekends.",

  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop",
  cover: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=2000&auto=format&fit=crop",
  
  preferredCourts: ["Bondi Beach", "Manly"],
  photos: [],
  coaches: [1], // IDs of connected coaches
  marketplaceItems: [] as any[],
  tournaments: [] as any[]
};

export default function PlayerProfile() {
  const [match, params] = useRoute("/player/:slug");
  const profileSlug = params?.slug; 
  const { user, isAuthenticated, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isOwnProfile = isAuthenticated && user?.slug === profileSlug; 

  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PLAYER_PROFILE);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  
  // Marketplace State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    id: "",
    name: "",
    price: "",
    description: "",
    condition: "Used - Good"
  });
  const [marketplaceItems, setMarketplaceItems] = useState<any[]>([]);

  // Tournament State
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: "",
    location: "",
    date: "",
    result: "",
    award: "",
    photos: [] as string[]
  });
  const [tournaments, setTournaments] = useState<any[]>([]);
  
   useEffect(() => {
      if (!profileSlug) return;

      const loadPublicProfile = async () => {
        try {
          setLoading(true);

          const res = await fetch(`/api/players/${profileSlug}`, {
            credentials: "include",
          });

          if (!res.ok) throw new Error("Not found");

          const data = await res.json();

          setProfile({
            ...DEFAULT_PLAYER_PROFILE,
            name: data.user.name,
            avatar: data.user.avatar || DEFAULT_PLAYER_PROFILE.avatar,
            cover: data.user.cover || DEFAULT_PLAYER_PROFILE.cover,
            location: data.profile?.location || DEFAULT_PLAYER_PROFILE.location,
            age: data.profile?.age || DEFAULT_PLAYER_PROFILE.age,
            country: data.profile?.country || DEFAULT_PLAYER_PROFILE.country,
            skillLevel: data.profile?.skillLevel || DEFAULT_PLAYER_PROFILE.skillLevel,
            bio: data.profile?.bio || DEFAULT_PLAYER_PROFILE.bio,
            preferredCourts: data.profile?.preferredCourts || DEFAULT_PLAYER_PROFILE.preferredCourts,
          });

          setProfileData(data.profile || null);
        } catch {
          setLocation("/");
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
            
            const tournamentsRes = await fetch("/api/tournaments", {
              credentials: "include",
            });
            if (tournamentsRes.ok) {
              setTournaments(await tournamentsRes.json());
            }

            const marketplaceRes = await fetch("/api/marketplace/user", {
              credentials: "include",
            });
            if (marketplaceRes.ok) {
              setMarketplaceItems(await marketplaceRes.json());
            }
          } catch (e) {
            console.error("Private data load failed", e);
          }
        };

        loadPrivateData();
      }, [isOwnProfile]);

  const handleSave = async () => {
    try {
      const res = await fetch("/api/me/player-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

      const updated = await res.json();
      setProfileData(updated);
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

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) return;
    
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newItem.name,
          price: newItem.price,
          condition: newItem.condition,
          description: newItem.description,
          location: profile.location,
          image: "https://images.unsplash.com/photo-1617083934555-5634045431b0?w=800&q=80"
        }),
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to add item");
      
      const item = await res.json();
      setMarketplaceItems(prev => [...prev, item]);
      
      setNewItem({id: "", name: "", price: "", description: "", condition: "Used - Good" });
      setIsItemModalOpen(false);
      toast({ title: "Item Added", description: "Your item is now listed." });
    } catch (error) {
      console.error("Failed to add item", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add marketplace item"
      });
    }
  };

const handleItemPhotoUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];
  if (!file || !user || !newItem.id) return;

  try {
    const imageUrl = await uploadImage(file, {
      folder: `marketplace/${user.id}/${newItem.id}`,
    });

    setNewItem(prev => ({
      ...prev,
      photos: [...prev.photos, imageUrl],
    }));
  } catch (error) {
    console.error("Marketplace image upload failed", error);
  }
};

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/marketplace/${id}`, {
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

  const handleAddTournament = async () => {
    if (!newTournament.name || !newTournament.date) return;
    
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTournament),
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to add tournament");
      
      const tournament = await res.json();
      setTournaments(prev => [...prev, tournament]);
      
      setNewTournament({ name: "", location: "", date: "", result: "", award: "", photos: [] });
      setIsTournamentModalOpen(false);
      toast({ title: "Tournament Added", description: "Your tournament history has been updated." });
    } catch (error) {
      console.error("Failed to add tournament", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add tournament"
      });
    }
  };

  const handleDeleteTournament = async (id: string) => {
    try {
      const res = await fetch(`/api/tournaments/${id}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to delete tournament");
      
      setTournaments(prev => prev.filter(t => t.id !== id));
      toast({ title: "Tournament Deleted", description: "Tournament has been removed." });
    } catch (error) {
      console.error("Failed to delete tournament", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete tournament"
      });
    }
  };

  const handleTournamentPhotoUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  if (!user) return;

  const files = Array.from(e.target.files || []);
  const remaining = 5 - newTournament.photos.length;
  const filesToUpload = files.slice(0, remaining);

  for (const file of filesToUpload) {

    const url = await uploadImage(file, {
      folder: `players/${user.id}/tournaments`,
    });

    setNewTournament(prev => ({
      ...prev,
      photos: [...prev.photos, url],
    }));
  }
};
     
  const removeTournamentPhoto = (index: number) => {
    setNewTournament(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleFileChange = async (
      e: React.ChangeEvent<HTMLInputElement>,
      field: "avatar" | "cover"
    ) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      try {
        // 1️⃣ upload to Supabase (replace!)
        const imageUrl = await uploadImage(file, {
          folder: `players/${user.id}/${field}`,
          replace: true,
        });

        // 2️⃣ save URL to PLAYER PROFILE
        const res = await fetch("/api/me/player-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ [field]: imageUrl }),
        });

        if (!res.ok) throw new Error("Failed to update profile");

        // 3️⃣ local UI
        setProfile(prev => ({ ...prev, [field]: imageUrl }));

        // 4️⃣ navbar + auth context
        await updateUser({ [field]: imageUrl });

        toast({
          title: "Photo updated",
          description: `${field} successfully updated`,
        });
      } catch (err) {
        console.error(err);
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: "Could not upload image",
        });
      }
    };

    const handleRemovePhoto = async (index: number) => {
      const url = profile.photos[index];

      // 🔧 временно просто убираем из профиля
      const updated = profile.photos.filter((_, i) => i !== index);

      setProfile(prev => ({ ...prev, photos: updated }));

      await fetch("/api/me/coach-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photos: updated }),
      });
    };

  const myCoaches = COACHES_DATA.filter(coach => profile.coaches.includes(coach.id));

  return (
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

        {/* Cover Photo Section */}
        <div className="relative h-[250px] md:h-[350px] w-full overflow-hidden group">
          <div className="absolute inset-0 bg-black/20 z-10" />
          <img 
            src={profile.cover ?? undefined} 
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
          <div className="absolute bottom-0 left-0 w-full h-24 bg-linear-to-t from-background to-transparent z-20" />
        </div>

        <div className="container mx-auto px-4 -mt-20 relative z-30 max-w-6xl">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row gap-8 mb-12">
            <div className="shrink-0 mx-auto md:mx-0 relative group">
              <Avatar className="w-40 h-40 border-4 border-background shadow-xl">
                <AvatarImage src={profile.avatar ?? undefined} className="object-cover" />
                <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="w-8 h-8 text-white" />
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
                </label>
              )}
            </div>
            
            <div className="grow text-center md:text-left space-y-4">
              <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4">
                <div>
                  {isEditing ? (
                    <div className="space-y-2">
                       <Input 
                        value={profile.name} 
                        onChange={(e) => setProfile({...profile, name: e.target.value})}
                        className="text-3xl font-bold h-auto py-2"
                      />
                      <div className="flex gap-2">
                         <Input 
                          value={profile.country} 
                          placeholder="Country"
                          onChange={(e) => setProfile({...profile, country: e.target.value})}
                          className="w-40"
                        />
                         <Input 
                          value={profile.age} 
                          placeholder="Age"
                          onChange={(e) => setProfile({...profile, age: e.target.value})}
                          className="w-20"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-4xl font-display font-bold text-primary mb-2">{profile.name}</h1>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Globe className="w-4 h-4" />
                          <span>{profile.country}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{profile.age} years old</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{profile.location}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {isOwnProfile && (
                  <Button onClick={isEditing ? handleSave : () => setIsEditing(true)} variant={isEditing ? "default" : "outline"}>
                    {isEditing ? <Save className="w-4 h-4 mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
                    {isEditing ? "Save Profile" : "Edit Profile"}
                  </Button>
                )}
              </div>

              {isEditing ? (
                <Textarea 
                  value={profile.bio} 
                  onChange={(e) => setProfile({...profile, bio: e.target.value})} 
                  className="mt-4"
                />
              ) : (
                <p className="text-lg leading-relaxed max-w-2xl">{profile.bio}</p>
              )}
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="bg-transparent border-b w-full justify-start rounded-none h-auto p-0 gap-6">
              <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-lg">Overview</TabsTrigger>
              <TabsTrigger value="tournaments" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-lg">Tournaments</TabsTrigger>
              <TabsTrigger value="coaches" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-lg">My Coaches</TabsTrigger>
              <TabsTrigger value="marketplace" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-lg">Selling ({marketplaceItems.length})</TabsTrigger>
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
            </TabsContent>

            <TabsContent value="tournaments" className="space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Tournament History</h3>
                {isOwnProfile && (
                  <Dialog open={isTournamentModalOpen} onOpenChange={setIsTournamentModalOpen}>
                    <DialogTrigger asChild>
                      <Button><Plus className="w-4 h-4 mr-2" /> Add Entry</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add Tournament Result</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Tournament Name</Label>
                          <Input 
                            value={newTournament.name} 
                            onChange={(e) => setNewTournament({...newTournament, name: e.target.value})} 
                            placeholder="e.g. Sydney Open 2024" 
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
                              value={newTournament.result} 
                              onValueChange={(val) => setNewTournament({...newTournament, result: val})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Result" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Winner">Winner</SelectItem>
                                <SelectItem value="Finalist">Finalist</SelectItem>
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
                              onChange={(e) => setNewTournament({...newTournament, award: e.target.value})} 
                              placeholder="e.g. Gold Trophy" 
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Tournament Photos (Max 5)</Label>
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
                              <label className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                                <span className="text-[10px] text-muted-foreground">Add Photo</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  multiple 
                                  className="hidden" 
                                  onChange={handleTournamentPhotoUpload}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddTournament}>Save Entry</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {/* Tournament Lists */}
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                const sortedTournaments = [...tournaments].sort((a, b) => {
                   // Sort descending by date
                   return new Date(b.date).getTime() - new Date(a.date).getTime();
                });

                const upcoming = sortedTournaments.filter(t => t.date > today);
                const past = sortedTournaments.filter(t => t.date <= today);

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
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteTournament(t.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
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
                  <div className="space-y-8">
                     {/* Upcoming Section */}
                     {upcoming.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold flex items-center gap-2 text-primary">
                            <Calendar className="w-5 h-5" /> Upcoming Tournaments
                          </h4>
                          <div className="grid grid-cols-1 gap-4">
                            {upcoming.map(t => <TournamentCard key={t.id} t={t} />)}
                          </div>
                        </div>
                     )}

                     {/* Past Section */}
                     <div className="space-y-4">
                        <h4 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                          <Trophy className="w-5 h-5" /> Past Tournaments
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          {past.map(t => <TournamentCard key={t.id} t={t} />)}
                        </div>
                        {past.length === 0 && upcoming.length === 0 && (
                          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No tournament history added yet.</p>
                          </div>
                        )}
                     </div>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="coaches" className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCoaches.map(coach => (
                  <Card key={coach.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-video relative">
                      <img src={coach.cover} alt={coach.name} className="w-full h-full object-cover" />
                      <div className="absolute bottom-4 left-4 flex items-center gap-3">
                        <Avatar className="border-2 border-background">
                          <AvatarImage src={coach.image} />
                          <AvatarFallback>{coach.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="text-white drop-shadow-md">
                          <div className="font-bold">{coach.name}</div>
                          <div className="text-xs opacity-90">{coach.title}</div>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4 pt-4">
                      <Button className="w-full" variant="secondary">Book Session</Button>
                    </CardContent>
                  </Card>
                ))}
                {myCoaches.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <p>No coaches connected yet.</p>
                    <Button variant="link" onClick={() => setLocation("/coaches")}>Find a Coach</Button>
                  </div>
                )}
              </div>
            </TabsContent>

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
                          <Label>Price ($)</Label>
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
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddItem}>List Item</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketplaceItems.map(item => (
                  <Card key={item.id}>
                    <div className="aspect-square bg-muted relative">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
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
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
