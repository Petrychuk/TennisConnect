import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, ChevronRight, Globe, Mail, MapPin, Phone, Users } from "lucide-react";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";
import { TennisLoader } from "@/components/ui/tennisLoader";
import SEO from "@/components/seo";
import { formatInTimeZone } from "@/lib/timezone";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { cn } from "@/lib/utils";

/*
  An organisation's public page ("View Public Page" in the Organiser Hub):
  who they are, how to reach them, and their upcoming sessions. Each session
  opens its own public page (/play/:id) - the one place a session is viewed,
  joined and shared - so there are no separate Join buttons here.

  Before: the heading sat under the fixed site navbar, and each card printed
  the session's whole description (rules and all), which made the page one
  long, broken-looking column.
*/

interface SessionWithDetails {
  id: string;
  title: string;
  description: string | null;
  type: string;
  location: string | null;
  timeZone: string;
  startAt: string;
  endAt?: string | null;
  coverImage?: string | null;
  skillLevel?: string | null;
  price: string | null;
  currency: string;
  maxParticipants: number | null;
  spotsLeft: number | null;
  registeredCount: number;
  waitlistedCount: number;
  viewerRegistrationStatus: "registered" | "waitlisted" | "cancelled" | null;
}

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  cover: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  upcomingSessions: SessionWithDetails[];
}

