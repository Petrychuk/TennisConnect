export type SessionTypeKey = "social" | "americano" | "round-robin" | "mexicano" | "king-of-the-court" | "custom";

export interface SessionTypeOption {
  key: SessionTypeKey;
  label: string;
  description: string;
  mostPopular?: boolean;
}

export const SESSION_TYPE_OPTIONS: SessionTypeOption[] = [
  { key: "social", label: "Social Tennis", description: "Fun, random doubles", mostPopular: true },
  { key: "americano", label: "Americano", description: "Rotate partners · Play with everyone" },
  { key: "round-robin", label: "Round Robin", description: "Everyone plays · Structured format" },
  { key: "mexicano", label: "Mexicano", description: "Competitive doubles · Level based" },
  { key: "king-of-the-court", label: "King of the Court", description: "Challenge and play · Elimination style" },
  { key: "custom", label: "Custom Session", description: "Create your own · Fully flexible" },
];

export type Visibility = "public" | "members" | "invite";
export type PricingMode = "free" | "paid";

export interface NewSessionDraft {
  // Step 1
  type: SessionTypeKey | null;

  // Step 2 - Session
  name: string;
  season: string;
  venue: string;
  courtCount: number;
  // Date
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  // Registration
  registrationOpens: string; // yyyy-mm-dd
  registrationCloses: string; // yyyy-mm-dd
  maxPlayers: number;
  waitingListEnabled: boolean;
  allowLateRegistration: boolean;
  // Pricing
  pricing: PricingMode;
  price: number;
  // Visibility
  visibility: Visibility;

  // Step 3 - Format
  matchType: "singles" | "doubles";
  gamesTo: number;
  roundsCount: number;
  noAd: boolean;
  tiebreak: boolean;
  // Pairing
  randomPartners: boolean;
  avoidRepeatPartners: boolean;
  balanceWaitingList: boolean;
  usePlayerRating: boolean;
  allowGuests: boolean;
  // Live Settings
  qrCheckIn: boolean;
  liveScores: boolean;
  autoNextRound: boolean;
  publishResults: boolean;
}

export function createEmptyDraft(): NewSessionDraft {
  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

  return {
    type: null,
    name: "",
    season: "",
    venue: "Lyne Park Tennis Centre",
    courtCount: 6,
    date: toDateInput(in7Days),
    startTime: "18:30",
    endTime: "20:00",
    registrationOpens: toDateInput(today),
    registrationCloses: toDateInput(in7Days),
    maxPlayers: 24,
    waitingListEnabled: true,
    allowLateRegistration: true,
    pricing: "free",
    price: 15,
    visibility: "public",
    matchType: "doubles",
    gamesTo: 4,
    roundsCount: 5,
    noAd: true,
    tiebreak: true,
    randomPartners: true,
    avoidRepeatPartners: true,
    balanceWaitingList: true,
    usePlayerRating: false,
    allowGuests: true,
    qrCheckIn: true,
    liveScores: true,
    autoNextRound: false,
    publishResults: true,
  };
}
