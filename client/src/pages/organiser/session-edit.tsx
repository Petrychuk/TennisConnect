import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";
import { getSessionById } from "@/lib/api/organizer-sessions";

// Foundation only. The brief calls for the same multi-step wizard used to
// create a session, just pre-filled - that wizard isn't part of this
// module yet, so this route exists (so Edit/Continue Setup go somewhere
// real) without pretending the wizard itself is built.
export default function OrganiserSessionEditPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/:id/edit");
  const sessionQuery = useQuery({
    queryKey: ["/api/organizer/sessions", params?.id],
    queryFn: () => getSessionById(params!.id),
    enabled: !!params?.id,
  });

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardHeader>
            <CardTitle>Organiser access required</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            You need to be an approved organiser to view this page. Head to your profile to
            request organiser access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = sessionQuery.data;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background" data-testid="organiser-session-edit">
      <SEO title="Edit Session | Organiser Hub | TennisConnect" description="Edit your session's details." noIndex />
      <Card className="max-w-md w-full shadow-sm">
        <CardHeader>
          <CardTitle>Edit Wizard — coming soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {session ? `Editing "${session.title}" ` : "This session "}
            will open the same step-by-step wizard used to create a
            session, pre-filled with its current details. That wizard isn't
            built yet — this page is the foundation for it.
          </p>
          <Button asChild variant="outline" data-testid="organiser-session-edit-back">
            <Link href={params?.id ? `/organiser/sessions/${params.id}` : "/organiser/sessions"}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
