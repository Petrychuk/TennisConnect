import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ScrollToTop } from "@/components/scroll-to-top";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

// Every other route is lazy - each only downloads its own JS chunk the
// moment someone actually navigates there, instead of all of them
// (including the entire Organiser Hub module, every admin panel, and
// both multi-thousand-line profile pages) being bundled into what has
// to load before the homepage can even paint. Home and NotFound stay
// eager since they're the two places almost every visit touches first.
const AuthPage = lazy(() => import("@/pages/auth"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const CoachProfile = lazy(() => import("@/pages/coach-profile"));
const PlayerProfile = lazy(() => import("@/pages/player-profile"));
const PlayerRegistration = lazy(() => import("@/pages/player-registration"));
const CoachesPage = lazy(() => import("@/pages/coaches"));
const MarketplacePage = lazy(() => import("@/pages/marketplace"));
const ClubsPage = lazy(() => import("@/pages/clubs"));
const ClubDetailPage = lazy(() => import("@/pages/club-detail"));
const PartnersPage = lazy(() => import("@/pages/partners"));
const TournamentsPage = lazy(() => import("@/pages/tournaments"));
const MessagesPage = lazy(() => import("@/pages/messages"));
const CompleteProfilePage = lazy(() => import("@/pages/complete-profile"));
const ArticlesPage = lazy(() => import("@/pages/articles"));
const ArticleDetailPage = lazy(() => import("@/pages/article-detail"));
const TravelPage = lazy(() => import("@/pages/travel"));
const TravelDetailPage = lazy(() => import("@/pages/travel-detail"));
const RecreationPage = lazy(() => import("@/pages/recreation"));
const RecreationDetailPage = lazy(() => import("@/pages/recreation-detail"));
const AdminPage = lazy(() => import("@/pages/admin"));
const AdminTravelPreviewPage = lazy(() => import("@/pages/admin-travel-preview"));
const AdminArticlePreviewPage = lazy(() => import("@/pages/admin-article-preview"));
const OrganiserDashboardPage = lazy(() => import("@/pages/organiser/organiser-dashboard"));
const OrganiserSessionsPage = lazy(() => import("@/pages/organiser/sessions"));
const OrganiserPlayersPage = lazy(() => import("@/pages/organiser/players"));
const OrganiserMessagesPage = lazy(() => import("@/pages/organiser/messages"));
const OrganiserSessionNewPage = lazy(() => import("@/pages/organiser/session-new"));
const OrganiserSessionWorkspacePage = lazy(() => import("@/pages/organiser/session-workspace"));
const OrganiserSessionLivePage = lazy(() => import("@/pages/organiser/session-live"));
// Dev-only - the lazy() import itself is fine to leave in the bundle
// (it's just a function reference), but the <Route> below only gets
// registered when import.meta.env.DEV is true, so the chunk is never
// requested - and DEV is a build-time constant Vite strips branches on
// entirely - in a production build.
const LiveSimulatorPage = lazy(() => import("@/pages/dev/live-simulator"));
const OrganiserSessionEditPage = lazy(() => import("@/pages/organiser/session-edit"));
const OrganisationDetailPage = lazy(() => import("@/pages/organisation-detail"));
const MaintenancePage = lazy(() => import("@/pages/maintenance"));

// Minimal, unobtrusive - shows only during the brief window a lazy
// chunk is downloading on navigation, not on every render.
function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" data-testid="route-loading-fallback">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
        <Route path="/maintenance" component={MaintenancePage} />
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
        <Route path="/organiser" component={OrganiserDashboardPage} />
        <Route path="/organiser/sessions" component={OrganiserSessionsPage} />
        <Route path="/organiser/sessions/new" component={OrganiserSessionNewPage} />
        <Route path="/organiser/players" component={OrganiserPlayersPage} />
        <Route path="/organiser/messages" component={OrganiserMessagesPage} />
        <Route path="/organiser/sessions/:id/live" component={OrganiserSessionLivePage} />
        <Route path="/organiser/sessions/:id/edit" component={OrganiserSessionEditPage} />
        <Route path="/organiser/sessions/:id" component={OrganiserSessionWorkspacePage} />
        <Route path="/organisations/:slug" component={OrganisationDetailPage} />
        {/* Dev-only: import.meta.env.DEV is a Vite build-time constant, so
           this branch (and the LiveSimulatorPage chunk it lazy-loads) is
           stripped out of production builds entirely, not just hidden. */}
        {import.meta.env.DEV && <Route path="/dev/live-simulator" component={LiveSimulatorPage} />}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
