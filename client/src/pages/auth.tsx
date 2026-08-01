import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Loader2, User, Trophy, Mail, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import heroImage from "/assets/images/tennis_main.jpg";
import loginImage from "/assets/images/me_attack.jpg";
import SEO from "@/components/seo";
import { registerSchema, loginSchema } from "@/lib/validations/auth";

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { login, register } = useAuth();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "player", name: "", email: "", password: "", confirmPassword: "", agreeToTerms: false, wantsToOrganize: false },
  });

  const onLogin = async (data: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    try {
      const loggedInUser = await login(data.email, data.password, rememberMe);

      const params = new URLSearchParams(search);
      const returnTo = params.get("returnTo");
      const joinSession = params.get("joinSession");

      if (returnTo) {
        toast({
          title: "Welcome back!",
          description: "You're signed in — picking up right where you left off.",
        });
        const target = new URL(returnTo, window.location.origin);
        if (joinSession) target.searchParams.set("joinSession", joinSession);
        setLocation(target.pathname + target.search);
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
        if (!loggedInUser.slug) {
          toast({
            title: "Profile error",
            description: "Your profile is not ready yet. Please try again later.",
            variant: "destructive",
          });
          return;
        }
      setLocation(`/${loggedInUser.role}/${loggedInUser.slug}`);

    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

const onRegister = async (data: z.infer<typeof registerSchema>) => {
  setIsLoading(true);
  try {
    
    const user = await register(data.email, data.password, data.name, data.role, data.wantsToOrganize);

    const params = new URLSearchParams(search);
    const returnTo = params.get("returnTo");
    const joinSession = params.get("joinSession");

    if (returnTo && joinSession) {
      // Deliberately skips /complete-profile for this specific flow -
      // they came here to join a session, not to fill out a profile,
      // and role/name/email/password are already collected by this
      // form. They can always fill the rest in later from their
      // profile.
      toast({
        title: "Welcome to TennisConnect!",
        description: "Thanks for registering — joining that session for you now.",
      });
      const target = new URL(returnTo, window.location.origin);
      target.searchParams.set("joinSession", joinSession);
      setLocation(target.pathname + target.search);
      return;
    }

    toast({
      title: "Account created",
       description: "Please complete your profile to get started!",
    });

    setLocation("/complete-profile");
   
  } catch (error: any) {
    toast({
      title: "Registration failed",
      description: error.message || "Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};

  /* const handleSocialLogin = (provider: string) => {
    toast({
      title: "Coming Soon",
      description: `${provider} login will be available soon.`,
    });
  }; */

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address",
      });
  
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      const data = await res.json();

      setForgotPasswordSent(true);
      toast({
        title: "Check your email",
        description: "If an account exists, we've sent a password reset link.",
      });

      // In development, show the reset URL
      if (data.resetUrl) {
        console.log("Reset URL:", data.resetUrl);
        toast({
          title: "Development Mode",
          description: "Check console for reset link",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send reset email. Please try again.",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (

    <>
     <SEO
        title="Sign In | TennisConnect"
        description="Sign in to TennisConnect."
        canonical="/auth"
        noIndex
      />
    
      <div className="min-h-screen w-full flex">
        {/* Left Side - Form */}
        <div className="w-full lg:w-1/2 flex flex-col p-8 md:p-12 lg:p-16 justify-center bg-background relative z-10">
          <Link href="/" className="absolute top-8 left-8 md:left-12 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="max-w-md w-full mx-auto space-y-8">
            <div className="text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              Tennis
              <span className="text-primary">Connect</span>
              <span className="inline-block w-2 h-2 ml-1 rounded-full bg-[hsl(var(--tennis-ball))] animate-pulse" />
            </h1>
              <p className="text-muted-foreground">
                Join Sydney's largest tennis community.
              </p>
            </div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="login" data-testid="login-tab" className="cursor-pointer">Sign In</TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab" className="cursor-pointer">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                {showForgotPassword ? (
                  // Forgot Password Form
                  <div className="space-y-6">
                    {forgotPasswordSent ? (
                      <div className="text-center py-8"
                           data-testid="forgot-password-success" >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Check your email</h3>
                        <p className="text-muted-foreground mb-6">
                          If an account exists for {forgotPasswordEmail}, we've sent password reset instructions.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowForgotPassword(false);
                            setForgotPasswordSent(false);
                            setForgotPasswordEmail("");
                          }}
                          className="cursor-pointer"
                          data-testid="back-to-sign-in"
                        >
                          Back to Sign In
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="text-center mb-6">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-6 h-6 text-primary" />
                          </div>
                          <h3 className="text-xl font-bold mb-1">Forgot your password?</h3>
                          <p className="text-muted-foreground text-sm">
                            Enter your email and we'll send you a reset link.
                          </p>
                        </div>
                        <form onSubmit={handleForgotPassword} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="forgot-email">Email</Label>
                            <Input
                              id="forgot-email"
                              type="email"
                              placeholder="name@example.com"
                              value={forgotPasswordEmail}
                              onChange={(e) => setForgotPasswordEmail(e.target.value)}
                              required
                              data-testid="forgot-email-input"
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                            disabled={forgotPasswordLoading}
                            data-testid="send-reset-link-button"
                          >
                            {forgotPasswordLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              "Send Reset Link"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full cursor-pointer"
                            onClick={() => setShowForgotPassword(false)}
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Sign In
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                ) : (
                  // Regular Login Form
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email"
                      data-testid="login-email" 
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
                      <button 
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm font-medium text-primary hover:underline cursor-pointer"
                        data-testid="forgot-password-link"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                        <Input
                          id="password"
                          data-testid="login-password"
                          type={showLoginPassword ? "text" : "password"}
                          {...loginForm.register("password")}
                          className={`pr-10 ${
                            loginForm.formState.errors.password
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }`}
                        />

                        <button
                          type="button"
                          data-testid="toggle-login-password"
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showLoginPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 py-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                      data-testid="remember-me"
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Remember me for 30 days
                    </label>
                  </div>

                  <Button type="submit"  data-testid="login-button" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
                )}
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
                        <RadioGroupItem value="player" id="role-player" className="peer sr-only" data-testid="role-player"/>
                        <Label
                          htmlFor="role-player"
                          data-testid="player-card"
                          className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                        >
                          <User className="mb-2 w-6 h-6" />
                          <span className="font-bold">Player</span>
                          <span className="text-xs text-muted-foreground text-center">Find partners</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="coach" id="role-coach" className="peer sr-only" data-testid="role-coach"/>
                        <Label
                          htmlFor="role-coach"
                          data-testid="coach-card"
                          className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                        >
                          <Trophy className="mb-2 w-6 h-6" />
                          <span className="font-bold">Coach</span>
                          <span className="text-xs text-muted-foreground text-center">Find students</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-start space-x-2">
                   <Checkbox
                    id="wantsToOrganize"
                    data-testid="wants-to-organize"
                     checked={registerForm.watch("wantsToOrganize")}
                     onCheckedChange={(checked) =>
                       registerForm.setValue("wantsToOrganize", !!checked)
                     }
                   />
                    <label
                     htmlFor="wantsToOrganize"
                     className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                    >
                      I want to organise tennis sessions
                   </label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full Name</Label>
                    <Input 
                      id="reg-name" 
                      data-testid="reg-name"
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
                      data-testid="reg-email" 
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
                    <div className="relative">
                      <Input
                        id="reg-password"
                        data-testid="reg-password"
                        type={showRegisterPassword ? "text" : "password"}
                        {...registerForm.register("password")}
                        className={`pr-10 ${
                          registerForm.formState.errors.password
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }`}
                      />

                      <button
                        type="button"
                        data-testid="toggle-register-password"
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                        onClick={() =>
                          setShowRegisterPassword(!showRegisterPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRegisterPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {registerForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        data-testid="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        {...registerForm.register("confirmPassword")}
                        className={`pr-10 ${
                          registerForm.formState.errors.confirmPassword
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }`}
                      />

                      <button
                        type="button"
                        data-testid="toggle-confirm-password"
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <Button type="submit" data-testid="register-button" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                  
                  <div className="flex items-start space-x-2 mt-4">
                    <Checkbox
                      id="agreeToTerms"
                      data-testid="agree-to-terms"
                      checked={registerForm.watch("agreeToTerms")}
                      onCheckedChange={(checked) =>
                        registerForm.setValue("agreeToTerms", !!checked, {
                          shouldValidate: true,
                        })
                      }
                    />

                    <label
                      htmlFor="agreeToTerms"
                      className="text-xs text-muted-foreground leading-relaxed"
                    >
                      I agree to the{" "}
                      <a
                        href="/articles/terms-of-service"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-primary"
                      >
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a
                        href="/articles/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-primary"
                      >
                        Privacy Policy
                      </a>
                    </label>
                  </div>

                  {registerForm.formState.errors.agreeToTerms && (
                    <p className="text-sm text-destructive">
                      {registerForm.formState.errors.agreeToTerms.message}
                    </p>
                  )}
                </form>
              </TabsContent>
            </Tabs>
            
            {/* <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div> */}
            
          {/*  <div className="grid grid-cols-2 gap-4">
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
            </div> */}
          </div>
        </div>

        {/* Right Side - Image */}
        <div className="hidden lg:block lg:w-1/2 relative">
          <div className="absolute inset-0 bg-black">
            <img 
              src={loginImage} 
              alt="Tennis match" 
              className="w-full h-full object-cover object-[50%_0%] opacity-80"
            />
            <div className="absolute inset-0 bg-linear-to-l from-transparent via-black/20 to-black/80" />
            
            <div className="absolute bottom-16 left-12 right-12 text-white">
              <blockquote className="text-2xl font-display font-bold leading-relaxed mb-6">
                "Tennis is more than a game. It's friendship, community and a sense of belonging. I created TennisConnect to help players across Sydney find their people through tennis."
              </blockquote>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                  TC
                </div>
                <div>
                  <div className="font-bold">Nataliia Petrychuk</div>
                  <div className="text-primary text-sm">Founder, TennisConnect</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
