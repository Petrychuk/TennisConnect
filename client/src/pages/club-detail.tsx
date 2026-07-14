import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Skeleton } from "@/components/ui/skeleton";
import SEO from "@/components/seo";
import { getClubVariant } from "@/lib/clubVariant";
import { ClubDetailHero } from "@/components/clubs/detail/ClubDetailHero";
import { ClubContactCard } from "@/components/clubs/detail/ClubContactCard";
import { CourtsSection } from "@/components/clubs/detail/CourtsSection";
import { CompanySection } from "@/components/clubs/detail/CompanySection";
import { CommunitySection } from "@/components/clubs/detail/CommunitySection";

function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ClubDetailSkeleton() {
  return (
    <div data-testid="club-detail-skeleton">
      <Skeleton className="w-full h-64 sm:h-80 md:h-96 lg:h-[460px] rounded-none" />
      <div className="container mx-auto px-4">
        <div className="relative -mt-14 sm:-mt-16 lg:-mt-20 z-10 space-y-3 rounded-2xl border bg-background shadow-xl p-5 md:p-8">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3 pb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClubDetailPage() {
  const [, params] = useRoute("/clubs/:slug");
  const slug = params?.slug;
  const [, setLocation] = useLocation();

  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function loadClub() {
      setLoading(true);
      setNotFound(false);

      try {
        const res = await fetch(`/api/clubs/${slug}`, {
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const data = await res.json();
        if (!cancelled) setClub(data);
      } catch (err) {
        console.error("Failed to load club:", err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadClub();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (notFound) {
      setLocation("/clubs");
    }
  }, [notFound, setLocation]);

  const variant = club ? getClubVariant(club) : "courts";
  const personLabel =
    variant === "community" ? "Community Lead" : "Contact Person";

  return (
    <>
      <SEO
        title={
          club?.name
            ? `${club.name} | TennisConnect`
            : "Tennis Club | TennisConnect"
        }
        description={
          club?.shortDescription ||
          club?.description ||
          "Discover tennis clubs, courts and communities across Australia."
        }
        canonical={slug ? `/clubs/${slug}` : undefined}
      />

      <div className="min-h-screen bg-background font-sans">
        <Navbar />

        <main className="pt-16">
          {loading || !club ? (
            <ClubDetailSkeleton />
          ) : (
            <>
              <ClubDetailHero
                club={club}
                variant={variant}
                onPrimaryAction={() => scrollToSection("club-section-contact")}
                onSecondaryAction={() =>
                  scrollToSection(
                    variant === "courts"
                      ? "club-section-main"
                      : variant === "company"
                        ? "club-section-locations"
                        : "club-section-main"
                  )
                }
              />

              <div className="container mx-auto px-4 pt-3 md:pt-4 pb-8 md:pb-12">
                {variant === "community" ? (
                  <div id="club-section-main">
                    <CommunitySection
                      club={club}
                      onJoin={() => scrollToSection("club-section-contact")}
                      onViewSchedule={() =>
                        scrollToSection("club-section-main")
                      }
                    />
                  </div>
                ) : (
                  <div
                    className="grid lg:grid-cols-3 gap-6 lg:gap-8"
                    id="club-section-main"
                  >
                    <div className="lg:col-span-2">
                      {variant === "courts" && (
                        <CourtsSection
                          club={club}
                          onBookCourt={() =>
                            scrollToSection("club-section-contact")
                          }
                          onViewAllCourts={() => setLocation("/clubs")}
                        />
                      )}

                      {variant === "company" && (
                        <div id="club-section-locations">
                          <CompanySection
                            club={club}
                            onViewLocations={() =>
                              scrollToSection("club-section-locations")
                            }
                            onContactUs={() =>
                              scrollToSection("club-section-contact")
                            }
                          />
                        </div>
                      )}
                    </div>

                    <div id="club-section-contact" className="scroll-mt-20">
                      <ClubContactCard club={club} personLabel={personLabel} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
}
