import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth";
import CoachProfile from "@/pages/coach-profile";
import PlayerProfile from "@/pages/player-profile";
import PlayerRegistration from "@/pages/player-registration";
import CoachesPage from "@/pages/coaches";
import MarketplacePage from "@/pages/marketplace";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/player/register" component={PlayerRegistration} />
      <Route path="/player/profile" component={PlayerProfile} />
      <Route path="/player/:id" component={PlayerProfile} />
      <Route path="/coaches" component={CoachesPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/coach/profile" component={CoachProfile} />
      <Route path="/coach/:id" component={CoachProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

import { SupportChat } from "@/components/support-chat";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <SupportChat />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
