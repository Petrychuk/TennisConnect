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
import bgImage from "@assets/generated_images/subtle_abstract_tennis-themed_background_with_lime_green_accents.png";

// Default Profile State
const DEFAULT_PLAYER_PROFILE = {
  name: "New Player",
  location: "Sydney, NSW",
  age: "25",
  country: "Australia",
  skillLevel: "Intermediate",
  bio: "Hi! I love tennis and I'm looking for partners to play with on weekends.",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop",
  preferredCourts: ["Bondi Beach", "Manly"],
  coaches: [1], // IDs of connected coaches
  marketplaceItems: [] as any[]
};

export default function PlayerProfile() {
  const [match, params] = useRoute("/player/:id");
  const profileId = params?.id;
  const { user, isAuthenticated, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isGenericProfileRoute = !profileId || profileId === "profile";
  const isOwnProfile = isGenericProfileRoute || (isAuthenticated && profileId === "1"); // Assuming ID 1 is current user for demo

  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_PLAYER_PROFILE);
  
  // Marketplace State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    description: "",
    condition: "Used - Good"
  });

  // Load Profile Logic
  useEffect(() => {
    if (isGenericProfileRoute && !isAuthenticated) {
      setLocation("/auth");
      return;
    }

    const savedProfile = localStorage.getItem("tennis_connect_player_profile");
    if (savedProfile && isOwnProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setProfile({ ...DEFAULT_PLAYER_PROFILE, ...parsed });
      } catch (e) {
        console.error("Failed to parse profile", e);
      }
    } else if (user && isOwnProfile) {
      setProfile(prev => ({
        ...prev,
        name: user.name || prev.name,
        avatar: user.avatar || prev.avatar
      }));
    }
  }, [isAuthenticated, user, isOwnProfile]);

  const handleSave = () => {
    setIsEditing(false);
    localStorage.setItem("tennis_connect_player_profile", JSON.stringify(profile));
    updateUser({ name: profile.name, avatar: profile.avatar });
    toast({ title: "Profile Updated", description: "Your changes have been saved." });
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.price) return;
    
    const item = {
      id: Date.now(),
      ...newItem,
      location: profile.location,
      seller_name: profile.name,
      image: "https://images.unsplash.com/photo-1617083934555-5634045431b0?w=800&q=80" // Placeholder
    };

    setProfile(prev => ({
      ...prev,
      marketplaceItems: [...prev.marketplaceItems, item]
    }));
    
    setNewItem({ name: "", price: "", description: "", condition: "Used - Good" });
    setIsItemModalOpen(false);
    toast({ title: "Item Added", description: "Your item is now listed." });
  };

  const handleDeleteItem = (id: number) => {
    setProfile(prev => ({
      ...prev,
      marketplaceItems: prev.marketplaceItems.filter(item => item.id !== id)
    }));
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

        <div className="container mx-auto px-4 pt-24 max-w-6xl">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row gap-8 mb-12">
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <Avatar className="w-40 h-40 border-4 border-background shadow-xl">
                <AvatarImage src={profile.avatar} className="object-cover" />
                <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
            
            <div className="flex-grow text-center md:text-left space-y-4">
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
              <TabsTrigger value="coaches" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-lg">My Coaches</TabsTrigger>
              <TabsTrigger value="marketplace" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-lg">Selling ({profile.marketplaceItems.length})</TabsTrigger>
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
                {profile.marketplaceItems.map(item => (
                  <Card key={item.id}>
                    <div className="aspect-square bg-muted relative">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start text-lg">
                        <span>{item.name}</span>
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
                {profile.marketplaceItems.length === 0 && (
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
