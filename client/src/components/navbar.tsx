import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Menu,
  LogOut,
  User,
  Bell,
  Mail,
  UserCircle,
  ShieldCheck,
  Settings,
  Trash2,
  AlertTriangle,
  Home,
  MoreHorizontal,
  Users,
  Award,
  Building2,
  Plane,
  BookOpen,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  
  const { toast } = useToast();

  const showMobileBottomNav = isAuthenticated && location !== "/auth";

  // Reserve space at the bottom of every page on mobile so content/footer
  // never sits underneath the fixed mobile bottom nav.
  useEffect(() => {
    document.body.classList.toggle("has-mobile-bottom-nav", showMobileBottomNav);
    return () => document.body.classList.remove("has-mobile-bottom-nav");
  }, [showMobileBottomNav]);

  const profileHref =
  user?.role && user?.slug
    ? `/${user.role}/${user.slug}`
    : "/";

    useEffect(() => {
      if (!user?.id) return;
    
      fetchUnreadCount();
    
      const interval = setInterval(
        fetchUnreadCount,
        30000
      );
    
      return () => clearInterval(interval);
    }, [user?.id]);

    const fetchUnreadCount = async () => {
      console.log("user:", user);
      console.log("user id:", user?.id);
    
      try {
        const res = await fetch(
          "/api/messages/unread-count",
          {
            credentials: "include",
          }
        );
    
        console.log("status:", res.status);
    
        if (res.status === 401) {
          console.log("Unauthorized request");
          return;
        }
    
        const data = await res.json();
        setUnreadCount(data.count);
      } catch (err) {
        console.error(err);
      }
    };

  const navLinks = [
    { name: "Players", href: "/partners", icon: Users },
    { name: "Coaches", href: "/coaches", icon: Award },
    /* { name: "Tournaments", href: "/tournaments" }, */
    { name: "Club Communities", href: "/clubs", icon: Building2 },
    { name: "Travels", href: "/travel", icon: Plane },
    { name: "Tennis IQ", href: "/articles", icon: BookOpen },
    /* { name: "Recreation", href: "/recreation" },
    { name: "Marketplace", href: "/marketplace" }, 
    { name: "Shop", href: "https://shop.tennisconnect.com.au", external: true }, */
  ];

  if (location === "/auth") return null;

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-2xl font-display font-bold flex items-center gap-1 cursor-pointer">
          Tennis<span className="text-[hsl(var(--tennis-ball))]">Connect</span>
          <div className="w-2 h-2 rounded-full bg-[hsl(var(--tennis-ball))] mt-1 animate-pulse" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
           /*  link.external ? (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:text-lime-600 transition-colors cursor-pointer flex items-center gap-1"
              >
                {link.name}
                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm font-medium hover:text-lime-600 transition-colors cursor-pointer"
              >
                {link.name}
              </Link> ) */
              <Link
              key={link.name}
              href={link.href}
              className={`text-sm font-medium transition-colors cursor-pointer relative ${
                location.startsWith(link.href)
                  ? "text-primary font-bold"
                  : "hover:text-lime-600"
              }`}
            >
              {link.name}
              {location.startsWith(link.href) && (
                <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-primary" />
              )}
            </Link>  
          ))}
        </div>

        {/* CTA & Mobile Menu */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="hidden md:flex items-center gap-2">
              {/* Notifications Bell */}
              <Link href="/messages">
                <Button variant="ghost" size="icon" className="relative cursor-pointer" data-testid="button-notifications">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-red-500 text-white border-2 border-background"
                      data-testid="badge-unread-count"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>

              <Link href={profileHref}>
                <Button variant="ghost" className="font-bold hover:text-lime-600 gap-2 cursor-pointer">
                  <User className="w-4 h-4" />
                  {user?.name || "My Profile"}
                </Button>
              </Link>
            
              <DropdownMenu>
                <DropdownMenuTrigger  asChild>
                  <Avatar
                    data-testid="profile-menu"
                    key={user?.avatar} 
                    className="h-9 w-9 cursor-pointer border-2 border-primary/20 hover:border-primary transition-colors">
                    <AvatarImage src={user?.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {user?.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href={profileHref}><UserCircle className="h-4 w-4" />Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/messages" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Messages
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">
                          {unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  {user?.isAdmin && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/admin" className="flex items-center gap-2" data-testid="navbar-admin-link">
                        <ShieldCheck className="w-4 h-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user?.isOrganizer && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/organiser/hub" className="flex items-center gap-2" data-testid="navbar-organiser-hub-link">
                        <Trophy className="w-4 h-4" />
                        Organiser Hub
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    data-testid="logout-btn"
                    className="text-destructive focus:text-destructive cursor-pointer" 
                    onClick={async () => {
                      await logout();
                      setLocation("/");
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => setDeleteDialogOpen(true)}
                    data-testid="navbar-delete-account"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link href="/auth">
              <Button className="hidden md:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer">
                Sign In
              </Button>
            </Link>
          )}

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col p-0">
              <div className="flex flex-col gap-1 px-6 pt-8 pb-4 overflow-y-auto">
                {isAuthenticated && (
                   <div className="flex items-center gap-3 pb-6" data-testid="drawer-user-summary">
                     <Avatar key={user?.avatar} className="h-11 w-11 border-2 border-primary/20">
                        <AvatarImage src={user?.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{user?.name?.[0] || "U"}</AvatarFallback>
                     </Avatar>
                     <div>
                       <p className="font-bold leading-tight">{user?.name}</p>
                       <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
                     </div>
                   </div>
                )}

                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--tennis-ball))] mb-1 px-3">
                  Explore
                </p>
                <nav className="flex flex-col">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const active = location === link.href;
                    return (
                      <Link
                        key={link.name}
                        href={link.href}
                        data-testid={`drawer-link-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        {link.name}
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    );
                  })}
                </nav>

                {isAuthenticated ? (
                  <>
                    <div className="border-t border-border mt-4 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--tennis-ball))] mb-1 px-3">
                        Account
                      </p>
                      <p className="text-xs text-muted-foreground px-3 pb-2">
                        Messages, profile and sign out are in the menu bar below.
                      </p>
                      <button
                        type="button"
                        data-testid="drawer-delete-account"
                        onClick={() => {
                          setDeleteDialogOpen(true);
                          setIsOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </button>
                    </div>
                  </>
                ) : (
                  <Link href="/auth" onClick={() => setIsOpen(false)}>
                    <Button className="w-full mt-4 bg-primary text-primary-foreground font-bold rounded-full cursor-pointer">
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!deleting) {
            setDeleteDialogOpen(open);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md p-5">
    <DialogHeader>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>

      <DialogTitle className="text-center">
        Delete Account
      </DialogTitle>

      <DialogDescription asChild>
        <div className="text-center space-y-2 text-sm text-muted-foreground">
          <p>
            This action is permanent and cannot be undone.
          </p>

          <p>
            Your TennisConnect profile, messages,
            marketplace listings, tournament history
            and account information will be permanently removed.
          </p>

          <p>
            You will no longer appear in the Players
            or Coaches directory.
          </p>
        </div>
      </DialogDescription>
    </DialogHeader>

    <div className="flex items-center justify-center gap-2 py-2">
      <Checkbox
        id="confirm-delete"
        checked={confirmDelete}
        onCheckedChange={(checked) =>
          setConfirmDelete(checked === true)
        }
      />

      <label
        htmlFor="confirm-delete"
        className="text-sm leading-relaxed cursor-pointer"
      >
        I understand that this action cannot be undone.
      </label>
    </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setConfirmDelete(false);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              disabled={!confirmDelete || deleting}
              onClick={async () => {
                try {
                  setDeleting(true);

                  const response = await fetch(
                    "/api/me/account",
                    {
                      method: "DELETE",
                      credentials: "include",
                    }
                  );

                  if (!response.ok) {
                    throw new Error(
                      "Failed to delete account"
                    );
                  }

                  toast({
                    title: "Account deleted",
                    description:
                      "Your account has been permanently removed.",
                  });

                  await logout();

                  window.location.href = "/";
                } catch (error) {
                  toast({
                    title: "Error",
                    description:
                      "Failed to delete account.",
                    variant: "destructive",
                  });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />

              {deleting
                ? "Deleting..."
                : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>

    {/* Mobile bottom nav — logged-in account management lives here now (mobile only) */}
    {showMobileBottomNav && (
      <nav
        data-testid="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border/60 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16">
          <Link
            href="/"
            data-testid="mobile-bottomnav-home"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              location === "/" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Home className={`w-5 h-5 ${location === "/" ? "fill-primary/15" : ""}`} />
            Home
          </Link>

          <Link
            href="/messages"
            data-testid="mobile-bottomnav-messages"
            className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              location === "/messages" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span className="relative">
              <Mail className="w-5 h-5" />
              {unreadCount > 0 && (
                <Badge
                  data-testid="mobile-bottomnav-messages-badge"
                  className="absolute -top-1.5 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[9px] bg-red-500 text-white border-2 border-background"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </span>
            Messages
          </Link>

          <Link
            href={profileHref}
            data-testid="mobile-bottomnav-profile"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              location === profileHref ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <UserCircle className={`w-5 h-5 ${location === profileHref ? "fill-primary/15" : ""}`} />
            Profile
          </Link>

          <Link
            href="/messages"
            data-testid="mobile-bottomnav-notifications"
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors"
          >
            <span className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 border border-background" />
              )}
            </span>
            Notifications
          </Link>

          <button
            type="button"
            data-testid="mobile-bottomnav-more"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
            More
          </button>
        </div>
      </nav>
    )}

    {/* More sheet — account actions moved out of the hamburger drawer */}
    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
      <SheetContent side="bottom" className="md:hidden rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="mobile-more-sheet">
        <div className="flex items-center gap-3 pb-4 pt-2">
          <Avatar key={user?.avatar} className="h-11 w-11 border-2 border-primary/20">
            <AvatarImage src={user?.avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {user?.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold leading-tight">{user?.name}</p>
            <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-border pt-3">
          {user?.isAdmin && (
            <Link
              href="/admin"
              data-testid="mobile-more-admin-link"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
              onClick={() => setMoreOpen(false)}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Panel
            </Link>
          )}

          {user?.isOrganizer && (
            <Link
              href="/organiser/hub"
              data-testid="mobile-more-organiser-hub-link"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
              onClick={() => setMoreOpen(false)}
            >
              <Trophy className="w-4 h-4" />
              Organiser Hub
            </Link>
          )}

          <button
            type="button"
            data-testid="mobile-more-settings"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground cursor-default"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>

          <div className="border-t border-border my-1" />

          <button
            type="button"
            data-testid="mobile-logout-btn"
            onClick={async () => {
              setMoreOpen(false);
              await logout();
              setLocation("/");
            }}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
