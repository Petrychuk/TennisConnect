import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Globe, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";
import {
  TravelDetailContent,
  type TravelPackage,
} from "@/components/travel/TravelDetailContent";

export default function AdminTravelPreviewPage() {
  const [, params] = useRoute("/admin/travel/:slug/preview");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isAdmin = !!user?.isAdmin;

  const [pkg, setPkg] = useState<TravelPackage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!params?.slug || !isAdmin) return;
    window.scrollTo(0, 0);
    fetch(`/api/travel/${params.slug}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPkg)
      .catch(() => setNotFound(true));
  }, [params?.slug, isAdmin]);

  const toggleStatus = async () => {
    if (!pkg) return;
    setUpdating(true);
    try {
      const endpoint = pkg.isActive ? "unpublish" : "publish";
      const res = await fetch(`/api/admin/travel/${pkg.id}/${endpoint}`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update status");

      const updated = await res.json();
      setPkg(updated);

      toast({
        title: updated.isActive ? "Package Published" : "Package Hidden",
        description: updated.title,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: e.message,
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleEdit = () => {
    if (!pkg) return;
    setLocation(`/admin?tab=travel&editTravel=${pkg.id}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-background font-sans flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 pt-24 md:pt-28 pb-8">
          <div className="text-center max-w-md">
            <ShieldCheck className="w-12 h-12 md:w-14 md:h-14 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl md:text-2xl font-bold mb-2">
              Admin Access Required
            </h2>
            <p className="text-sm md:text-base text-muted-foreground">
              {isAuthenticated
                ? "You don't have admin privileges."
                : "Please sign in with an admin account."}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Package not found</h1>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => setLocation("/admin?tab=travel")}
            >
              Back to Admin
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`Preview: ${pkg.title} | TennisConnect Admin`}
        description={pkg.metaDescription || pkg.description}
        canonical={`/admin/travel/${pkg.slug}/preview`}
        noIndex
      />
      <div className="min-h-screen bg-background font-sans">
        <Navbar />

        {/* Admin preview control bar */}
        <div
          className="sticky top-16 z-40 bg-primary/10 border-b border-primary/20 backdrop-blur-lg"
          data-testid="travel-admin-preview-bar"
        >
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge variant={pkg.isActive ? "default" : "outline"}>
                {pkg.isActive ? "Published" : "Hidden"}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {pkg.isActive
                  ? "This package is live on the public Travel page."
                  : "Preview only — not visible to the public yet."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/admin?tab=travel")}
                data-testid="travel-admin-preview-back-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Admin
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                data-testid="travel-admin-preview-edit-btn"
              >
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>

              <Button
                size="sm"
                onClick={toggleStatus}
                disabled={updating}
                data-testid="travel-admin-preview-publish-btn"
              >
                <Globe className="w-4 h-4 mr-1" />
                {pkg.isActive ? "Hide" : "Publish"}
              </Button>
            </div>
          </div>
        </div>

        <TravelDetailContent pkg={pkg} />

        <Footer />
      </div>
    </>
  );
}
