import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shuffle, Repeat, Trophy, Ruler, ScrollText, GraduationCap } from "lucide-react";
import { type SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { sessionCategoryOf } from "@shared/sessionCategories";
import { SessionPoliciesList } from "@/components/play/session-policies";
import { sessionFormatLabel } from "@/lib/organiser-session-wizard-types";

interface FormatRulesTabProps {
  session: SessionListItem;
}

export function FormatRulesTab({ session }: FormatRulesTabProps) {
  // Real fields (sessions.match_mode/category/games_to/no_ad/tiebreak/
  // planned_rounds_count) - this tab used to always show the same
  // hardcoded "Fun doubles · Random partners · Balance skill" via
  // getSessionDetail()'s mock fallback, regardless of what the
  // organizer actually picked in the wizard. Same real data
  // session-details-card.tsx's Overview cards already use.
  const formatLabel = sessionFormatLabel(session) ?? "Not set";
  const roundsCount = session.roundTotal ?? session.plannedRoundsCount ?? null;
  const scoringLabel =
    session.gamesTo != null
      ? `First to ${session.gamesTo} games${session.noAd ? ", no-ad" : ""}${session.tiebreak ? ", tiebreak at deuce" : ""}.`
      : "Not set.";

  const category = sessionCategoryOf(session.type);
  const items = category.usesMatchFormat
    ? [
        { icon: Shuffle, title: "Format", description: formatLabel },
        { icon: Repeat, title: "Rounds", description: roundsCount != null ? `${roundsCount} planned rounds.` : "Not set." },
        { icon: Trophy, title: "Scoring", description: scoringLabel },
        // What liveEngine.planRound really does (no "balance skill": there's no rating).
        { icon: Ruler, title: "Court Assignment", description: "In Live, players are shuffled each round, repeat partners and opponents are avoided where possible, and rests are shared evenly." },
      ]
    : [{ icon: GraduationCap, title: "Format", description: `${category.label}: coach-led, no rounds or scores.` }];
  const hasPolicies = !!session.policies && Object.values(session.policies).some(Boolean);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="organiser-session-format-tab">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="shadow-sm" data-testid={`organiser-session-format-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary-text flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
              <CardTitle asChild className="text-base"><h2>{item.title}</h2></CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        );
      })}
      <Card className="shadow-sm sm:col-span-2" data-testid="organiser-session-format-policies">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary-text flex items-center justify-center">
            <ScrollText className="w-4 h-4" />
          </div>
          <CardTitle asChild className="text-base"><h2>Rules & Policies</h2></CardTitle>
        </CardHeader>
        <CardContent>
          {hasPolicies ? (
            <SessionPoliciesList policies={session.policies} testId="organiser-session-policies" />
          ) : (
            <p className="text-sm text-muted-foreground">None added. You can add rules, refund, late-arrival and cancellation policies from Edit.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
