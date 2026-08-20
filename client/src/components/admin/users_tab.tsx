import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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
}

type OrganizerFilter = "all" | "organizers" | "not-organizers" | "awaiting";

export default function AdminUsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [organizerFilter, setOrganizerFilter] = useState<OrganizerFilter>("all");
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
  }

  const filteredUsers = users.filter((user) => {
    if (roleFilter !== "all" && user.role !== roleFilter) return false;

    if (organizerFilter === "organizers" && !user.isOrganizer) return false;
    if (organizerFilter === "not-organizers" && user.isOrganizer) return false;
    if (
      organizerFilter === "awaiting" &&
      !(!user.isOrganizer && user.organizerRequestStatus === "pending")
    ) {
      return false;
    }

    return true;
  });

  async function confirmAction() {
    if (!selectedUser || !actionType) return;
  
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
          const error = await res.json();
      
          toast({
            title: "Delete failed",
            description:
              error.message || "Failed to delete user",
            variant: "destructive",
          });
      
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
    }
  }

  function editUser(user: User) {
    alert(
      `Edit ${user.name} - coming soon`
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-border p-6" data-testid="admin-users-tab">
      <h2 className="font-display text-2xl font-bold mb-6">
        Users Moderation
      </h2>      
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-2">

          <Button
            variant={roleFilter === "all" ? "default" : "outline"}
            onClick={() => setRoleFilter("all")}
            data-testid="users-filter-role-all"
          >
            All ({users.length})
          </Button>

          <Button
            variant={roleFilter === "player" ? "default" : "outline"}
            onClick={() => setRoleFilter("player")}
            data-testid="users-filter-role-player"
          >
            Players ({playersCount})
          </Button>

          <Button
            variant={roleFilter === "coach" ? "default" : "outline"}
            onClick={() => setRoleFilter("coach")}
            data-testid="users-filter-role-coach"
          >
            Coaches ({coachesCount})
          </Button>

        </div>
        <div className="flex gap-2">
          <span
            className="px-3 py-2 rounded-lg bg-green-100 text-green-700 text-sm"
            data-testid="users-stat-approved"
          >
            Approved: {approvedCount}
          </span>

          <span
            className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700 text-sm"
            data-testid="users-stat-pending"
          >
            Pending: {pendingCount}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={organizerFilter === "all" ? "default" : "outline"}
          onClick={() => setOrganizerFilter("all")}
          data-testid="users-filter-organizer-all"
        >
          All Organiser Status
        </Button>
        <Button
          variant={organizerFilter === "organizers" ? "default" : "outline"}
          onClick={() => setOrganizerFilter("organizers")}
          data-testid="users-filter-organizer-approved"
          className="gap-1"
        >
          <Trophy className="w-3.5 h-3.5" />
          Organisers Approved ({organizersCount})
        </Button>
        <Button
          variant={organizerFilter === "not-organizers" ? "default" : "outline"}
          onClick={() => setOrganizerFilter("not-organizers")}
          data-testid="users-filter-organizer-not-approved"
        >
          Not Organisers ({notOrganizersCount})
        </Button>
        <Button
          variant={organizerFilter === "awaiting" ? "default" : "outline"}
          onClick={() => setOrganizerFilter("awaiting")}
          data-testid="users-filter-organizer-awaiting"
        >
          Awaiting Organiser Approval ({awaitingOrganizerCount})
        </Button>
      </div>

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
                    className="font-medium hover:text-primary hover:underline"
                    data-testid={`user-name-link-${user.id}`}
                  >
                    {user.name}
                  </a>
                  {user.isTestUser && (
                  <Badge variant="secondary">
                    TEST
                  </Badge>
                )}
                </td>
                <td className="min-w-[200px]">{user.email}</td>
                <td>{user.role}</td>
                <td data-testid={`user-organizer-status-${user.id}`}>
                  {user.isOrganizer ? (
                    <Badge className="bg-primary/10 text-primary">Organiser</Badge>
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
                 <div className="flex justify-center gap-3">
                    {!user.isApproved && (
                      <button
                        onClick={() => openApprove(user)}
                        title="Approve User"
                        data-testid={`approve-user-${user.id}`}
                      >
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </button>
                    )}
                    {user.isApproved && !user.isHidden && (
                      <button
                        onClick={() => openHide(user)}
                        title="Hide User"
                        data-testid={`hide-user-${user.id}`}
                      >
                        <EyeOff className="w-5 h-5 text-orange-500" />
                      </button>
                    )}

                    {user.isHidden && (
                      <button
                        onClick={() => openUnhide(user)}
                        title="Restore User"
                        data-testid={`unhide-user-${user.id}`}
                      >
                        <Eye className="w-5 h-5 text-green-600" />
                      </button>
                    )}

                    {!user.isOrganizer ? (
                      <button
                        onClick={() => openGrantOrganizer(user)}
                        title="Grant Organiser Access"
                        data-testid={`grant-organizer-${user.id}`}
                      >
                        <Trophy className="w-5 h-5 text-primary" />
                      </button>
                    ) : (
                      <button
                        onClick={() => openRevokeOrganizer(user)}
                        title="Revoke Organiser Access"
                        data-testid={`revoke-organizer-${user.id}`}
                      >
                        <UserMinus className="w-5 h-5 text-destructive" />
                      </button>
                    )}

                    <button
                      onClick={() => editUser(user)}
                      title="Edit User"
                      data-testid={`edit-user-${user.id}`}
                    >
                      <Pencil className="w-5 h-5 text-blue-600" />
                    </button>
                    
                    {user.id !== currentUser?.id && (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => openDelete(user)}
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )} 
                  </div>
                </td>
                <td>
                  {new Date(
                    user.createdAt
                  ).toLocaleDateString()}
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
                `Are you sure you want to permanently delete "${selectedUser?.name}"? This action cannot be undone and all associated data may be removed.`}

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

          <DialogFooter>

            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="user-action-cancel"
            >
              Cancel
            </Button>

            <Button
              variant={
                actionType === "delete" || actionType === "revoke-organizer"
                  ? "destructive"
                  : "default"
              }
              onClick={confirmAction}
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
    </div>
  );
}
