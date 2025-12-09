import { useState } from "react";
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
import { MapPin, Camera, Edit2, Save, Plus, Trophy, Clock, DollarSign, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@assets/generated_images/dynamic_tennis_ball_on_court_line_with_dramatic_lighting.png";
import avatarImage from "@assets/generated_images/female_tennis_coach_portrait.png";
import gallery1 from "@assets/generated_images/kids_tennis_training_session.png";
import gallery2 from "@assets/generated_images/tennis_match_action_shot_in_sydney.png";

export default function CoachProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  
  // Mock Data
  const [profile, setProfile] = useState({
    name: "Sarah Thompson",
    title: "Professional Tennis Coach (ITF Level 2)",
    location: "Northern Beaches, Sydney",
    bio: "Former WTA ranked player with 10+ years of coaching experience. I specialize in junior development and high-performance training for competitive players. My coaching philosophy focuses on building a strong technical foundation while developing tactical awareness on the court.",
    rate: "90",
    experience: "10",
    locations: ["Manly", "Mosman", "Freshwater", "Brookvale"],
    photos: [gallery1, gallery2]
  });

  const availableLocations = [
    "Bondi Beach", "Manly", "Surry Hills", "Mosman", "Coogee", "Parramatta", "Chatswood", "Newtown", "Freshwater", "Brookvale"
  ];

  const handleSave = () => {
    setIsEditing(false);
    toast({
      title: "Profile Updated",
      description: "Your changes have been saved successfully.",
    });
  };

  const handleAddPhoto = () => {
    // Mock adding a photo
    const newPhoto = "https://images.unsplash.com/photo-1599586120429-48281b6f0ece?w=800&q=80";
    setProfile({
      ...profile,
      photos: [...profile.photos, newPhoto]
    });
    toast({
      title: "Photo Added",
      description: "New photo has been added to your gallery.",
    });
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...profile.photos];
    newPhotos.splice(index, 1);
    setProfile({
      ...profile,
      photos: newPhotos
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <main className="pb-24">
        {/* Profile Header / Hero */}
        <div className="relative h-[300px] md:h-[400px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-black/40 z-10" />
          <img 
            src={heroImage} 
            alt="Cover" 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent z-20" />
          
          <div className="absolute bottom-6 right-6 z-30">
             {isEditing ? (
               <Button onClick={handleSave} className="bg-primary text-primary-foreground font-bold shadow-lg gap-2">
                 <Save className="w-4 h-4" /> Save Profile
               </Button>
             ) : (
               <Button onClick={() => setIsEditing(true)} variant="secondary" className="bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 font-bold shadow-lg gap-2">
                 <Edit2 className="w-4 h-4" /> Edit Profile
               </Button>
             )}
          </div>
        </div>

        <div className="container mx-auto px-4 relative z-30 -mt-20">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar Column */}
            <div className="flex-shrink-0 relative">
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-background shadow-2xl overflow-hidden bg-muted relative group">
                <img src={avatarImage} alt="Profile" className="w-full h-full object-cover" />
                {isEditing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="flex-grow pt-4 md:pt-12 text-center md:text-left space-y-4 w-full">
              {isEditing ? (
                <div className="space-y-4 max-w-2xl">
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
          </div>

          {/* Main Content Tabs */}
          <div className="mt-12">
            <Tabs defaultValue="about" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">About</TabsTrigger>
                <TabsTrigger value="photos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">Photos</TabsTrigger>
                <TabsTrigger value="schedule" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-lg">Schedule & Locations</TabsTrigger>
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
                  </TabsContent>

                  <TabsContent value="photos" className="mt-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Upload Button */}
                      {isEditing && (
                        <div 
                          onClick={handleAddPhoto}
                          className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center cursor-pointer group"
                        >
                          <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary mb-2" />
                          <span className="text-sm font-medium text-muted-foreground group-hover:text-primary">Add Photo</span>
                        </div>
                      )}
                      
                      {/* Gallery Items */}
                      {profile.photos.map((photo, index) => (
                        <motion.div 
                          key={index} 
                          whileHover={{ scale: 1.02 }} 
                          className="aspect-square rounded-xl overflow-hidden relative group"
                        >
                          <img src={photo} className="w-full h-full object-cover" alt={`Gallery ${index + 1}`} />
                          {isEditing && (
                             <button 
                               onClick={() => handleRemovePhoto(index)}
                               className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                               <X className="w-4 h-4" />
                             </button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="schedule" className="mt-0">
                     <Card>
                       <CardHeader>
                         <CardTitle>Available Locations</CardTitle>
                       </CardHeader>
                       <CardContent>
                         <div className="flex flex-wrap gap-2">
                           {profile.locations.map((loc) => (
                             <Badge key={loc} variant="secondary" className="px-3 py-1.5 text-sm flex gap-2">
                               <MapPin className="w-3 h-3" />
                               {loc}
                               {isEditing && (
                                 <button 
                                   onClick={() => setProfile({...profile, locations: profile.locations.filter(l => l !== loc)})}
                                   className="ml-1 hover:text-destructive"
                                 >
                                   ×
                                 </button>
                               )}
                             </Badge>
                           ))}
                           
                           {isEditing && (
                             <Select onValueChange={(val) => {
                               if (!profile.locations.includes(val)) {
                                 setProfile({...profile, locations: [...profile.locations, val]})
                               }
                             }}>
                               <SelectTrigger className="w-[180px] h-8">
                                 <SelectValue placeholder="Add location" />
                               </SelectTrigger>
                               <SelectContent>
                                 {availableLocations.map(loc => (
                                   <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           )}
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
