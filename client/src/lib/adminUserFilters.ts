// The admin Users tab filters (role, organiser status, account status), as a
// pure function so the exact set of rows a bulk delete can reach is
// unit-tested (adminUserFilters.test.ts). The tab sends only rows that are
// selected AND pass these filters (bulkDeleteTargets in shared/userDeletion.ts).

export type RoleFilter = "all" | "player" | "coach";
export type OrganizerFilter = "all" | "organizers" | "not-organizers" | "awaiting";
export type AccountStatusFilter = "all" | "approved" | "pending";

export interface AdminUserFilters {
  role: RoleFilter;
  organizer: OrganizerFilter;
  status: AccountStatusFilter;
}

export const DEFAULT_ADMIN_USER_FILTERS: AdminUserFilters = { role: "all", organizer: "all", status: "all" };

export interface FilterableAdminUser {
  role: string;
  isApproved: boolean;
  isOrganizer?: boolean | null;
  organizerRequestStatus?: string | null;
}

export function matchesAdminUserFilters(user: FilterableAdminUser, filters: AdminUserFilters): boolean {
  if (filters.role !== "all" && user.role !== filters.role) return false;

  if (filters.organizer === "organizers" && !user.isOrganizer) return false;
  if (filters.organizer === "not-organizers" && user.isOrganizer) return false;
  if (filters.organizer === "awaiting" && !(!user.isOrganizer && user.organizerRequestStatus === "pending")) return false;

  if (filters.status === "approved" && !user.isApproved) return false;
  if (filters.status === "pending" && user.isApproved) return false;

  return true;
}

export function filterAdminUsers<T extends FilterableAdminUser>(users: readonly T[], filters: AdminUserFilters): T[] {
  return users.filter((u) => matchesAdminUserFilters(u, filters));
}

/** A key that changes whenever any filter does - the tab clears its selection on change. */
export function filtersKey(filters: AdminUserFilters): string {
  return `${filters.role}|${filters.organizer}|${filters.status}`;
}
