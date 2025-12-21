import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, User, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import heroImage from "@assets/118174652_3488272227872998_1093348718284959373_n_1764914380008.jpg";

import avatarImage from "@assets/generated_images/female_tennis_coach_portrait.png";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const registerSchema = z.object({
  role: z.enum(["player", "coach"], { required_error: "Please select a role" }),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "player", name: "", email: "", password: "", confirmPassword: "" },
  });

  const onLogin = async (data: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      
      // Mock login - assuming coach role for demo if email contains "coach"
      const role = data.email.includes("coach") ? "coach" : "coach"; // Default to coach for demo convenience
      
      // Check if there is a saved profile to use the correct name and avatar
      let userName = "Nataliia Petrychuk";
      let userAvatar = avatarImage;
      
      const savedProfile = localStorage.getItem("tennis_connect_coach_profile");
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          if (profile.name) userName = profile.name;
          if (profile.avatar) userAvatar = profile.avatar;
        } catch (e) {
          console.error("Failed to parse profile during login", e);
        }
      }
      
      login({
        name: userName,
        email: data.email,
        role: role,
        avatar: userAvatar
      });

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
      
      if (role === "coach") {
        setLocation("/coach/profile");
      } else {
        setLocation("/player/profile");
      }
    }, 1500);
  };

  const onRegister = async (data: z.infer<typeof registerSchema>) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      
      login({
        name: data.name,
        email: data.email,
        role: data.role,
        avatar: "https://images.unsplash.com/photo-1605218427368-35b868661705?w=400&h=400&fit=crop"
      });

      toast({
        title: "Account created",
        description: "Welcome to TennisConnect!",
      });
      
      if (data.role === "coach") {
        setLocation("/coach/profile");
      } else {
        setLocation("/player/profile");
      }
    }, 1500);
  };

  const handleSocialLogin = (provider: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      
      // Check if there is a saved profile to use the correct name and avatar
      let userName = "Nataliia Petrychuk";
      let userAvatar = avatarImage;
      
      const savedProfile = localStorage.getItem("tennis_connect_coach_profile");
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          if (profile.name) userName = profile.name;
          if (profile.avatar) userAvatar = profile.avatar;
        } catch (e) {
          console.error("Failed to parse profile during login", e);
        }
      }

      login({
        name: userName,
        email: `${userName.toLowerCase().replace(" ", ".")}@example.com`,
        role: "coach",
        avatar: userAvatar
      });

      toast({
        title: `Welcome back via ${provider}!`,
        description: "You have successfully signed in.",
      });
      
      setLocation("/coach/profile");
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col p-8 md:p-12 lg:p-16 justify-center bg-background relative z-10">
        <Link href="/">
          <a className="absolute top-8 left-8 md:left-12 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </a>
        </Link>

        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              Tennis<span className="text-primary">Connect</span>
            </h1>
            <p className="text-muted-foreground">
              Join the largest tennis community in Australia.
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    placeholder="name@example.com" 
                    {...loginForm.register("email")} 
                    className={loginForm.formState.errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a href="#" className="text-sm font-medium text-primary hover:underline">
                      Forgot password?
                    </a>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    {...loginForm.register("password")} 
                    className={loginForm.formState.errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 py-2">
                  <Checkbox id="remember" />
                  <label
                    htmlFor="remember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remember me for 30 days
                  </label>
                </div>

                <Button type="submit" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div className="space-y-3">
                  <Label>I want to join as a...</Label>
                  <RadioGroup
                    defaultValue="player"
                    onValueChange={(value) => registerForm.setValue("role", value as "player" | "coach")}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="player" id="role-player" className="peer sr-only" />
                      <Label
                        htmlFor="role-player"
                        className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                      >
                        <User className="mb-2 w-6 h-6" />
                        <span className="font-bold">Player</span>
                        <span className="text-xs text-muted-foreground text-center">Find partners</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="coach" id="role-coach" className="peer sr-only" />
                      <Label
                        htmlFor="role-coach"
                        className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                      >
                        <Trophy className="mb-2 w-6 h-6" />
                        <span className="font-bold">Coach</span>
                        <span className="text-xs text-muted-foreground text-center">Find students</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input 
                    id="reg-name" 
                    placeholder="John Doe" 
                    {...registerForm.register("name")} 
                    className={registerForm.formState.errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input 
                    id="reg-email" 
                    placeholder="name@example.com" 
                    {...registerForm.register("email")} 
                    className={registerForm.formState.errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input 
                    id="reg-password" 
                    type="password" 
                    {...registerForm.register("password")} 
                    className={registerForm.formState.errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input 
                    id="confirm-password" 
                    type="password" 
                    {...registerForm.register("confirmPassword")} 
                    className={registerForm.formState.errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
                
                <p className="text-xs text-center text-muted-foreground mt-4">
                  By clicking Create Account, you agree to our <a href="#" className="underline hover:text-primary">Terms of Service</a> and <a href="#" className="underline hover:text-primary">Privacy Policy</a>.
                </p>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="w-full" onClick={() => handleSocialLogin("Google")} disabled={isLoading}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleSocialLogin("Facebook")} disabled={isLoading}>
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
              Facebook
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-black">
          <img 
            src={heroImage} 
            alt="Tennis Match" 
            className="w-full h-full object-cover object-[50%_0%] opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/20 to-black/80" />
          
          <div className="absolute bottom-16 left-12 right-12 text-white">
            <blockquote className="text-2xl font-display font-bold leading-relaxed mb-6">
              "TennisConnect helped me find a training partner within a week of moving to Sydney. Now we play every Tuesday!"
            </blockquote>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                MC
              </div>
              <div>
                <div className="font-bold">Michael Chen</div>
                <div className="text-primary text-sm">Member since 2024</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