const typeLabel = (type: string) => SESSION_TYPE_OPTIONS.find((t) => t.key === type)?.label ?? type.replace(/-/g, " ");
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export default function OrganisationDetailPage() {
  const [, params] = useRoute("/organisations/:slug");
  const slug = params?.slug;

  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullAbout, setShowFullAbout] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/organizer/organizations/${slug}`, { credentials: "include" })
      .then(async (res) => (res.ok ? ((await res.json()) as OrganizationDetail) : null))
      .catch(() => null)
      .then((org) => {
        if (!cancelled) {
          setOrganization(org);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <TennisLoader />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main id="main-content" className="flex-1 flex items-center justify-center pt-20 text-muted-foreground">
          Organization not found.
        </main>
        <Footer />
      </div>
    );
  }

  const about = organization.description?.trim() ?? "";
  const longAbout = about.length > 320;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={`${organization.name} | TennisConnect`}
        description={organization.description || `Play with ${organization.name} on TennisConnect.`}
        image={organization.cover && /^https:\/\//.test(organization.cover) ? organization.cover : undefined}
      />
      <Navbar />

      <main id="main-content" className="flex-1 w-full max-w-6xl mx-auto px-4 pt-20 sm:pt-24 pb-12 space-y-8">
        {/* ---------- Banner: cover (or the standard court photo), logo, name ---------- */}
        <section className="relative overflow-hidden rounded-3xl bg-muted" data-testid="organization-hero">
          <img src={organization.cover || courtImage} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" aria-hidden />
          <div className="relative flex min-h-[13rem] sm:min-h-[16rem] flex-col justify-end gap-3 p-5 sm:p-7 text-white sm:flex-row sm:items-end">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 border-4 border-white/80 shadow-lg">
              {organization.logo && <AvatarImage src={organization.logo} alt="" />}
              <AvatarFallback className="bg-primary text-foreground text-xl font-bold">{initials(organization.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Organiser</p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight break-words" data-testid="organization-name">
                {organization.name}
              </h1>
              <p className="mt-1 text-sm text-white/85">
                {organization.upcomingSessions.length === 0
                  ? "No upcoming sessions"
                  : `${organization.upcomingSessions.length} upcoming session${organization.upcomingSessions.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
        </section>

        {(about || organization.website || organization.email || organization.phone) && (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            {about ? (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="font-semibold mb-2">About</h2>
                <p className={cn("text-sm text-muted-foreground whitespace-pre-line", longAbout && !showFullAbout && "line-clamp-5")} data-testid="organization-about">
                  {about}
                </p>
                {longAbout && (
                  <button type="button" className="mt-1 text-sm font-medium text-primary-text hover:underline" onClick={() => setShowFullAbout((v) => !v)}>
                    {showFullAbout ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            ) : (
              <div className="hidden lg:block" />
            )}
            <OrganizationContacts organization={organization} />
          </section>
        )}

        {/* ---------- Upcoming sessions ---------- */}
        <section>
          <h2 className="font-display text-2xl font-bold mb-4">Upcoming Sessions</h2>

          {organization.upcomingSessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground" data-testid="upcoming-sessions-empty">
              No upcoming sessions right now - check back soon.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organization.upcomingSessions.map((session) => {
                const isFull = session.spotsLeft !== null && session.spotsLeft <= 0;
                const mine = session.viewerRegistrationStatus === "registered" || session.viewerRegistrationStatus === "waitlisted";
                const price = session.price && Number(session.price) > 0 ? `${session.currency} ${Number(session.price).toFixed(2)}` : "Free";
                return (
                  <Link
                    key={session.id}
                    href={`/play/${session.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`session-card-${session.id}`}
                  >
                    <div className="relative h-32 overflow-hidden bg-muted">
                      <img src={session.coverImage || courtImage} alt="" aria-hidden className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <Badge className="absolute left-3 top-3 bg-white text-foreground hover:bg-white">{typeLabel(session.type)}</Badge>
                      {mine && (
                        <Badge className="absolute right-3 top-3 bg-green-100 text-green-700" data-testid={`session-card-${session.id}-mine`}>
                          {session.viewerRegistrationStatus === "waitlisted" ? "On waiting list" : "You're in"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="font-semibold leading-tight line-clamp-2">{session.title}</h3>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                          {formatInTimeZone(session.startAt, session.timeZone, { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {formatInTimeZone(session.startAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}
                        </p>
                        {session.location && (
                          <p className="flex items-center gap-2 min-w-0">
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="truncate">{session.location}</span>
                          </p>
                        )}
                        <p className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0" aria-hidden />
                          {session.maxParticipants
                            ? `${session.registeredCount}/${session.maxParticipants} players${isFull ? " · Registration Closed" : ""}${session.waitlistedCount > 0 ? ` · ${session.waitlistedCount} waiting` : ""}`
                            : `${session.registeredCount} players`}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="font-semibold">{price}</span>
                        <span className="inline-flex items-center text-sm font-medium text-primary-text">
                          View <ChevronRight className="h-4 w-4" aria-hidden />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <div className="text-center">
          <Button variant="outline" asChild>
            <Link href={`/play?organizer=${organization.id}`}>See all their sessions on Play</Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Contact details the organiser set on "Your Organisation"
// (/organiser/organisation). Only http(s) websites become links - older
// rows were saved before shared/organizationProfile.ts validated them.
function OrganizationContacts({ organization }: { organization: Pick<OrganizationDetail, "website" | "email" | "phone"> }) {
  const website = organization.website && /^https?:\/\//i.test(organization.website) ? organization.website : null;
  if (!website && !organization.email && !organization.phone) return null;
  const linkClass = "flex items-center gap-2.5 min-h-11 rounded-lg px-2 -mx-2 text-sm hover:bg-muted break-all";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-semibold mb-1">Contact</h2>
      <ul className="flex flex-col" data-testid="organization-contacts">
        {website && (
          <li>
            <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={linkClass} data-testid="organization-website">
              <Globe className="w-4 h-4 shrink-0 text-primary-text" />
              {website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
            </a>
          </li>
        )}
        {organization.email && (
          <li>
            <a href={`mailto:${organization.email}`} className={linkClass} data-testid="organization-email">
              <Mail className="w-4 h-4 shrink-0 text-primary-text" />
              {organization.email}
            </a>
          </li>
        )}
        {organization.phone && (
          <li>
            <a href={`tel:${organization.phone.replace(/[^+0-9]/g, "")}`} className={linkClass} data-testid="organization-phone">
              <Phone className="w-4 h-4 shrink-0 text-primary-text" />
              {organization.phone}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
