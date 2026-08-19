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
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <div className="container mx-auto px-4 pt-28 pb-16 max-w-4xl animate-pulse">
          <div className="h-4 w-24 bg-muted rounded mb-6" />
          <div className="h-10 w-3/4 bg-muted rounded mb-4" />
          <div className="h-4 w-1/3 bg-muted rounded mb-8" />
          <div className="h-[300px] sm:h-[380px] md:h-[460px] bg-muted rounded-2xl mb-8" />
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        </div>
        <Footer />
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
