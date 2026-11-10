import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionVenue } from "@/lib/api/play";
import { googleMapsSearchUrl, tilePixel, venueMapsQuery } from "@shared/venue";

/*
  Where the session is played: a small map with a pin, the court's name and
  its address, and "Open in Google Maps". The address and pin are looked up
  automatically from the venue name (server/services/venueLookup.ts) - the
  organiser types nothing extra. No address found -> no map, just the name
  and the Maps search (never a pin at a guessed place).

  The map is plain OpenStreetMap tiles (images; no map library, no API key)
  with the required attribution.
*/
const ZOOM = 16;
const TILE = 256;

function TileMap({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  const p = tilePixel(latitude, longitude, ZOOM);
  const cx = Math.floor(p.x / TILE);
  const cy = Math.floor(p.y / TILE);
  const tiles: { x: number; y: number }[] = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) tiles.push({ x: cx + dx, y: cy + dy });
  return (
    <div className="relative h-44 overflow-hidden bg-muted" role="img" aria-label={`Map showing ${label}`} data-testid="play-session-venue-map">
      {tiles.map((t) => (
        <img
          key={`${t.x}-${t.y}`}
          src={`https://tile.openstreetmap.org/${ZOOM}/${t.x}/${t.y}.png`}
          alt=""
          aria-hidden
          loading="lazy"
          width={TILE}
          height={TILE}
          className="absolute max-w-none select-none"
          style={{ left: `calc(50% + ${t.x * TILE - p.x}px)`, top: `calc(50% + ${t.y * TILE - p.y}px)` }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-md" aria-hidden>
        <MapPin className="h-8 w-8 fill-primary text-foreground" />
      </span>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-0 right-0 bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}

export function SessionVenueCard({ sessionId, venue, timeZone }: { sessionId: string; venue: string; timeZone: string }) {
  const venueQuery = useQuery({
    queryKey: ["/api/play/sessions", sessionId, "venue"],
    queryFn: () => getSessionVenue(sessionId),
    retry: false,
  });
  const info = venueQuery.data;
  const mapsUrl = info?.googleMapsUrl ?? googleMapsSearchUrl(venueMapsQuery(venue, timeZone));
  const hasPin = info?.latitude != null && info?.longitude != null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-testid="play-session-venue">
      {venueQuery.isLoading ? <Skeleton className="h-44 w-full rounded-none" /> : hasPin ? <TileMap latitude={info!.latitude!} longitude={info!.longitude!} label={venue} /> : null}
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight" data-testid="play-session-venue-name">{venue}</p>
            {info?.address ? (
              <p className="mt-0.5 text-sm text-muted-foreground" data-testid="play-session-venue-address">{info.address}</p>
            ) : !venueQuery.isLoading ? (
              <p className="mt-0.5 text-sm text-muted-foreground">Address not listed - search it in Maps.</p>
            ) : null}
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" asChild data-testid="play-session-venue-open-maps">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-1.5 h-4 w-4" aria-hidden /> Open in Google Maps
          </a>
        </Button>
      </div>
    </section>
  );
}
