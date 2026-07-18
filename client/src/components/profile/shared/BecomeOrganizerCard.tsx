import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { OrganizerStatusData } from "@/hooks/use-organizer-status";

interface BecomeOrganizerCardProps {
  status: OrganizerStatusData;
  onChange: (status: OrganizerStatusData) => void;
}

// Shown on a player's/coach's own profile. If they already checked
// "I want to organize tennis sessions" at sign-up (or requested since),
// `status.request` is non-null and this shows the Pending/Rejected state
// instead of the button — the button only ever appears when no request
// exists yet, so it's never redundant with the sign-up checkbox.
export function BecomeOrganizerCard({ status, onChange }: BecomeOrganizerCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  async function handleBecomeOrganizer() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/organizer/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Something went wrong");
      }
      onChange({ isOrganizer: false, request: json });
      toast({
        title: "Request sent",
        description: "We'll let you know once an admin reviews your request.",
      });
    } catch (error: any) {
      toast({
        title: "Could not send request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card data-testid="become-organizer-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Organise Tennis Sessions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status.isOrganizer ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-2 text-sm" data-testid="organizer-status-approved">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              You're an approved organiser.
            </div>
            <Button asChild size="sm" data-testid="go-to-organizer-dashboard">
              <Link href="/organizer/dashboard">Open Organiser Hub</Link>
            </Button>
          </div>
        ) : status.request?.status === "pending" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="organizer-request-pending">
            <Clock className="w-4 h-4" />
            Your organiser request is awaiting review.
            <Badge variant="secondary">Pending</Badge>
          </div>
        ) : status.request?.status === "rejected" ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="organizer-request-rejected">
              <XCircle className="w-4 h-4" />
              Your last request was not approved.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBecomeOrganizer}
              disabled={submitting}
              data-testid="become-organizer-button"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request Again
            </Button>
          </div>
        ) : status.request?.status === "revoked" ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="organizer-request-revoked">
              <XCircle className="w-4 h-4" />
              Your organiser access was revoked.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBecomeOrganizer}
              disabled={submitting}
              data-testid="become-organizer-button"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request Again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-sm text-muted-foreground">
              Run your own social hits, round robins, or clinics on TennisConnect.
            </p>
            <Button
              onClick={handleBecomeOrganizer}
              disabled={submitting}
              data-testid="become-organizer-button"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Become an Organiser
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
