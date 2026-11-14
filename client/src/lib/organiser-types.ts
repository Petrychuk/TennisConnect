// Shared Organiser Hub types (Phase 2). Moved out of
// organiser-hub-mock-data.ts so no page has to import a mock module to get
// a type.

/** The signed-in organiser as the Hub chrome shows them (organiser-layout.tsx). */
export interface OrganiserUser {
  name: string;
  /** "Organiser", "Admin" or "Organiser · Admin" - from the real account. */
  role: string;
  avatar: string | null;
  /** Site admin too: the sidebar shows its ADMIN section. */
  isAdmin?: boolean;
}
