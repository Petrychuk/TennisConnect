import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

const playerProfileSchema = z.object({
  age: z.string().min(1, "Age is required"),
  country: z.string().min(1, "Country is required"),
  location: z.string().min(1, "City is required"),
  bio: z.string().min(10, "Bio must be at least 10 characters"),
  skillLevel: z.string().min(1, "Skill level is required"),
  preferredCourts: z.string().optional(),
});

const coachProfileSchema = z.object({
  location: z.string().min(1, "City is required"),
  bio: z.string().min(10, "Bio must be at least 10 characters"),
  title: z.string().min(1, "Title is required"),
  experience: z.string().optional(),
  rate: z.string().optional(),
});

export default function CompleteProfilePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading, updateUserProfile } = useAuth();

  const playerForm = useForm<z.infer<typeof playerProfileSchema>>({
    resolver: zodResolver(playerProfileSchema),
    defaultValues: {
      age: "",
      country: "Australia",
      location: "",
      bio: "",
      skillLevel: "Beginner",
      preferredCourts: "",
    },
  });

  const coachForm = useForm<z.infer<typeof coachProfileSchema>>({
    resolver: zodResolver(coachProfileSchema),
    defaultValues: {
      location: "",
      bio: "",
      title: "Tennis Coach",
      experience: "",
      rate: "",
    },
  });

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/auth");
    }
    if (!loading && user?.profileCompleted) {
      setLocation(`/${user.role}/${user.slug}`);
    }
  }, [user, loading, setLocation]);

  const onPlayerSubmit = async (data: z.infer<typeof playerProfileSchema>) => {
    setIsLoading(true);
  
    try {
      const profileData = {
        ...data,
        preferredCourts: data.preferredCourts
          ? data.preferredCourts.split(",").map(c => c.trim())
          : [],
      };
  
      // 🔹 1. Save player profile
      const res = await fetch("/api/me/player-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
        credentials: "include",
      });
  
      if (!res.ok) throw new Error("Failed to save profile");
  
      // 🔹 2. Complete profile
      const completeRes = await fetch("/api/me/complete-profile", {
        method: "POST",
        credentials: "include",
      });
  
      if (!completeRes.ok) {
        const err = await completeRes.text();
        throw new Error(err);
      }
  
      // 🔹 3. Fetch fresh user (🔥 ВАЖНО)
      const userRes = await fetch("/api/auth/me", {
        credentials: "include",
      });
  
      if (!userRes.ok) {
        const errText = await userRes.text();
        throw new Error(errText);
      }
  
      const freshUser = await userRes.json();
  
      if (!freshUser?.slug) {
        throw new Error("Slug missing");
      }
  
      // 🔹 4. Redirect
      window.location.href = `/player/${freshUser.slug}`;
  
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onCoachSubmit = async (data: z.infer<typeof coachProfileSchema>) => {
  console.log("🚀 SUBMIT START", data);

  setIsLoading(true);

  try {
    // 🔹 1. Save coach profile
    console.log("➡️ Step 1: Saving coach profile");

    const res = await fetch("/api/me/coach-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });

    const text = await res.text();
    console.log("✅ coach-profile response:", text);

    if (!res.ok) {
      console.error("❌ Step 1 FAILED");
      throw new Error(text);
    }

    console.log("✅ Step 1 SUCCESS");

    // 🔹 2. Complete profile
    console.log("➡️ Step 2: Completing profile");

    const completeRes = await fetch("/api/me/complete-profile", {
      method: "POST",
      credentials: "include",
    });

    console.log("complete-profile status:", completeRes.status);

    if (!completeRes.ok) {
      const err = await completeRes.text();
      console.error("❌ Step 2 FAILED:", err);
      throw new Error(err);
    }

    console.log("✅ Step 2 SUCCESS");

    toast({
      title: "Profile completed!",
      description: "Your profile is now visible to students.",
    });

    // 🔹 4. Fetch fresh user
    console.log("➡️ Step 4: Fetching fresh user");

    const userRes = await fetch("/api/auth/me", {
      credentials: "include",
    });

    console.log("auth/me status:", userRes.status);

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("❌ Step 4 FAILED:", errText);
      return;
    }

    const freshUser = await userRes.json();
    console.log("✅ freshUser:", freshUser);

    if (!freshUser?.slug) {
      console.error("❌ Step 4 FAILED: slug missing");
      return;
    }

    console.log("✅ Step 4 SUCCESS");

    // 🔹 5. Redirect
    console.log("➡️ Step 5: Redirecting to", `/coach/${freshUser.slug}`);

    setLocation(`/coach/${freshUser.slug}`);

    console.log("❗ If you see this log — redirect DID NOT happen");

  } catch (error: any) {
    console.error("💥 SUBMIT ERROR:", error);

    toast({
      title: "Error",
      description: error.message || "Failed to save profile",
      variant: "destructive",
    });
  } finally {
    console.log("🏁 SUBMIT END");
    setIsLoading(false);
  }
};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/20 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
          <p className="text-muted-foreground">
            Fill in the details below to start connecting with {user?.role === "coach" ? "students" : "other players"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {user?.role === "coach" ? "Coach Profile" : "Player Profile"}
            </CardTitle>
            <CardDescription>
              This information will be shown on your public profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user?.role === "player" ? (
              <form onSubmit={playerForm.handleSubmit(onPlayerSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="25"
                      {...playerForm.register("age")}
                      data-testid="input-age"
                    />
                    {playerForm.formState.errors.age && (
                      <p className="text-sm text-destructive">{playerForm.formState.errors.age.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      defaultValue="Australia"
                      onValueChange={(value) => playerForm.setValue("country", value)}
                    >
                      <SelectTrigger data-testid="select-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Australia">Australia</SelectItem>
                        <SelectItem value="USA">USA</SelectItem>
                        <SelectItem value="UK">UK</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="New Zealand">New Zealand</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">City</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="location"
                      className="pl-10"
                      placeholder="Sydney, NSW"
                      {...playerForm.register("location")}
                      data-testid="input-location"
                    />
                  </div>
                  {playerForm.formState.errors.location && (
                    <p className="text-sm text-destructive">{playerForm.formState.errors.location.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skillLevel">Skill Level</Label>
                  <Select
                    defaultValue="Beginner"
                    onValueChange={(value) => playerForm.setValue("skillLevel", value)}
                  >
                    <SelectTrigger data-testid="select-skill">
                      <SelectValue placeholder="Select skill level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                      <SelectItem value="Professional">Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredCourts">Preferred Locations (comma separated)</Label>
                  <Input
                    id="preferredCourts"
                    placeholder="Bondi Beach, Manly, Sydney CBD"
                    {...playerForm.register("preferredCourts")}
                    data-testid="input-courts"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell other players about yourself, your playing style, and what you're looking for..."
                    rows={4}
                    {...playerForm.register("bio")}
                    data-testid="textarea-bio"
                  />
                  {playerForm.formState.errors.bio && (
                    <p className="text-sm text-destructive">{playerForm.formState.errors.bio.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-save">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Profile
                </Button>
              </form>
            ) : (
              <form onSubmit={coachForm.handleSubmit(onCoachSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Head Tennis Coach"
                    {...coachForm.register("title")}
                    data-testid="input-title"
                  />
                  {coachForm.formState.errors.title && (
                    <p className="text-sm text-destructive">{coachForm.formState.errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="location"
                      className="pl-10"
                      placeholder="Sydney, NSW"
                      {...coachForm.register("location")}
                      data-testid="input-location"
                    />
                  </div>
                  {coachForm.formState.errors.location && (
                    <p className="text-sm text-destructive">{coachForm.formState.errors.location.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="experience">Years of Experience</Label>
                    <Input
                      id="experience"
                      placeholder="10+ years"
                      {...coachForm.register("experience")}
                      data-testid="input-experience"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate">Hourly Rate</Label>
                    <Input
                      id="rate"
                      placeholder="$80/hour"
                      {...coachForm.register("rate")}
                      data-testid="input-rate"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell potential students about your coaching style, experience, and what they can expect..."
                    rows={4}
                    {...coachForm.register("bio")}
                    data-testid="textarea-bio"
                  />
                  {coachForm.formState.errors.bio && (
                    <p className="text-sm text-destructive">{coachForm.formState.errors.bio.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-save">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Profile
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
