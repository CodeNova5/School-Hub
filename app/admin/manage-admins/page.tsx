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
  Loader2,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  name: string;
  email: string;
  role: string;
  role_id: string;
  permissions: string[];
  is_active: boolean;
  status: string;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
  permissions: {
    id: string;
    key: string;
  };
}

// Composite Permissions - These grant multiple sub-permissions
const COMPOSITE_PERMISSIONS = {
  manage_classes: {
    label: "Manage Classes",
    description: "Full control over class management including students, subjects, attendance, results, and timetable",
    subPermissions: [
      "Create, edit, and delete classes",
      "Assign and manage subjects for classes",
      "Modify subject properties (compulsory status, etc.)",
      "Enroll and remove students from classes",
      "Assign teachers to subject classes",
      "View and edit student attendance",
      "View and edit student results",
      "Manage class timetables",
    ],
    color: "bg-blue-500",
  },
  manage_teachers: {
    label: "Manage Teachers",
    description: "Full control over teacher records and assignments",
    subPermissions: [
      "Create, edit, and delete teacher records",
      "Assign teachers to subjects and classes",
      "Manage teacher schedules",
      "View teacher performance data",
    ],
    color: "bg-green-500",
  },
  manage_admissions: {
    label: "Manage Admissions",
    description: "Handle student applications and enrollment process",
    subPermissions: [
      "Review student applications",
      "Approve or reject admissions",
      "Process student enrollment",
      "Manage admission requirements",
    ],
    color: "bg-purple-500",
  },
};

// Standalone Permissions - These are independent
const STANDALONE_PERMISSIONS = {
  manage_admins: {
    label: "Manage Admins",
    description: "Create, edit, and remove admin users and their permissions",
    color: "bg-red-500",
  },
  manage_sessions: {
    label: "Manage Sessions",
    description: "Create and manage academic sessions/years",
    color: "bg-orange-500",
  },
  manage_terms: {
    label: "Manage Terms",
    description: "Create and manage academic terms/semesters",
    color: "bg-orange-500",
  },
  manage_events: {
    label: "Manage Events",
    description: "Create and manage school events and activities",
    color: "bg-indigo-500",
  },
  manage_news: {
    label: "Manage News",
    description: "Publish and manage school news and announcements",
    color: "bg-cyan-500",
  },
  manage_calendar: {
    label: "Manage Calendar",
    description: "Manage school calendar and schedules",
    color: "bg-pink-500",
  },
  manage_testimonials: {
    label: "Manage Testimonials",
    description: "Manage testimonials and reviews",
    color: "bg-teal-500",
  },
  manage_notifications: {
    label: "Manage Notifications",
    description: "Send and manage system notifications",
    color: "bg-yellow-500",
  },
  manage_settings: {
    label: "Manage Settings",
    description: "Modify school settings and system configuration",
    color: "bg-gray-500",
  },
};

