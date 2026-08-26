import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, User, MapPin, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";
import { playerProfileSchema, coachProfileSchema } from "@/lib/validations/profile"
import { cn } from "@/lib/utils";

// Kept in one place since both the Country combobox and any future
// country-dependent logic should read from the same list. "USA"/"UK"
// (not "United States"/"United Kingdom") are kept exactly as they were
// in the original short list - changing an existing option's stored
// value string would silently orphan any profile that already saved
// with it, so only new entries were added around them, nothing renamed.
const COUNTRIES = [
  "Australia",
  "New Zealand",
  "USA",
  "Canada",
  "UK",
  "Ireland",
  "France",
  "Germany",
  "Italy",
  "Spain",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Sweden",
  "Norway",
  "Denmark",
  "Poland",
  "Ukraine",
  "China",
  "Japan",
  "South Korea",
  "India",
  "Singapore",
  "Philippines",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "United Arab Emirates",
  "South Africa",
  "Brazil",
  "Argentina",
  "Mexico",
] as const;

// Short one-liners rather than the full bullet-point breakdown - most
// people can place themselves from a single sentence, and the linked
// guide (below the list) is there for anyone who genuinely can't.
// The UTR range is a rough approximation, not sourced from her article's
// exact numbers - flagged to her to confirm/correct against the real
// article rather than presented as authoritative.
const SKILL_LEVELS = [
  { value: "Beginner", dots: 1, utr: "1.0–3.0", blurb: "New to tennis and learning the basics." },
  { value: "Intermediate", dots: 2, utr: "3.0–5.0", blurb: "Regular social player, comfortable with a rally." },
  { value: "Advanced", dots: 3, utr: "5.0–7.0", blurb: "Competitive club or tournament player." },
  { value: "Professional", dots: 4, utr: "7.0+", blurb: "Elite or professional level." },
] as const;

export default function CompleteProfilePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading, updateUserProfile } = useAuth();

  const playerForm = useForm<z.infer<typeof playerProfileSchema>>({
    resolver: zodResolver(playerProfileSchema),
    mode: "onChange",
    defaultValues: {
      country: "Australia",
      location: "",
      bio: "",
      skillLevel: "Beginner",
      preferredCourts: "",
    },
  });

  const coachForm = useForm<z.infer<typeof coachProfileSchema>>({
    resolver: zodResolver(coachProfileSchema),
    mode: "onChange",
    defaultValues: {
      location: "",
      bio: "",
      // Was a literal default value, not a placeholder - the field
      // already has a real placeholder="Head Tennis Coach" attribute
      // (react-hook-form's defaultValues sets the actual value, which
      // masks the placeholder since the field is never truly empty).
      // Every coach who didn't notice and change it submitted the exact
      // same "Tennis Coach" title.
      title: "",
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
      title: "Profile submitted",
      description: "Your profile has been submitted for review and will appear in the directory once approved.",
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
    <>
      <SEO
        title="Complete Your Profile | TennisConnect"
        description="Complete your TennisConnect profile."
        canonical="/complete-profile"
        noIndex
      />
      <div className="min-h-screen bg-linear-to-b from-background to-muted/20 py-6 px-3 sm:py-12 sm:px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Complete Your Profile</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Fill in the details below to start connecting with {user?.role === "coach" ? "students" : "other players"}
            </p>
          </div>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {user?.role === "coach" ? "Coach Profile" : "Player Profile"}
              </CardTitle>
              <CardDescription>
                This information will be shown on your public profile
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {user?.role === "player" ? (
                <form onSubmit={playerForm.handleSubmit(onPlayerSubmit)} className="space-y-6">
                  <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={countryOpen}
                            className="w-full justify-between font-normal"
                            data-testid="select-country"
                          >
                            {playerForm.watch("country") || "Select country"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search country..." />
                            <CommandList>
                              <CommandEmpty>No country found.</CommandEmpty>
                              <CommandGroup className="max-h-[280px] overflow-auto">
                                {COUNTRIES.map((c) => (
                                  <CommandItem
                                    key={c}
                                    value={c}
                                    onSelect={() => {
                                      playerForm.setValue("country", c, { shouldValidate: true });
                                      setCountryOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        playerForm.watch("country") === c ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {c}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                    <Label>Skill Level</Label>
                    <div className="space-y-2" role="radiogroup" aria-label="Skill level">
                      {SKILL_LEVELS.map((level) => {
                        const selected = playerForm.watch("skillLevel") === level.value;
                        return (
                          <label
                            key={level.value}
                            className={cn(
                              "flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors",
                              selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                            )}
                          >
                            <input
                              type="radio"
                              name="skillLevel"
                              value={level.value}
                              checked={selected}
                              onChange={() => playerForm.setValue("skillLevel", level.value, { shouldValidate: true })}
                              className="mt-1 shrink-0 accent-primary"
                              data-testid={`radio-skill-${level.value.toLowerCase()}`}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                                {level.value}
                                {/* Branded level indicator (filled dots) instead of
                                    emoji - a plain, consistent way to show
                                    increasing skill without needing an icon asset. */}
                                <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                                  {Array.from({ length: 4 }).map((_, i) => (
                                    <span
                                      key={i}
                                      className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        i < level.dots ? "bg-primary" : "bg-muted-foreground/25"
                                      )}
                                    />
                                  ))}
                                </span>
                                <span className="text-xs font-normal text-muted-foreground">
                                  (~UTR {level.utr})
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">{level.blurb}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Not sure which level you are?{" "}
                      <a
                        href="/articles/what-is-your-tennis-level-guide"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        data-testid="link-skill-guide"
                      >
                        Read our Tennis Level Guide →
                      </a>
                    </p>
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

                  <Button
                    type="submit"
                    className={cn("w-full sm:w-1/3 sm:mx-auto flex items-center justify-center rounded-full transition-opacity", !playerForm.formState.isValid && "opacity-50 hover:opacity-60")}
                    disabled={isLoading}
                    data-testid="button-save"
                  >
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

                  <Button
                    type="submit"
                    className={cn("w-full sm:w-1/3 sm:mx-auto flex items-center justify-center rounded-full transition-opacity", !coachForm.formState.isValid && "opacity-50 hover:opacity-60")}
                    disabled={isLoading}
                    data-testid="button-save"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Profile
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
