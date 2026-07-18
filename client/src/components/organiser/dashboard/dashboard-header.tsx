import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, Bell, Plus, Trophy } from "lucide-react";
import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import type { OrganiserUser } from "@/lib/organiser-hub-mock-data";

interface DashboardHeaderProps {
  organiser: OrganiserUser;
  hasUnread?: boolean;
  onCreateSession?: () => void;
}

export function DashboardHeader({ organiser, hasUnread = true, onCreateSession }: DashboardHeaderProps) {
  return (
    <div data-testid="organiser-dashboard-header">
      {/* Compact bar — tablet & mobile only, sidebar collapses behind the hamburger */}
      <div className="flex lg:hidden items-center justify-between px-4 h-14 border-b border-border bg-card">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="organiser-sidebar-trigger">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SheetTitle className="sr-only">Organiser Hub navigation</SheetTitle>
            <OrganiserSidebarNav organiser={organiser} />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1.5 font-display font-bold">
          <Trophy className="w-4 h-4 text-primary" />
          Organiser Hub
        </div>

        <div className="flex items-center gap-1">
          <Link href="/messages">
            <Button variant="ghost" size="icon" className="relative" data-testid="organiser-header-bell-mobile">
              <Bell className="w-5 h-5" />
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
              )}
            </Button>
          </Link>
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={organiser.avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {organiser.name[0]}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Desktop row — sidebar is persistent, this just holds notifications + the primary action */}
      <div className="hidden lg:flex items-center justify-end gap-3 px-8 pt-6">
        <Button variant="outline" size="icon" className="relative" asChild data-testid="organiser-header-bell-desktop">
          <Link href="/messages">
            <Bell className="w-4 h-4" />
            {hasUnread && (
              <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 justify-center" />
            )}
          </Link>
        </Button>
        <Button onClick={onCreateSession} data-testid="organiser-header-new-session">
          <Plus className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </div>
    </div>
  );
}
