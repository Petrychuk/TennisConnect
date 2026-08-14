import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";
import {
  TravelDetailContent,
  type TravelPackage,
} from "@/components/travel/TravelDetailContent";

export default function TravelDetailPage() {
  // "/travels/:slug" is canonical now; "/travel/:slug" is still routed
  // here too (old links), so this has to match either.
  const [matchesNew, paramsNew] = useRoute("/travels/:slug");
  const [, paramsOld] = useRoute("/travel/:slug");
  const params = matchesNew ? paramsNew : paramsOld;
  const [pkg, setPkg] = useState<TravelPackage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!params?.slug) return;
    window.scrollTo(0, 0);
    fetch(`/api/travel/${params.slug}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPkg)
      .catch(() => setNotFound(true));
  }, [params?.slug]);

  /* const handleBook = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Sign in to reserve your spot.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Reservation request sent!",
      description: `We'll be in touch about ${pkg?.title}.`,
    });
  }; */

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Package not found</h1>
            <Link href="/travels">
              <Button className="bg-primary text-primary-foreground">Back to packages</Button>
            </Link>
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
        title={
          pkg.seoTitle ||
          `${pkg.title} | Tennis Travel | TennisConnect`
        }
        description={
          pkg.metaDescription ||
          pkg.description
        }
        canonical={`/travels/${pkg.slug}`}
        tags={[
          "tennis travel",
          "tennis holiday",
          "tennis retreat",
          pkg.destination,
          pkg.providerName || "",
        ]}
      /> 
      <div className="min-h-screen bg-background font-sans">
        <Navbar />

        <TravelDetailContent pkg={pkg} />

        <Footer />
      </div>
    </>
  );
}
