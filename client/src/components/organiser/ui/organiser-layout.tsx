import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/seo";
import { DelayedTennisLoader } from "@/components/ui/tennisLoader";
import { useAuth } from "@/lib/auth-context";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { OrganiserSidebarNav } from "./organiser-sidebar";
import { OrganiserMobileNav } from "./organiser-mobile-nav";
import { OrganiserBarLogo } from "./organiser-bar-logo";
import { NotificationBell } from "./notification-bell";
import type { OrganiserUser } from "@/lib/organiser-types";

/*
  One shell for every Organiser Hub page (Phase 2, Batch 1).

  Before, each of the 17 pages repeated the access check, the sidebar, the
  tablet/phone bar and the bottom nav (~60 lines each), and redirected
  guests by calling setLocation() during render. Several pages had no
  "organiser only" check at all, and most refused admins although the API
  lets them in. Now:

  - OrganiserAccessGate: the same rule as the API's requireOrganizer
    (isOrganizer || isAdmin). Guests are sent to /auth (with returnTo) from
    an effect, never during render.
  - useOrganiserIdentity: the signed-in user's real name, avatar and role -
    no more mock "Organiser" / mock organisation fallbacks.
  - OrganiserLayout: gate + sidebar + compact bar + bottom nav. Pages keep
    their own content, breadcrumb and headings.
*/

export function organiserRoleLabel(user: { isOrganizer?: boolean | null; isAdmin?: boolean | null }): string {
  if (user.isAdmin && user.isOrganizer) return "Organiser · Admin";
  if (user.isAdmin) return "Admin";
  return "Organiser";
}

/** The signed-in organiser as the Hub chrome shows them. */
export function useOrganiserIdentity(): { organiser: OrganiserUser; profileHref: string } {
  const { user } = useAuth();
  return {
    organiser: {
      name: user?.name ?? "",
      avatar: user?.avatar ?? null,
      role: user ? organiserRoleLabel(user) : "Organiser",
      isAdmin: !!user?.isAdmin,
    },
    profileHref: user ? `/${user.role}/${user.slug}` : "/",
  };
}

export function canUseOrganiserHub(user: { isOrganizer?: boolean | null; isAdmin?: boolean | null } | null | undefined): boolean {
  return !!user && (!!user.isOrganizer || !!user.isAdmin);
}

/** Loader while auth resolves; /auth for guests; an explanation for non-organisers. */
export function OrganiserAccessGate({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation(`/auth?returnTo=${encodeURIComponent(location)}`);
    }
  }, [loading, isAuthenticated, location, setLocation]);

  if (loading || !isAuthenticated) {
    return <DelayedTennisLoader text="Loading Organiser Hub…" />;
  }

  if (!canUseOrganiserHub(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background" data-testid="organiser-access-required">
        <Card className="max-w-md w-full shadow-sm">
          <CardHeader>
            <CardTitle asChild><h1>Organiser access required</h1></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              The Organiser Hub is for approved organisers. You can request organiser access from
              your profile; an admin reviews every request.
            </p>
            {user && (
              <Button asChild variant="outline">
                <Link href={`/${user.role}/${user.slug}`}>Go to my profile</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

interface OrganiserLayoutProps {
  /** data-testid of the page wrapper (kept from each page). */
  testId: string;
  seoTitle: string;
  seoDescription: string;
  /** Title shown in the tablet bar (hidden on phones, where the logo shows). */
  mobileTitle: ReactNode;
  /** Replaces the avatar link in the tablet/phone bar (the bell always stays). */
  mobileActions?: ReactNode;
  children: ReactNode;
}

export function OrganiserLayout(props: OrganiserLayoutProps) {
  return (
    <OrganiserAccessGate>
      <OrganiserShell {...props} />
    </OrganiserAccessGate>
  );
}

function OrganiserShell({ testId, seoTitle, seoDescription, mobileTitle, mobileActions, children }: OrganiserLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const { organiser, profileHref } = useOrganiserIdentity();

  return (
    <div className="min-h-screen flex bg-background" data-testid={testId}>
      <SEO title={seoTitle} description={seoDescription} noIndex />

      <aside className={cn("hidden xl:flex shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-200", sidebarCollapsed ? "xl:w-20" : "xl:w-72")}>
        <OrganiserSidebarNav
          organiser={organiser}
          profileHref={profileHref}
          className="w-full"
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>

      {/* <aside> and <OrganiserMobileNav /> stay siblings of <main>, not
          children - the same landmarks the public site has. */}
      <main id="main-content" className="flex-1 min-w-0 pb-16 md:pb-0">
        {/* Compact bar - tablet & mobile */}
        <div className="flex xl:hidden items-center justify-between px-4 h-14 border-b border-border bg-card">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Open Organiser Hub menu" data-testid="organiser-sidebar-trigger">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Organiser Hub navigation</SheetTitle>
              <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} />
            </SheetContent>
          </Sheet>
          <OrganiserBarLogo />

          <div className="hidden md:flex mr-auto items-center gap-1.5 font-display font-bold">{mobileTitle}</div>

          <div className="flex items-center gap-1">
            <NotificationBell testId="organiser-header-bell-mobile" />
            {mobileActions ?? (
              <Link href={profileHref} aria-label="My profile">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage src={organiser.avatar || undefined} alt="" />
                  <AvatarFallback className="bg-primary/10 text-primary-text font-bold text-xs">
                    {organiser.name[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}
          </div>
        </div>

        {children}
      </main>

      <OrganiserMobileNav />
    </div>
  );
}
