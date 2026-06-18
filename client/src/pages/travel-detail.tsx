import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Calendar, Users, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";
import { TravelHero } from "@/components/travel/travel-hero";
import TravelHighlights from "@/components/travel/travel-highlights";

interface TravelPackage {
  id: string;
  slug: string;
  title: string;
  destination: string;
  duration: string;
  price: number;
  currency: string;
  description: string;
  content?: string;
  highlights?: string[];
  includes?: string[];
  coverImage: string;
  gallery?: string[];
  startDate: string | null;
  spotsLeft: number;
  providerName?: string;
  providerWebsite?: string;
  providerLogo?: string;
  ctaText?: string;
  ctaUrl?: string;
  tags?: string[];
  seoTitle?: string;
  metaDescription?: string;
  isFeatured: boolean;
  isActive?: boolean;
}

export default function TravelDetailPage() {
  const [, params] = useRoute("/travel/:slug");
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

  const handleBook = () => {
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
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Package not found</h1>
            <Link href="/travel">
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

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "TBA";

  return (
    <>
      {/* <SEO !not done yet
        title={`${travelPackage.title} | Tennis Travel | TennisConnect`}
        description={
          travelPackage.description ||
          "Tennis travel package."
        }
        canonical={`/travel/${travelPackage.slug}`}
        tags={[
          "tennis travel",
          "tennis holiday",
          "tennis camp",
          "Australia",
        ]}
      /> */}
      <div className="min-h-screen bg-background font-sans">
        <Navbar />

        <TravelHero
          title={pkg.title}
          destination={pkg.destination}
          startDate={pkg.startDate}
          coverImage={pkg.coverImage}
          providerName={pkg.providerName}
          isFeatured={pkg.isFeatured}
        /> 
        <TravelHighlights
          highlights={pkg.highlights}
        />

        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-display font-bold mb-4">About this trip</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{pkg.description}</p>

              {pkg.highlights && pkg.highlights.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4">Highlights</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pkg.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pkg.includes && pkg.includes.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">What's included</h3>
                  <ul className="space-y-2">
                    {pkg.includes.map((i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <div className="sticky top-24 bg-linear-to-br from-primary/10 to-primary/5 rounded-3xl p-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Starts at</p>
                <p className="text-4xl font-display font-bold mb-1">
                  ${pkg.price}
                  <span className="text-base text-muted-foreground font-normal ml-1">{pkg.currency}</span>
                </p>
                <p className="text-sm text-muted-foreground mb-6">per person</p>

                <div className="space-y-3 mb-6 text-sm border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-bold">{pkg.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start date</span>
                    <span className="font-bold">{formatDate(pkg.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spots left</span>
                    <span className={`font-bold ${pkg.spotsLeft <= 5 ? "text-red-500" : ""}`}>
                      {pkg.spotsLeft}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleBook}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full cursor-pointer"
                  data-testid="travel-reserve-button"
                >
                  Reserve My Spot
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
