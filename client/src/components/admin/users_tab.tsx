import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Trophy,
  UserMinus,
  Building2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { FilterChip, FILTER_CHIP_ROW } from "@/components/shared/filters";
import { cn } from "@/lib/utils";
import {
  bulkDeleteTargets,
  summariseDeletion,
  type DeletionFailure,
  type DeletionResult,
  type DeletionSummary,
} from "@shared/userDeletion";
import {
  DEFAULT_ADMIN_USER_FILTERS,
  filterAdminUsers,
  filtersKey,
  type AccountStatusFilter,
  type AdminUserFilters,
  type OrganizerFilter,
  type RoleFilter,
} from "@/lib/adminUserFilters";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  slug?: string;
  isApproved: boolean;
  isHidden: boolean;
  // Set once the player/coach finishes their onboarding wizard - the
  // public directory (getAllPlayers/getAllCoachesWithProfiles in
  // storage.ts) requires this AND isApproved both true, so an approved
  // user with an incomplete profile still won't show up there.
  profileCompleted: boolean;
  isAdmin: boolean;
  createdAt: string;
  isTestUser?: boolean;
  isOrganizer?: boolean;
  organizerRequestStatus?: "pending" | "approved" | "rejected" | "revoked" | null;
  ownedOrganization?: { id: string; name: string; slug: string; sessionCount?: number } | null;
  /** Why the server would refuse to delete this account right now (null = deletable). */
  deletionBlock?: DeletionFailure | null;
}

/** The last bulk result, shown as a panel above the table (not a toast). */
interface BulkResultView {
  summary: DeletionSummary;
  /** Names as they were before the delete, for rows that are gone now. */
  names: Record<string, { name: string; email: string }>;
}

