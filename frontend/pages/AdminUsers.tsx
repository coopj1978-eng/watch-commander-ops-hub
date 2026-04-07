import { useState, useEffect } from "react";
import backend from "@/lib/backend";
import type { User, UserRole } from "~backend/user/types";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserX, UserCheck, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { OffboardingWizard } from "@/components/OffboardingWizard";
import { InviteUserDialog } from "@/components/InviteUserDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [offboardingUser, setOffboardingUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { toast } = useToast();

  const loadUsers = async () => {
    try {
      const { users: userList } = await backend.admin.listUsers();
      setUsers(userList as unknown as User[]);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await backend.admin.changeRole(userId, { newRole });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      await loadUsers();
    } catch (error) {
      console.error("Failed to change role:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update role",
      });
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await backend.user.deleteUser(userId);
      toast({
        title: "Success",
        description: "User permanently deleted",
      });
      setDeleteUser(null);
      await loadUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
      });
    }
  };

  const handleReactivate = async (userId: string) => {
    try {
      await backend.admin.reactivateUser(userId);
      toast({
        title: "Success",
        description: "User reactivated successfully",
      });
      await loadUsers();
    } catch (error) {
      console.error("Failed to reactivate user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reactivate user",
      });
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString();
  };

  return (
    <PageContainer title="User Management">
      <div className="flex justify-between items-center mb-6">
        <p className="text-muted-foreground">
          Manage user roles, permissions, and account status
        </p>
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WC">WC</SelectItem>
                          <SelectItem value="CC">CC</SelectItem>
                          <SelectItem value="FF">FF</SelectItem>
                          <SelectItem value="RO">RO</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{user.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <Badge className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Deactivated</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(user.last_login_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {user.is_active ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setOffboardingUser(user)}
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReactivate(user.id)}
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Reactivate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteUser(user)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {offboardingUser && (
        <OffboardingWizard
          user={offboardingUser}
          open={!!offboardingUser}
          onClose={() => setOffboardingUser(null)}
          onComplete={() => {
            setOffboardingUser(null);
            loadUsers();
          }}
        />
      )}

      <InviteUserDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        onSuccess={loadUsers}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
              This action cannot be undone. All associated data including profiles, activity logs, and records will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUser && handleDelete(deleteUser.id)}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
