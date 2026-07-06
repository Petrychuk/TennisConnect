// ============================================================================
// CLUB COMMUNITIES
// ============================================================================

export const CLUB_CATEGORIES = [
    { value: "club", label: "🏆 Tennis Club" },
    { value: "community", label: "👥 Tennis Community" },
    { value: "academy", label: "🎓 Tennis Academy" },
    { value: "public-courts", label: "🌳 Public Courts" },
    { value: "tennis-centre", label: "🎾 Tennis Centre" },
    { value: "social-group", label: "🤝 Social Group" },
  ] as const;
  
  export type ClubCategory =
    (typeof CLUB_CATEGORIES)[number]["value"];
  
  // ============================================================================
  // LISTING
  // ============================================================================
  
  export const CLUB_LISTING_TYPES = [
    "free",
    "featured",
    "premium",
  ] as const;
  
  export type ClubListingType =
    (typeof CLUB_LISTING_TYPES)[number];
  
  // ============================================================================
  // STATUS
  // ============================================================================
  
  export const CLUB_STATUS = [
    "draft",
    "published",
    "hidden",
    "expired",
  ] as const;
  
  export type ClubStatus =
    (typeof CLUB_STATUS)[number];
  
  // ============================================================================
  // COURT SURFACES
  // ============================================================================
  
  export const COURT_SURFACES = [
    { value: "hard", label: "Hard Court" },
    { value: "clay", label: "Clay Court" },
    { value: "grass", label: "Grass Court" },
    { value: "synthetic", label: "Synthetic Court" },
    { value: "carpet", label: "Carpet Court" },
  ] as const;
  
  export type CourtSurface =
    (typeof COURT_SURFACES)[number]["value"];
  
  // ============================================================================
  // CLUB SERVICES
  // ============================================================================
  
  export const CLUB_SERVICES = [
    // ==========================================================================
    // Court Hire
    // ==========================================================================

    {
      value: "court-hire",
      label: "Court Hire",
      group: "Courts",
    },
    {
      value: "online-booking",
      label: "Online Court Booking",
      group: "Courts",
    },
    {
      value: "court-lighting",
      label: "Night Lighting",
      group: "Courts",
    },

    // ==========================================================================
    // Coaching
    // ==========================================================================

    {
      value: "coaching",
      label: "Group Coaching",
      group: "Coaching",
    },
    {
      value: "private-coaching",
      label: "Private Coaching",
      group: "Coaching",
    },
    {
      value: "junior-tennis",
      label: "Junior Tennis",
      group: "Coaching",
    },
    {
      value: "adult-programs",
      label: "Adult Programs",
      group: "Coaching",
    },
    {
      value: "cardio-tennis",
      label: "Cardio Tennis",
      group: "Coaching",
    },
    {
      value: "holiday-clinics",
      label: "Holiday Clinics",
      group: "Coaching",
    },

    // ==========================================================================
    // Community
    // ==========================================================================

    {
      value: "social-tennis",
      label: "Social Tennis",
      group: "Community",
    },
    {
      value: "league",
      label: "League",
      group: "Community",
    },
    {
      value: "competitions",
      label: "Competitions",
      group: "Community",
    },
    {
      value: "club-championships",
      label: "Club Championships",
      group: "Community",
    },
    {
      value: "round-robins",
      label: "Round Robins",
      group: "Community",
    },
    {
      value: "mixers",
      label: "Mixers",
      group: "Community",
    },
    {
      value: "ladies-tennis",
      label: "Ladies Tennis",
      group: "Community",
    },
    {
      value: "mens-tennis",
      label: "Men's Tennis",
      group: "Community",
    },
    {
      value: "family-tennis",
      label: "Family Tennis",
      group: "Community",
    },

    // ==========================================================================
    // Facilities
    // ==========================================================================

    {
      value: "pro-shop",
      label: "Pro Shop",
      group: "Facilities",
    },
    {
      value: "equipment-hire",
      label: "Equipment Hire",
      group: "Facilities",
    },
    {
      value: "stringing",
      label: "Racquet Stringing",
      group: "Facilities",
    },
    {
      value: "cafe",
      label: "Cafe",
      group: "Facilities",
    },
    {
      value: "restaurant",
      label: "Restaurant",
      group: "Facilities",
    },
    {
      value: "bar",
      label: "Bar",
      group: "Facilities",
    },
    {
      value: "parking",
      label: "Parking",
      group: "Facilities",
    },
    {
      value: "lockers",
      label: "Lockers",
      group: "Facilities",
    },
    {
      value: "showers",
      label: "Showers",
      group: "Facilities",
    },
    {
      value: "wifi",
      label: "Free Wi-Fi",
      group: "Facilities",
    },
    {
      value: "wheelchair-access",
      label: "Wheelchair Accessible",
      group: "Facilities",
    },

    // ==========================================================================
    // Extras
    // ==========================================================================

    {
      value: "ball-machine",
      label: "Ball Machine",
      group: "Extras",
    },
    {
      value: "fitness-gym",
      label: "Fitness Gym",
      group: "Extras",
    },
    {
      value: "kids-area",
      label: "Kids Play Area",
      group: "Extras",
    },
    {
      value: "events",
      label: "Special Events",
      group: "Extras",
    },
  ] as const;

  export type ClubService =
  (typeof CLUB_SERVICES)[number]["value"];
  
  // ============================================================================
  // COMPETITIONS
  // ============================================================================
  
  export const HOSTED_COMPETITION_TYPES = [
    {
      value: "social-tennis",
      label: "Social Tennis",
    },
    {
      value: "weekly-competition",
      label: "Weekly Competition",
    },
    {
      value: "monthly-tournament",
      label: "Monthly Tournament",
    },
    {
      value: "club-championships",
      label: "Club Championships",
    },
    {
      value: "league",
      label: "League",
    },
    {
      value: "utr-events",
      label: "UTR Events",
    },
    {
      value: "junior-events",
      label: "Junior Events",
    },
    {
      value: "open-tournaments",
      label: "Open Tournaments",
    },
  ] as const;
  
  export type CompetitionType =
    (typeof HOSTED_COMPETITION_TYPES)[number]["value"];
  
  // ============================================================================
  // CONTACT PERSON ROLES
  // ============================================================================
  
    export const CONTACT_PERSON_ROLES = [
      {
        value: "community-manager",
        label: "Community Manager",
      },
      {
        value: "club-manager",
        label: "Club Manager",
      },
      {
        value: "head-coach",
        label: "Head Coach",
      },
      {
        value: "tournament-director",
        label: "Tournament Director",
      },
      {
        value: "owner",
        label: "Owner",
      },
      {
        value: "other",
        label: "Other",
      },
    ] as const;
    
    export type ContactPersonRole =
      (typeof CONTACT_PERSON_ROLES)[number]["value"];


  // ============================================================================
  // Australia States
  // ============================================================================
  export const AUSTRALIAN_STATES = [
    { value: "NSW", label: "New South Wales" },
    { value: "QLD", label: "Queensland" },
    { value: "VIC", label: "Victoria" },
    { value: "WA", label: "Western Australia" },
    { value: "SA", label: "South Australia" },
    { value: "ACT", label: "Australian Capital Territory" },
    { value: "NT", label: "Northern Territory" },
    { value: "TAS", label: "Tasmania" },
    ] as const;
    
  export type AustralianState =
      (typeof AUSTRALIAN_STATES)[number]["value"];