// Keep for backward compatibility
const PERMISSION_LABELS: Record<string, string> = {
  manage_admins: "Manage Admins",
  manage_classes: "Manage Classes",
  manage_teachers: "Manage Teachers",
  manage_admissions: "Admissions",
  manage_sessions: "Sessions",
  manage_terms: "Terms",
  manage_events: "Events",
  manage_news: "News",
  manage_calendar: "Calendar",
  manage_testimonials: "Testimonials",
  manage_notifications: "Notifications",
  manage_settings: "Settings",
  admin_full: "Full Admin Access",
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
  
  // Add Admin state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");

  // Form state
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  // Collapsible state for composite permissions
  const [expandedComposite, setExpandedComposite] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [adminsRes, rolesRes] = await Promise.all([
        fetch("/api/admin"),
        fetch("/api/admin?action=roles"),
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
    
    // Get permissions for this specific admin's role
    const perms = rolePermissions
      .filter((rp) => rp.role_id === admin.role_id)
      .map((rp) => rp.permission_id);
    
    setSelectedPermissions(perms);
    setExpandedComposite({}); // Reset expanded state
    setEditDialogOpen(true);
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail || !newAdminName || !selectedRole) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAdminEmail)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Check if admin role is selected and no permissions are chosen
    const selectedRoleName = roles.find(r => r.id === selectedRole)?.name;
    if (selectedRoleName === "admin" && selectedPermissions.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one permission for admin role",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          email: newAdminEmail,
          name: newAdminName,
          roleId: selectedRole,
          permissions: selectedPermissions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add admin");
      }

      toast({
        title: "Success",
        description: "Admin created successfully. Activation email has been sent.",
      });

      setAddDialogOpen(false);
      setNewAdminEmail("");
      setNewAdminName("");
      setSelectedRole("");
      setSelectedPermissions([]);
      fetchData();
    } catch (error: any) {
      console.error("Error adding admin:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add admin",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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

    // Check if admin role is selected and no permissions are chosen
    const selectedRoleName = roles.find(r => r.id === selectedRole)?.name;
    if (selectedRoleName === "admin" && selectedPermissions.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one permission for admin role",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
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
        `/api/admin?userId=${adminToDelete.id}`,
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
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPermissionBadgeColor = (permKey: string) => {
    if (permKey === "admin_full") return "bg-purple-500";
    if (COMPOSITE_PERMISSIONS[permKey as keyof typeof COMPOSITE_PERMISSIONS]) {
      return COMPOSITE_PERMISSIONS[permKey as keyof typeof COMPOSITE_PERMISSIONS].color;
    }
    if (STANDALONE_PERMISSIONS[permKey as keyof typeof STANDALONE_PERMISSIONS]) {
      return STANDALONE_PERMISSIONS[permKey as keyof typeof STANDALONE_PERMISSIONS].color;
    }
    return "bg-gray-500";
  };

  const renderPermissionSelector = () => {
    const compositePerms = permissions.filter(p => 
      Object.keys(COMPOSITE_PERMISSIONS).includes(p.key)
    );
    const standalonePerms = permissions.filter(p => 
      Object.keys(STANDALONE_PERMISSIONS).includes(p.key) && p.key !== "admin_full"
    );

    return (
      <div className="space-y-6">
        {/* Composite Permissions Section */}
        {compositePerms.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Composite Permissions</h3>
              <Badge variant="outline" className="text-xs">
                Grants Multiple Sub-permissions
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              These permissions automatically grant access to multiple related features
            </p>
            
            <div className="space-y-2 border rounded-lg p-4">
              {compositePerms.map((permission) => {
                const config = COMPOSITE_PERMISSIONS[permission.key as keyof typeof COMPOSITE_PERMISSIONS];
                const isExpanded = expandedComposite[permission.key] || false;
                
                return (
                  <Collapsible
                    key={permission.id}
                    open={isExpanded}
                    onOpenChange={(open) => 
                      setExpandedComposite(prev => ({ ...prev, [permission.key]: open }))
                    }
                  >
                    <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <Checkbox
                        id={permission.id}
                        checked={selectedPermissions.includes(permission.id)}
                        onCheckedChange={() => togglePermission(permission.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Label
                              htmlFor={permission.id}
                              className="font-medium cursor-pointer leading-none"
                            >
                              {config.label}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {config.description}
                            </p>
                          </div>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        
                        <CollapsibleContent className="space-y-1">
                          <div className="pl-4 pt-2 border-l-2 border-muted-foreground/20">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Includes access to:
                            </p>
                            <ul className="space-y-1">
                              {config.subPermissions.map((subPerm, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-600 flex-shrink-0" />
                                  <span>{subPerm}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        )}

        {/* Standalone Permissions Section */}
        {standalonePerms.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Standalone Permissions</h3>
              <Badge variant="outline" className="text-xs">
                Individual Features
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Independent permissions for specific features
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-4">
              {standalonePerms.map((permission) => {
                const config = STANDALONE_PERMISSIONS[permission.key as keyof typeof STANDALONE_PERMISSIONS];
                
                return (
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
                        {config.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {config.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selection Summary */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <CheckCircle2 className="w-5 h-5 text-blue-600" />
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {selectedPermissions.length} permission{selectedPermissions.length !== 1 ? "s" : ""} selected
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout role="admin">
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
                  placeholder="Search admins by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setAddDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Admin
              </Button>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No administrators found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAdmins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.name}</TableCell>
                      <TableCell>{admin.email}</TableCell>
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

              {/* Permissions */}
              {selectedRole && roles.find((r) => r.id === selectedRole)?.name === "admin" && (
                renderPermissionSelector()
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

        {/* Add Admin Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Administrator</DialogTitle>
              <DialogDescription>
                Create a new administrator account and assign permissions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Name Input */}
              <div className="space-y-2">
                <Label htmlFor="admin-name">Full Name</Label>
                <Input
                  id="admin-name"
                  placeholder="Enter administrator's full name"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email Address</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="Enter email address"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  An activation link will be sent to this email
                </p>
              </div>

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

              {/* Permissions */}
              {selectedRole && roles.find((r) => r.id === selectedRole)?.name === "admin" && (
                renderPermissionSelector()
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
                onClick={() => {
                  setAddDialogOpen(false);
                  setNewAdminEmail("");
                  setNewAdminName("");
                  setSelectedRole("");
                  setSelectedPermissions([]);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddAdmin} 
                disabled={saving || !newAdminEmail || !newAdminName || !selectedRole}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Admin"
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
    </DashboardLayout>
  );
}