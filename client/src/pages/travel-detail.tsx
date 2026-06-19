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
import { TravelGallery } from "@/components/travel/travel-gallery";
import { TravelAbout } from "@/components/travel/travel-about";
import { TravelFullExperience } from "@/components/travel/travel-full-experience";
import { TravelWhatsIncluded } from "@/components/travel/travel-whats-included";
import { TravelPriceCard } from "@/components/travel/travel-price-card";
import { TravelProviderCard } from "@/components/travel/travel-provider-card";

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
       <SEO
        title={
          pkg.seoTitle ||
          `${pkg.title} | Tennis Travel | TennisConnect`
        }
        description={
          pkg.metaDescription ||
          pkg.description
        }
        canonical={`/travel/${pkg.slug}`}
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
          <div className="container mx-auto px-4 pt-4 md:pt-6 pb-10">
            <div className="grid lg:grid-cols-4 gap-10">

              <div className="lg:col-span-3">
                
                <TravelAbout
                  description={pkg.description}
                />
                <div className="lg:hidden container mx-auto px-4 -mt-0 mb-4">
                  <TravelPriceCard
                    price={pkg.price}
                    currency={pkg.currency}
                    duration={pkg.duration}
                    startDate={pkg.startDate}
                    spotsLeft={pkg.spotsLeft}
                    ctaText={pkg.ctaText}
                    ctaUrl={pkg.ctaUrl}
                  />
                </div>
                <TravelGallery
                  images={pkg.gallery?.length
                    ? pkg.gallery
                    : [pkg.coverImage]
                  }
                />
              
              <TravelFullExperience
                content={pkg.content}
              />
               <TravelWhatsIncluded
                  includes={pkg.includes}
                />
              </div>
              
              <div className="lg:hidden mt-8">
                <TravelProviderCard
                  providerName={pkg.providerName}
                  providerLogo={pkg.providerLogo}
                  providerWebsite={pkg.providerWebsite}
                />
              </div>

            {/* RIGHT */}

              <div className="hidden lg:block">
                <div className="sticky top-24 space-y-6">

                  <TravelPriceCard
                    price={pkg.price}
                    currency={pkg.currency}
                    duration={pkg.duration}
                    startDate={pkg.startDate}
                    spotsLeft={pkg.spotsLeft}
                    ctaText={pkg.ctaText}
                    ctaUrl={pkg.ctaUrl}
                  />
                  <TravelProviderCard
                    providerName={pkg.providerName}
                    providerLogo={pkg.providerLogo}
                    providerWebsite={pkg.providerWebsite}
                  />

                </div>
              </div>             
            </div>
          </div>

        <Footer />
      </div>
    </>
  );
}