export default function AdminUsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(DEFAULT_ADMIN_USER_FILTERS.role);
  const [organizerFilter, setOrganizerFilter] = useState<OrganizerFilter>(DEFAULT_ADMIN_USER_FILTERS.organizer);
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>(DEFAULT_ADMIN_USER_FILTERS.status);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<
    "approve" |
    "delete" |
    "hide" |
    "unhide" |
    "grant-organizer" |
    "revoke-organizer" |
    null
  >(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Deleting an organization is a distinct destructive action from
  // deleting the user who owns it - kept as its own small piece of
  // state and its own dialog, same reasoning as bulk delete below, so
  // an admin explicitly chooses to remove the organization (and
  // everything under it - other members, sessions) rather than that
  // being an implicit side effect buried inside "Delete User".
  const [orgDeleteTarget, setOrgDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [orgDeleting, setOrgDeleting] = useState(false);
  // Bulk delete is a separate flow from the single-user Dialog above -
  // it acts on a set of ids, not one selectedUser, so it gets its own
  // small piece of state and its own confirmation dialog rather than
  // overloading actionType with a case that doesn't fit its shape.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResultView | null>(null);
  // One delete request at a time (a double click or Enter-repeat used to be able to send two).
  const deleteInFlight = useRef(false);
  const [actionPending, setActionPending] = useState(false);
  // A single delete the server refused: shown inside the dialog with the reason and the way forward.
  const [deleteBlocked, setDeleteBlocked] = useState<DeletionFailure | null>(null);
  const { toast } = useToast();
  const playersCount = users.filter(u => u.role === "player").length;
  const coachesCount = users.filter(u => u.role === "coach").length;
  const pendingCount = users.filter(
    (u) => !u.isApproved
  ).length;
  
  const approvedCount = users.filter(
    (u) => u.isApproved
  ).length;

  const organizersCount = users.filter((u) => u.isOrganizer).length;
  const notOrganizersCount = users.filter((u) => !u.isOrganizer).length;
  const awaitingOrganizerCount = users.filter(
    (u) => !u.isOrganizer && u.organizerRequestStatus === "pending"
  ).length;

  function openApprove(user: User) {
    setSelectedUser(user);
    setActionType("approve");
    setDialogOpen(true);
  }

  function openHide(user: User) {
    setSelectedUser(user);
    setActionType("hide");
    setDialogOpen(true);
  }

  function openUnhide(user: User) {
    setSelectedUser(user);
    setActionType("unhide");
    setDialogOpen(true);
  }

  function openDelete(user: User) {
    setDeleteBlocked(null);
    setSelectedUser(user);
    setActionType("delete");
    setDialogOpen(true);
  }

  function openGrantOrganizer(user: User) {
    setSelectedUser(user);
    setActionType("grant-organizer");
    setDialogOpen(true);
  }

  function openRevokeOrganizer(user: User) {
    setSelectedUser(user);
    setActionType("revoke-organizer");
    setDialogOpen(true);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/api/admin/users", {
      credentials: "include",
    });

    if (!res.ok) return;
    const data = await res.json();
    setUsers(data);

    // Drops any selected id that's no longer in the list (deleted via
    // the single-row action, or via a bulk delete this same reload just
    // followed) - otherwise a stale id sits in the selection forever,
    // inflating the "Delete Selected (N)" count for a row that's
    // already gone.
    const stillPresent = new Set(data.map((u: User) => u.id));
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => stillPresent.has(id))));
  }

  const filters: AdminUserFilters = { role: roleFilter, organizer: organizerFilter, status: statusFilter };
  const filteredUsers = filterAdminUsers(users, filters);

  // Changing any filter clears the selection: a bulk delete only ever acts on
  // rows the admin can see and has ticked under the current filters. (It used
  // to keep ticks from other filters, so "Delete Selected (N)" could include
  // rows that were no longer on screen.)
  const currentFiltersKey = filtersKey(filters);
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentFiltersKey]);

  // Own row is never selectable (same reasoning as the row-level delete
  // button already hiding for currentUser?.id) - "select all" only ever
  // means all of the OTHER currently-filtered rows.
  const selectableIds = filteredUsers
    .filter((u) => u.id !== currentUser?.id)
    .map((u) => u.id);
  const allFilteredSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  // What a bulk delete will actually send: ticked, visible, not the admin.
  const bulkTargets = useMemo(
    () => bulkDeleteTargets(selectedIds, selectableIds, currentUser?.id),
    // selectableIds is derived from users + filters each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds, users, currentFiltersKey, currentUser?.id],
  );
  const protectedTargets = users.filter((u) => bulkTargets.includes(u.id) && u.deletionBlock);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      // The selection only ever holds visible rows (it is cleared on any
      // filter change), so the header checkbox simply selects or clears them.
      if (allFilteredSelected) return new Set();
      return new Set(selectableIds);
    });
  }

  async function confirmDeleteOrganization() {
    if (!orgDeleteTarget) return;

    setOrgDeleting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgDeleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        toast({
          title: "Could not delete organization",
          description: error.message || "Something went wrong",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Organization deleted",
        description: `${orgDeleteTarget.name} and everything under it has been removed. You can now delete the owner's account if needed.`,
      });

      setOrgDeleteTarget(null);
      loadUsers();
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setOrgDeleting(false);
    }
  }

  async function confirmBulkDelete() {
    if (deleteInFlight.current) return;
    const ids = bulkTargets;
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    deleteInFlight.current = true;
    setBulkDeleting(true);
    // Captured before the list reloads: deleted rows disappear from `users`.
    const names: BulkResultView["names"] = {};
    for (const u of users) if (ids.includes(u.id)) names[u.id] = { name: u.name, email: u.email };
    try {
      const res = await fetch("/api/admin/users/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        toast({
          title: "Bulk delete failed",
          description: error.message || "Nothing was deleted. Refresh the list and try again.",
          variant: "destructive",
        });
        return;
      }

      const result: DeletionResult = await res.json();
      setBulkResult({ summary: summariseDeletion(result), names });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      await loadUsers();
    } catch {
      toast({
        title: "Bulk delete failed",
        description: "We couldn't reach the server. Refresh the list to see what changed.",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
      deleteInFlight.current = false;
    }
  }

  async function confirmAction() {
    if (!selectedUser || !actionType) return;
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    setActionPending(true);
  
    try {
  
      if (actionType === "approve") {
  
        await fetch(
          `/api/admin/users/${selectedUser.id}/approve`,
          {
            method: "PATCH",
            credentials: "include",
          }
        );
  
        toast({
          title: "User Approved",
          description: `${selectedUser.name} has been approved`,
        });
      }
      
      if (actionType === "hide") {
        await fetch(
          `/api/admin/users/${selectedUser.id}/hide`,
          {
            method: "PATCH",
            credentials: "include",
          }
        );
      
        toast({
          title: "User Hidden",
          description: `${selectedUser.name} has been hidden`,
        });
      }

      if (actionType === "unhide") {
        await fetch(
          `/api/admin/users/${selectedUser.id}/unhide`,
          {
            method: "PATCH",
            credentials: "include",
          }
        );
      
        toast({
          title: "User Restored",
          description: `${selectedUser.name} is visible again`,
        });
      }

      if (actionType === "grant-organizer") {
        const res = await fetch(
          `/api/admin/users/${selectedUser.id}/grant-organizer`,
          {
            method: "PATCH",
            credentials: "include",
          }
        );

        if (!res.ok) {
          const error = await res.json();
          toast({
            title: "Could not grant organiser access",
            description: error.message || "Something went wrong",
            variant: "destructive",
          });
          setDialogOpen(false);
          return;
        }

        toast({
          title: "Organiser Access Granted",
          description: `${selectedUser.name} can now create an Organization and publish Sessions.`,
        });
      }

      if (actionType === "revoke-organizer") {
        const res = await fetch(
          `/api/admin/users/${selectedUser.id}/revoke-organizer`,
          {
            method: "PATCH",
            credentials: "include",
          }
        );

        if (!res.ok) {
          const error = await res.json();
          toast({
            title: "Could not revoke organiser access",
            description: error.message || "Something went wrong",
            variant: "destructive",
          });
          setDialogOpen(false);
          return;
        }

        toast({
          title: "Organiser Access Revoked",
          description: `${selectedUser.name} can no longer manage Sessions.`,
        });
      }

      if (actionType === "delete") {

        const res = await fetch(
          `/api/admin/users/${selectedUser.id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
      
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          // Shown in the dialog with the way forward, not in a toast.
          setDeleteBlocked({
            id: selectedUser.id,
            code: error.code ?? "error",
            message: error.message || "Failed to delete user",
            organization: error.organization ?? null,
            sessionCount: error.sessionCount ?? undefined,
          });
          if (error.code === "not_found") loadUsers();
          return;
        }
      
        toast({
          title: "User Deleted",
          description: `${selectedUser.name} has been removed`,
        });
      }
      
      loadUsers();
      setDialogOpen(false);
  
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    } finally {
      deleteInFlight.current = false;
      setActionPending(false);
    }
  }

  function editUser(user: User) {
    alert(
      `Edit ${user.name} - coming soon`
    );
  }

  return (
    <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-6" data-testid="admin-users-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className={FILTER_CHIP_ROW} role="group" aria-label="Filter by role">

          <FilterChip
            selected={roleFilter === "all"}
            onClick={() => setRoleFilter("all")}
            data-testid="users-filter-role-all"
          >
            All ({users.length})
          </FilterChip>

          <FilterChip
            selected={roleFilter === "player"}
            onClick={() => setRoleFilter("player")}
            data-testid="users-filter-role-player"
          >
            Players ({playersCount})
          </FilterChip>

          <FilterChip
            selected={roleFilter === "coach"}
            onClick={() => setRoleFilter("coach")}
            data-testid="users-filter-role-coach"
          >
            Coaches ({coachesCount})
          </FilterChip>

        </div>
        {/* Account status - was two read-only counters; now a filter too. */}
        <div className={FILTER_CHIP_ROW} role="group" aria-label="Filter by account status">
          <FilterChip
            selected={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            data-testid="users-filter-status-all"
          >
            All Statuses
          </FilterChip>
          <FilterChip
            selected={statusFilter === "approved"}
            onClick={() => setStatusFilter("approved")}
            data-testid="users-filter-status-approved"
          >
            <span data-testid="users-stat-approved">Approved: {approvedCount}</span>
          </FilterChip>
          <FilterChip
            selected={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
            data-testid="users-filter-status-pending"
          >
            <span data-testid="users-stat-pending">Pending: {pendingCount}</span>
          </FilterChip>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by organiser status">
        <FilterChip
          selected={organizerFilter === "all"}
          onClick={() => setOrganizerFilter("all")}
          data-testid="users-filter-organizer-all"
        >
          All Organiser Status
        </FilterChip>
        <FilterChip
          selected={organizerFilter === "organizers"}
          onClick={() => setOrganizerFilter("organizers")}
          data-testid="users-filter-organizer-approved"
          className="gap-1"
        >
          <Trophy className="w-3.5 h-3.5" />
          Organisers Approved ({organizersCount})
        </FilterChip>
        <FilterChip
          selected={organizerFilter === "not-organizers"}
          onClick={() => setOrganizerFilter("not-organizers")}
          data-testid="users-filter-organizer-not-approved"
        >
          Not Organisers ({notOrganizersCount})
        </FilterChip>
        <FilterChip
          selected={organizerFilter === "awaiting"}
          onClick={() => setOrganizerFilter("awaiting")}
          data-testid="users-filter-organizer-awaiting"
        >
          Awaiting Organiser Approval ({awaitingOrganizerCount})
        </FilterChip>
      </div>

      {bulkResult && (
        <BulkDeleteResultPanel
          result={bulkResult}
          onDismiss={() => setBulkResult(null)}
          onDeleteOrganization={(org) => setOrgDeleteTarget(org)}
          users={users}
        />
      )}

      <p className="mb-3 text-sm text-muted-foreground" data-testid="users-visible-count" aria-live="polite">
        Showing {filteredUsers.length} of {users.length} users
      </p>

      {bulkTargets.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl bg-destructive/5 border border-destructive/20"
          data-testid="bulk-delete-bar"
        >
          <span className="text-sm text-muted-foreground" data-testid="bulk-selected-count">
            {bulkTargets.length} user{bulkTargets.length === 1 ? "" : "s"} selected
            {protectedTargets.length > 0 && ` · ${protectedTargets.length} protected (won't be deleted)`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              data-testid="clear-selected-users"
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              data-testid="bulk-delete-button"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({bulkTargets.length})
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 min-w-[180px]">Name</th>
              <th className="text-left py-3 min-w-[200px]">Email</th>
              <th className="text-left py-3">Role</th>
              <th className="text-left py-3">Organiser</th>
              <th className="text-left py-3">Status</th>
              <th className="text-center py-3">Actions</th>
              <th className="text-left py-3">Created</th>
              <th className="text-center py-3">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  disabled={selectableIds.length === 0}
                  title="Select all"
                  data-testid="select-all-users"
                />
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b"
                data-testid={`user-row-${user.id}`}
              >
                <td className="py-4">
                  <a
                    href={
                      user.role === "coach"
                        ? `/coach/${user.slug}`
                        : `/player/${user.slug}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-primary-text hover:underline"
                    data-testid={`user-name-link-${user.id}`}
                  >
                    {user.name}
                  </a>
                  {user.isTestUser && (
                  <Badge variant="secondary">
                    TEST
                  </Badge>
                )}
                  {user.deletionBlock && (
                    <Badge
                      variant="secondary"
                      className="ml-1 bg-amber-100 text-amber-800"
                      title={user.deletionBlock.message}
                      data-testid={`user-protected-${user.id}`}
                    >
                      Protected
                      <span className="sr-only">: {user.deletionBlock.message}</span>
                    </Badge>
                  )}
                </td>
                <td className="min-w-[200px]">{user.email}</td>
                <td>{user.role}</td>
                <td data-testid={`user-organizer-status-${user.id}`}>
                  {user.isOrganizer ? (
                    <Badge className="bg-primary/10 text-primary-text">Organiser</Badge>
                  ) : user.organizerRequestStatus === "pending" ? (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      Awaiting Approval
                    </Badge>
                  ) : user.organizerRequestStatus === "rejected" ? (
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      Rejected
                    </Badge>
                  ) : user.organizerRequestStatus === "revoked" ? (
                    <Badge variant="secondary" className="bg-slate-200 text-slate-700">
                      Revoked
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
                <td>
                  {user.isHidden ? (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      Hidden
                    </Badge>
                  ) : user.isApproved && !user.profileCompleted ? (
                    <Badge
                      className="bg-amber-100 text-amber-800"
                      title="Approved, but the player/coach hasn't finished their profile yet - won't show in the public directory until they do"
                    >
                      Approved · Profile incomplete
                    </Badge>
                  ) : user.isApproved ? (
                    <Badge className="bg-green-100 text-green-700">
                      Approved
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">
                      Pending
                    </Badge>
                  )}
                </td>

                <td>
                 <div className="flex flex-wrap justify-center gap-1">
                    {!user.isApproved && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openApprove(user)}
                        title="Approve User"
                        aria-label={`Approve User: ${user.name}`}
                        data-testid={`approve-user-${user.id}`}
                      >
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </Button>
                    )}
                    {user.isApproved && !user.isHidden && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openHide(user)}
                        title="Hide User"
                        aria-label={`Hide User: ${user.name}`}
                        data-testid={`hide-user-${user.id}`}
                      >
                        <EyeOff className="w-5 h-5 text-orange-500" />
                      </Button>
                    )}

                    {user.isHidden && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openUnhide(user)}
                        title="Restore User"
                        aria-label={`Restore User: ${user.name}`}
                        data-testid={`unhide-user-${user.id}`}
                      >
                        <Eye className="w-5 h-5 text-green-600" />
                      </Button>
                    )}

                    {!user.isOrganizer ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openGrantOrganizer(user)}
                        title="Grant Organiser Access"
                        aria-label={`Grant Organiser Access: ${user.name}`}
                        data-testid={`grant-organizer-${user.id}`}
                      >
                        <Trophy className="w-5 h-5 text-primary-text" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openRevokeOrganizer(user)}
                        title="Revoke Organiser Access"
                        aria-label={`Revoke Organiser Access: ${user.name}`}
                        data-testid={`revoke-organizer-${user.id}`}
                      >
                        <UserMinus className="w-5 h-5 text-destructive" />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => editUser(user)}
                      title="Edit User"
                      aria-label={`Edit User: ${user.name}`}
                      data-testid={`edit-user-${user.id}`}
                    >
                      <Pencil className="w-5 h-5 text-blue-600" />
                    </Button>

                    {user.ownedOrganization && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setOrgDeleteTarget({ id: user.ownedOrganization!.id, name: user.ownedOrganization!.name })}
                        title={`Delete Organization "${user.ownedOrganization.name}"`}
                        aria-label={`Delete organisation ${user.ownedOrganization.name}`}
                        data-testid={`delete-organization-${user.ownedOrganization.id}`}
                      >
                        <Building2 className="w-5 h-5 text-destructive" aria-hidden="true" />
                      </Button>
                    )}
                    
                    {user.id !== currentUser?.id && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openDelete(user)}
                        title="Delete User"
                        aria-label={`Delete User: ${user.name}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )} 
                  </div>
                </td>
                <td>
                  {new Date(
                    user.createdAt
                  ).toLocaleDateString()}
                </td>
                <td className="text-center">
                  {user.id !== currentUser?.id && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelected(user.id)}
                      data-testid={`select-user-${user.id}`}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <DialogContent data-testid="user-action-dialog">
          <DialogHeader>

            <DialogTitle>
              {actionType === "approve" && "Approve User"}
              {actionType === "delete" && "Delete User"}
              {actionType === "hide" && "Hide User"}
              {actionType === "unhide" && "Restore User"}
              {actionType === "grant-organizer" && "Grant Organiser Access"}
              {actionType === "revoke-organizer" && "Revoke Organiser Access"}
            </DialogTitle>

            <DialogDescription>
              {actionType === "approve" &&
                `Are you sure you want to approve "${selectedUser?.name}"? This user will become visible on the platform and gain access to approved member features.`}

              {actionType === "delete" &&
                (selectedUser?.deletionBlock
                  ? `"${selectedUser.name}" is protected: ${selectedUser.deletionBlock.message} The server checks again when you confirm.`
                  : `Permanently delete "${selectedUser?.name}"? This can't be undone. Their profile, messages and registrations are removed; an organisation they own with no sessions is removed with them. Accounts that own an organisation with sessions, or created sessions, are never deleted here.`)}

              {actionType === "hide" &&
                `Are you sure you want to hide "${selectedUser?.name}"? The user will no longer appear in public listings but can be restored later.`}

              {actionType === "unhide" &&
                `Are you sure you want to restore "${selectedUser?.name}"? The user will become visible in public listings again.`}

              {actionType === "grant-organizer" &&
                `Grant organiser access to "${selectedUser?.name}"? They'll be able to create an Organization and publish Sessions immediately — no request needed.`}

              {actionType === "revoke-organizer" &&
                `Revoke organiser access from "${selectedUser?.name}"? Their existing Organization and Sessions stay in place, but they won't be able to publish new ones until re-approved.`}
            </DialogDescription>

          </DialogHeader>

          {actionType === "delete" && deleteBlocked && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" data-testid="user-delete-blocked">
              <p className="font-medium">Not deleted</p>
              <p className="mt-1 text-muted-foreground" data-testid="user-delete-blocked-reason">{deleteBlocked.message}</p>
              {deleteBlocked.organization && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setDialogOpen(false);
                    setOrgDeleteTarget({ id: deleteBlocked.organization!.id, name: deleteBlocked.organization!.name });
                  }}
                  data-testid="user-delete-blocked-delete-org"
                >
                  <Building2 className="w-4 h-4" aria-hidden="true" />
                  Delete organisation "{deleteBlocked.organization.name}"…
                </Button>
              )}
            </div>
          )}

          <DialogFooter>

            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="user-action-cancel"
            >
              {deleteBlocked ? "Close" : "Cancel"}
            </Button>

            <Button
              variant={
                actionType === "delete" || actionType === "revoke-organizer"
                  ? "destructive"
                  : "default"
              }
              onClick={confirmAction}
              disabled={actionPending || (actionType === "delete" && !!deleteBlocked)}
              data-testid="user-action-confirm"
            >
              {actionType === "approve" && "Approve User"}
              {actionType === "delete" && "Delete User"}
              {actionType === "hide" && "Hide User"}
              {actionType === "unhide" && "Restore User"}
              {actionType === "grant-organizer" && "Grant Access"}
              {actionType === "revoke-organizer" && "Revoke Access"}
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !bulkDeleting && setBulkDeleteOpen(open)}>
        <DialogContent data-testid="bulk-delete-dialog">
          <DialogHeader>
            <DialogTitle>Delete {bulkTargets.length} selected user{bulkTargets.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Only the {bulkTargets.length} account{bulkTargets.length === 1 ? "" : "s"} ticked under the current filters
              will be sent. This can't be undone. Accounts that own an organisation with sessions, or created sessions,
              are never deleted - they're reported with the reason instead.
            </DialogDescription>
          </DialogHeader>

          {protectedTargets.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="bulk-delete-protected-note">
              {protectedTargets.length} of them {protectedTargets.length === 1 ? "is" : "are"} protected and won't be
              deleted: {protectedTargets.slice(0, 3).map((u) => u.name).join(", ")}
              {protectedTargets.length > 3 ? ` and ${protectedTargets.length - 3} more` : ""}.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkDeleting}
              data-testid="bulk-delete-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={bulkDeleting || bulkTargets.length === 0}
              data-testid="bulk-delete-confirm"
            >
              {bulkDeleting ? "Deleting..." : `Delete ${bulkTargets.length} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!orgDeleteTarget} onOpenChange={(open) => !open && setOrgDeleteTarget(null)}>
        <DialogContent data-testid="delete-organization-dialog">
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{orgDeleteTarget?.name}"? This removes
              the organization along with all of its sessions, registrations, match results, and
              member/community relationships. This action cannot be undone. The owner's account
              itself is not affected - you can delete it separately afterward if needed.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOrgDeleteTarget(null)}
              disabled={orgDeleting}
              data-testid="delete-organization-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteOrganization}
              disabled={orgDeleting}
              data-testid="delete-organization-confirm"
            >
              {orgDeleting ? "Deleting..." : "Delete Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/*
  The outcome of a bulk delete: a short title ("9 deleted, 8 not deleted"),
  then the accounts that weren't deleted grouped by reason, each group
  collapsible and the list scrollable - instead of one red toast holding
  every name and message, which covered the page.
*/
function BulkDeleteResultPanel({
  result,
  users,
  onDismiss,
  onDeleteOrganization,
}: {
  result: BulkResultView;
  users: User[];
  onDismiss: () => void;
  onDeleteOrganization: (org: { id: string; name: string }) => void;
}) {
  const { summary, names } = result;
  const hasFailures = summary.notDeletedCount > 0;
  const stillListed = new Set(users.map((u) => u.id));
  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="bulk-delete-result"
      className={cn(
        "mb-4 rounded-xl border px-4 py-3",
        hasFailures ? "border-amber-300 bg-amber-50 text-amber-950" : "border-green-300 bg-green-50 text-green-950",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold" data-testid="bulk-delete-result-title">{summary.title}</h3>
          <p className="text-sm opacity-80">
            <span data-testid="bulk-delete-result-deleted">{summary.deletedCount}</span> deleted ·{" "}
            <span data-testid="bulk-delete-result-not-deleted">{summary.notDeletedCount}</span> not deleted
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss} data-testid="bulk-delete-result-dismiss">
          Dismiss
        </Button>
      </div>

      {summary.groups.map((group) => (
        <details key={group.code} className="mt-3 rounded-lg bg-white/70 px-3 py-2" data-testid={`bulk-delete-result-group-${group.code}`} open={summary.groups.length === 1}>
          <summary className="cursor-pointer text-sm font-medium">
            {group.label} ({group.failures.length})
          </summary>
          <ul className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1 text-sm">
            {group.failures.map((f) => (
              <li key={f.id} data-testid={`bulk-delete-result-item-${f.id}`} className="border-t border-amber-200/60 pt-2 first:border-0 first:pt-0">
                <span className="font-medium">{names[f.id]?.name ?? f.id}</span>
                {names[f.id]?.email && <span className="text-muted-foreground"> · {names[f.id].email}</span>}
                <p className="text-muted-foreground">{f.message}</p>
                {f.organization && stillListed.has(f.id) && (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => onDeleteOrganization({ id: f.organization!.id, name: f.organization!.name })}
                    data-testid={`bulk-delete-result-delete-org-${f.organization.id}`}
                  >
                    Delete organisation "{f.organization.name}"…
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
