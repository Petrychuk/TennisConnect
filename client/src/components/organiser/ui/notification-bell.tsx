import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useUnreadMessagesCount } from "@/hooks/use-unread-messages";

interface NotificationBellProps {
  testId?: string;
  className?: string;
}

// Used across the Organiser Hub's various header bars - links to the
// Hub's own embedded Messages page and shows the real unread count
// (or nothing at all, once there genuinely isn't one) instead of an
// indicator that was always on regardless of whether there was
// actually anything new.
export function NotificationBell({ testId = "organiser-header-bell", className }: NotificationBellProps) {
  const unreadCount = useUnreadMessagesCount();

  return (
    <Button variant="ghost" size="icon" className={className ?? "relative"} asChild data-testid={testId}>
      <Link href="/organiser/messages">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
