import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
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
  isAdmin: boolean;
  createdAt: string;
  isTestUser?: boolean;
}

export default function AdminUsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<
    "approve" |
    "delete" |
    "hide" |
    "unhide" |
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
    if (roleFilter === "all") return true;
    return user.role === roleFilter;
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
    <div className="bg-white rounded-3xl border border-border p-6">
      <h2 className="font-display text-2xl font-bold mb-6">
        Users Moderation
      </h2>      
      <div className="flex flex-wrap gap-2 mb-6">

        <Button
          variant={roleFilter === "all" ? "default" : "outline"}
          onClick={() => setRoleFilter("all")}
        >
          All ({users.length})
        </Button>

        <Button
          variant={roleFilter === "player" ? "default" : "outline"}
          onClick={() => setRoleFilter("player")}
        >
          Players ({playersCount})
        </Button>

        <Button
          variant={roleFilter === "coach" ? "default" : "outline"}
          onClick={() => setRoleFilter("coach")}
        >
          Coaches ({coachesCount})
        </Button>

      </div>
      <div className="ml-auto flex gap-2">
        <span className="px-3 py-2 rounded-lg bg-green-100 text-green-700 text-sm">
          Approved: {approvedCount}
        </span>

        <span className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700 text-sm">
          Pending: {pendingCount}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 min-w-[320px]">Name</th>
              <th className="text-left py-3 min-w-[320px]">Email</th>
              <th className="text-left py-3">Role</th>
              <th className="text-left py-3">Status</th>
              <th className="text-left py-3">Created</th>
              <th className="text-center py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b"
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
                  >
                    {user.name}
                  </a>
                  {user.isTestUser && (
                  <Badge variant="secondary">
                    TEST
                  </Badge>
                )}
                </td>
                <td className="min-w-[320px]">{user.email}</td>
                <td>{user.role}</td>

                <td>
                  <td>
                    <td>
                    {user.isHidden ? (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                        Hidden
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
                  </td>
                </td>

                <td>
                  {new Date(
                    user.createdAt
                  ).toLocaleDateString()}
                </td>

                <td>
                 <div className="flex justify-center gap-3">
                    {!user.isApproved && (
                      <button
                        onClick={() => openApprove(user)}
                        title="Approve User"
                      >
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </button>
                    )}
                    {user.isApproved && !user.isHidden && (
                      <button
                        onClick={() => openHide(user)}
                        title="Hide User"
                      >
                        <EyeOff className="w-5 h-5 text-orange-500" />
                      </button>
                    )}

                    {user.isHidden && (
                      <button
                        onClick={() => openUnhide(user)}
                        title="Restore User"
                      >
                        <Eye className="w-5 h-5 text-green-600" />
                      </button>
                    )}

                    <button
                      onClick={() => editUser(user)}
                      title="Edit User"
                    >
                      <Pencil className="w-5 h-5 text-blue-600" />
                    </button>
                    
                    {user.id !== currentUser?.id && (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => openDelete(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )} 
                  </div>
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
        <DialogContent>
          <DialogHeader>

            <DialogTitle>
              {actionType === "approve" && "Approve User"}
              {actionType === "delete" && "Delete User"}
              {actionType === "hide" && "Hide User"}
              {actionType === "unhide" && "Restore User"}
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
            </DialogDescription>

          </DialogHeader>

          <DialogFooter>

            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              variant={
                actionType === "delete"
                  ? "destructive"
                  : "default"
              }
              onClick={confirmAction}
            >
              {actionType === "approve" && "Approve User"}
              {actionType === "delete" && "Delete User"}
              {actionType === "hide" && "Hide User"}
              {actionType === "unhide" && "Restore User"}
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}