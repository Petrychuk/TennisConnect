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
  
  interface CoachStatsProps {
    profile: CoachProfile;
  }
  
  export function CoachStats({
    profile,
  }: CoachStatsProps) {
    return (
      <ProfileStats>
        <StatCard
          icon={<Award className="w-3 h-3 md:w-5 md:h-5" />}
          value={`${profile.experience ?? 0}y`}
          label="Experience"
        />
  
        <StatCard
          icon={<Star className="w-3 h-3 md:w-5 md:h-5" />}
          value={profile.rating ? profile.rating.toFixed(1) : "New"}
          label="Rating"
        />
  
        <StatCard
          icon={<DollarSign className="w-3 h-3 md:w-5 md:h-5" />}
          value={`${profile.rate ?? 0}`}
          label="Per Hour"
        />
  
        <StatCard
          icon={<CalendarDays className="w-3 h-3 md:w-5 md:h-5" />}
          value="New"
          /* value={getMemberSince(profile.createdAt)} */
          label="Member"
        />
      </ProfileStats>
    );
  }