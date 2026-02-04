"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import {
  Shield,
  UserPlus,
  Edit,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface Permission {
  id: string;
  key: string;
}

interface Role {
  id: string;
  name: string;
}

interface Admin {
  id: string;
  email: string;
  role: string;
  role_id: string;
  permissions: string[];
}

interface RolePermission {
  role_id: string;
  permission_id: string;
  permissions: {
    id: string;
    key: string;
  };
}

const PERMISSION_LABELS: Record<string, string> = {
  manage_admins: "Manage Admins",
  edit_timetable: "Edit Timetable",
  edit_results: "Edit Results",
  edit_students: "Edit Students",
  edit_subjects: "Edit Subjects",
  edit_class: "Edit Classes",
  edit_attendance: "Edit Attendance",
  edit_calendar: "Edit Calendar",
  edit_settings: "Edit Settings",
  edit_teachers: "Edit Teachers",
  edit_assignments: "Edit Assignments",
  edit_admissions: "Edit Admissions",
  edit_events: "Edit Events",
  edit_news: "Edit News",
  edit_testimonials: "Edit Testimonials",
  edit_notifications: "Edit Notifications",
  edit_sessions: "Edit Sessions",
  edit_terms: "Edit Terms",
  admin_full: "Full Admin Access",
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  manage_admins: "Create, edit, and remove admin users and their permissions",
  edit_timetable: "Create and modify school timetables and period slots",
  edit_results: "Enter and modify student results and grades",
  edit_students: "Manage student records and enrollments",
  edit_subjects: "Create and manage subjects and subject classes",
  edit_class: "Manage class information and assignments",
  edit_attendance: "Record and modify student attendance",
  edit_calendar: "Manage school calendar and events",
  edit_settings: "Modify school settings and configuration",
  edit_teachers: "Manage teacher records and assignments",
  edit_assignments: "Create and manage student assignments",
  edit_admissions: "Handle student admissions and applications",
  edit_events: "Create and manage school events",
  edit_news: "Publish and manage school news",
  edit_testimonials: "Manage testimonials and reviews",
  edit_notifications: "Send and manage system notifications",
  edit_sessions: "Create and manage academic sessions",
  edit_terms: "Create and manage academic terms",
  admin_full: "Complete access to all administrative features",
};

export default function ManageAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch admins and permissions
      const [adminsRes, rolesRes] = await Promise.all([
        fetch("/api/admin/manage-admins"),
        fetch("/api/admin/roles"),
      ]);

      if (!adminsRes.ok || !rolesRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const adminsData = await adminsRes.json();
      const rolesData = await rolesRes.json();

      setAdmins(adminsData.admins || []);
      setPermissions(adminsData.permissions || []);
      setRolePermissions(adminsData.rolePermissions || []);
      setRoles(rolesData.roles || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditAdmin = (admin: Admin) => {
    setSelectedAdmin(admin);
    setSelectedRole(admin.role_id || "");
    
    // Get permissions for this role
    const perms = rolePermissions
      .filter((rp) => rp.role_id === admin.role_id)
      .map((rp) => rp.permission_id);
    
    setSelectedPermissions(perms);
    setEditDialogOpen(true);
  };

  const handleSaveAdmin = async () => {
    if (!selectedAdmin || !selectedRole) {
      toast({
        title: "Error",
        description: "Please select a role",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Update role permissions first if it's admin role
      const adminRole = roles.find((r) => r.name === "admin");
      if (adminRole && selectedRole === adminRole.id) {
        await fetch("/api/admin/role-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleId: selectedRole,
            permissionIds: selectedPermissions,
          }),
        });
      }

      // Update user role
      const res = await fetch("/api/admin/manage-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedAdmin.id,
          roleId: selectedRole,
          permissions: selectedPermissions,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update admin");
      }

      toast({
        title: "Success",
        description: "Admin permissions updated successfully",
      });

      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error updating admin:", error);
      toast({
        title: "Error",
        description: "Failed to update admin permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return;

    try {
      setSaving(true);
      const res = await fetch(
        `/api/admin/manage-admins?userId=${adminToDelete.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        throw new Error("Failed to delete admin");
      }

      toast({
        title: "Success",
        description: "Admin removed successfully",
      });

      setDeleteDialogOpen(false);
      setAdminToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting admin:", error);
      toast({
        title: "Error",
        description: "Failed to remove admin",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const filteredAdmins = admins.filter((admin) =>
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPermissionBadgeColor = (permKey: string) => {
    if (permKey === "admin_full") return "bg-purple-500";
    if (permKey === "manage_admins") return "bg-red-500";
    if (permKey.includes("edit")) return "bg-blue-500";
    return "bg-gray-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Manage Administrators</h1>
        </div>
        <p className="text-muted-foreground">
          Control admin roles and granular permissions for your school management system
        </p>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search admins by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admins Table */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
          <CardDescription>
            {filteredAdmins.length} admin{filteredAdmins.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdmins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No administrators found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {admin.role?.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {admin.permissions.slice(0, 3).map((perm) => (
                          <Badge
                            key={perm}
                            className={`text-xs ${getPermissionBadgeColor(
                              permissions.find((p) => p.id === perm)?.key || ""
                            )}`}
                          >
                            {PERMISSION_LABELS[
                              permissions.find((p) => p.id === perm)?.key || ""
                            ] || perm}
                          </Badge>
                        ))}
                        {admin.permissions.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{admin.permissions.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditAdmin(admin)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAdminToDelete(admin);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Admin Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Administrator</DialogTitle>
            <DialogDescription>
              Modify role and permissions for {selectedAdmin?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <span className="capitalize">{role.name.replace("_", " ")}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permissions Grid */}
            {selectedRole && roles.find((r) => r.id === selectedRole)?.name === "admin" && (
              <div className="space-y-3">
                <Label className="text-base">Permissions</Label>
                <p className="text-sm text-muted-foreground">
                  Select specific permissions for this administrator
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-4">
                  {permissions
                    .filter((p) => p.key !== "admin_full")
                    .map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.includes(permission.id)}
                          onCheckedChange={() => togglePermission(permission.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={permission.id}
                            className="font-medium cursor-pointer leading-none"
                          >
                            {PERMISSION_LABELS[permission.key] || permission.key}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {PERMISSION_DESCRIPTIONS[permission.key] || ""}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {selectedPermissions.length} permission{selectedPermissions.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              </div>
            )}

            {/* Super Admin Note */}
            {selectedRole && roles.find((r) => r.id === selectedRole)?.name === "super_admin" && (
              <div className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                <Shield className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-900 dark:text-purple-100">
                    Super Administrator
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Super admins have all permissions by default and can manage other admins.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveAdmin} disabled={saving || !selectedRole}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Administrator?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove admin access for{" "}
              <span className="font-semibold">{adminToDelete?.email}</span>? This action will
              revoke all their administrative permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAdmin}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Admin"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
