import {
    Award,
    Star,
    DollarSign,
    CalendarDays,
  } from "lucide-react";
  
import { ProfileStats } from "../shared/ProfileStats";
import { StatCard } from "../shared/StatCard";
import { CoachProfile } from "@/pages/coach-profile";
import { getMemberSince } from "@/lib/memberSince";

// Some profiles store experience/rate as pre-formatted text (e.g. "15 years",
// "$120/hr") instead of a raw number. Pulling out just the leading number
// keeps this card's own formatting from doubling up on units/symbols.
function extractLeadingNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const match = String(value).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}
  
  interface CoachStatsProps {
    profile: CoachProfile;
  }
  
  export function CoachStats({
    profile,
  }: CoachStatsProps) {
    return (
      <ProfileStats>
        <StatCard
          data-testid="coach-stat-experience"
          icon={<Award className="w-3 h-3 md:w-5 md:h-5" />}
          value={`${extractLeadingNumber(profile.experience)}y`}
          label="Experience"
        />
  
        <StatCard
          data-testid="coach-stat-rating"
          icon={<Star className="w-3 h-3 md:w-5 md:h-5" />}
          value={profile.rating ? profile.rating.toFixed(1) : "New"}
          label="Rating"
        />
  
        <StatCard
          data-testid="coach-stat-rate"
          icon={<DollarSign className="w-3 h-3 md:w-5 md:h-5" />}
          value={`$${extractLeadingNumber(profile.rate)}/hr`}
          label="Per Hour"
        />
  
        <StatCard
          data-testid="coach-stat-member"
          icon={<CalendarDays className="w-3 h-3 md:w-5 md:h-5" />}
          value="New"
          /* value={getMemberSince(profile.createdAt)} */
          label="Member"
        />
      </ProfileStats>
    );
  }