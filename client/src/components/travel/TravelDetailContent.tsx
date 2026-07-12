import { TravelHero } from "@/components/travel/travel-hero";
import TravelHighlights from "@/components/travel/travel-highlights";
import { TravelGallery } from "@/components/travel/travel-gallery";
import { TravelAbout } from "@/components/travel/travel-about";
import { TravelFullExperience } from "@/components/travel/travel-full-experience";
import { TravelWhatsIncluded } from "@/components/travel/travel-whats-included";
import { TravelPriceCard } from "@/components/travel/travel-price-card";
import { TravelProviderCard } from "@/components/travel/travel-provider-card";

export interface TravelPackage {
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

interface TravelDetailContentProps {
  pkg: TravelPackage;
}

/**
 * The body of the Travel Package detail page (everything that sits between
 * the Navbar and the Footer). Shared by the public `/travel/:slug` page and
 * the admin `/admin/travel/:slug/preview` page so the preview is a pixel-
 * accurate representation of what will go live.
 */
export function TravelDetailContent({ pkg }: TravelDetailContentProps) {
  return (
    <>
      <TravelHero
        title={pkg.title}
        destination={pkg.destination}
        startDate={pkg.startDate}
        coverImage={pkg.coverImage}
        providerName={pkg.providerName}
        isFeatured={pkg.isFeatured}
      />
      <TravelHighlights highlights={pkg.highlights} />
      <div className="container mx-auto px-4 pt-4 md:pt-6 pb-10">
        <div className="grid lg:grid-cols-4 gap-10">
          <div className="lg:col-span-3">
            <TravelAbout description={pkg.description} />
            <div className="lg:hidden container mx-auto px-4 mt-0 mb-4">
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
              images={pkg.gallery?.length ? pkg.gallery : [pkg.coverImage]}
            />
            <TravelFullExperience content={pkg.content} />
            <TravelWhatsIncluded includes={pkg.includes} />
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
    </>
  );
}
