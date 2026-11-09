import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { OrganiserAccessGate } from "@/components/organiser/ui/organiser-layout";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";

// Editing a template now happens in a side panel on the Templates page. This
// route stays so old links and bookmarks keep working: it just opens the panel.
function RedirectToPanel() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/templates/:id/edit");
  useEffect(() => {
    const target = params?.id ? `/organiser/sessions/templates?edit=${encodeURIComponent(params.id)}` : "/organiser/sessions/templates";
    setLocation(target, { replace: true });
  }, [params?.id, setLocation]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <TennisBallSpinner />
    </div>
  );
}

export default function OrganiserSessionTemplateEditPage() {
  return (
    <OrganiserAccessGate>
      <RedirectToPanel />
    </OrganiserAccessGate>
  );
}
