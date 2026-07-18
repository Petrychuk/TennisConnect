import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ScrollToTop } from "@/components/scroll-to-top";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth";
import ResetPasswordPage from "@/pages/reset-password";
import CoachProfile from "@/pages/coach-profile";
import PlayerProfile from "@/pages/player-profile";
import PlayerRegistration from "@/pages/player-registration";
import CoachesPage from "@/pages/coaches";
import MarketplacePage from "@/pages/marketplace";
import ClubsPage from "@/pages/clubs";
import ClubDetailPage from "@/pages/club-detail";
import PartnersPage from "@/pages/partners";
import TournamentsPage from "@/pages/tournaments";
import MessagesPage from "@/pages/messages";
import CompleteProfilePage from "@/pages/complete-profile";
import ArticlesPage from "@/pages/articles";
import ArticleDetailPage from "@/pages/article-detail";
import TravelPage from "@/pages/travel";
import TravelDetailPage from "@/pages/travel-detail";
import RecreationPage from "@/pages/recreation";
import RecreationDetailPage from "@/pages/recreation-detail";
import AdminPage from "@/pages/admin";
import AdminTravelPreviewPage from "@/pages/admin-travel-preview";
import AdminArticlePreviewPage from "@/pages/admin-article-preview";
import OrganizerDashboardPage from "@/pages/organizer-dashboard";
import OrganizationDetailPage from "@/pages/organization-detail";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/complete-profile" component={CompleteProfilePage} />
      <Route path="/player/register" component={PlayerRegistration} />
      <Route path="/player/profile" component={PlayerProfile} />
      <Route path="/player/:id" component={PlayerProfile} />
      <Route path="/coaches" component={CoachesPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/clubs" component={ClubsPage} />
      <Route path="/clubs/:slug" component={ClubDetailPage} />
      <Route path="/partners" component={PartnersPage} />
      <Route path="/tournaments" component={TournamentsPage} />
      <Route path="/articles" component={ArticlesPage} />
      <Route path="/articles/:slug" component={ArticleDetailPage} />
      <Route path="/travel" component={TravelPage} />
      <Route path="/travel/:slug" component={TravelDetailPage} />
      <Route path="/recreation" component={RecreationPage} />
      <Route path="/recreation/:slug" component={RecreationDetailPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/travel/:slug/preview" component={AdminTravelPreviewPage} />
      <Route path="/admin/articles/:slug/preview" component={AdminArticlePreviewPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/coach/profile" component={CoachProfile} />
      <Route path="/coach/:id" component={CoachProfile} />
      <Route path="/organiser/hub" component={OrganizerDashboardPage} />
      <Route path="/organizations/:slug" component={OrganizationDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

import { SupportChat } from "@/components/support-chat";
import { CookieConsentManager } from "@/components/cookie-consent/CookieConsentManager";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <ScrollToTop />
          <Router />
          <SupportChat />
          <CookieConsentManager />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
