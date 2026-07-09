"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  Users,
  Loader2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import type { AdminRole, AdminRoleAssignment } from "@/lib/types";
import { PERMISSION_GROUPS, ROLE_TEMPLATES } from "@/lib/admin-permissions";
import type { PermissionGroup } from "@/lib/admin-permissions";
import { AdminPermissionMatrix } from "@/components/admin-permission-matrix";

/* ────────────────────────────────────────────
   Permission checkboxes group component
───────────────────────────────────────────── */
function PermissionGroupCard({
  group,
  selected,
  onChange,
}: {
  group: PermissionGroup;
  selected: string[];
  onChange: (perms: string[]) => void;
}) {
  const allSelected = group.permissions.every((p) =>
    selected.includes(p.permission)
  );
  const anySelected = group.permissions.some((p) =>
    selected.includes(p.permission)
  );

  function toggleGroup() {
    if (allSelected) {
      onChange(selected.filter((s) => !group.permissions.some((p) => p.permission === s)));
    } else {
      const newPerms = [...selected];
      for (const p of group.permissions) {
        if (!newPerms.includes(p.permission)) newPerms.push(p.permission);
      }
      onChange(newPerms);
    }
  }

  function togglePermission(permission: string) {
    if (selected.includes(permission)) {
      onChange(selected.filter((s) => s !== permission));
    } else {
      onChange([...selected, permission]);
    }
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={toggleGroup}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{group.icon}</span>
          <div>
            <p className="text-sm font-semibold">{group.label}</p>
            <p className="text-xs text-muted-foreground">{group.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {group.permissions.filter((p) => selected.includes(p.permission)).length}/{group.permissions.length}
          </span>
          {allSelected ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : anySelected ? (
            <div className="h-4 w-4 rounded bg-amber-200" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground/40" />
          )}
        </div>
      </div>
      <div className="px-4 py-2 space-y-1 border-t">
        {group.permissions.map((p) => (
          <label
            key={p.permission}
            className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-muted/20 rounded px-2 -mx-2 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.includes(p.permission)}
              onChange={() => togglePermission(p.permission)}
              className="rounded border-gray-300 text-primary focus:ring-primary/30"
            />
            <div>
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   Role Dialog (Create/Edit)
───────────────────────────────────────────── */
function RoleDialog({
  open,
  onOpenChange,
  onSaved,
  editingRole,
  schoolId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editingRole: AdminRole | null;
  schoolId: string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingRole) {
        setName(editingRole.name);
        setDescription(editingRole.description || "");
        setSelectedPermissions(editingRole.permissions || []);
      } else {
        setName("");
        setDescription("");
        setSelectedPermissions([]);
      }
    }
  }, [open, editingRole]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !name.trim()) { toast.error("Role name is required"); return; }
    if (selectedPermissions.length === 0) { toast.error("Select at least one permission"); return; }
    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        name: name.trim(),
        description: description.trim(),
        permissions: selectedPermissions,
        is_active: true,
      };
      if (editingRole) {
        const { error } = await supabase
          .from("admin_roles")
          .update({ name: payload.name, description: payload.description, permissions: payload.permissions })
          .eq("id", editingRole.id);
        if (error) throw error;
        toast.success("Role updated");
      } else {
        const { error } = await supabase.from("admin_roles").insert(payload);
        if (error) throw error;
        toast.success("Role created");
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRole ? "Edit Role Template" : "Create Role Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium block mb-1">Role Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stock Manager" required />
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
            </div>
          </div>

          {/* Pre-built templates */}
          {!editingRole && selectedPermissions.length === 0 && (
            <div>
              <Label className="text-sm font-medium block mb-2">Quick Start Templates</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_TEMPLATES.map((tmpl) => (
                  <Button
                    key={tmpl.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setName(tmpl.name); setDescription(tmpl.description); setSelectedPermissions(tmpl.permissions as string[]); }}
                  >
                    {tmpl.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Permission groups */}
          <div>
            <Label className="text-sm font-medium block mb-2">
              Permissions ({selectedPermissions.length} selected)
            </Label>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {PERMISSION_GROUPS.map((group) => (
                <PermissionGroupCard
                  key={group.namespace}
                  group={group}
                  selected={selectedPermissions}
                  onChange={setSelectedPermissions}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────
   Role Templates Tab
───────────────────────────────────────────── */
function RoleTemplatesTab({ schoolId }: { schoolId: string }) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_roles")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load roles");
    else setRoles((data ?? []) as AdminRole[]);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("admin_roles").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Role deleted"); fetchRoles(); }
    setDeleteId(null);
  }

  async function toggleActive(role: AdminRole) {
    const { error } = await supabase
      .from("admin_roles")
      .update({ is_active: !role.is_active })
      .eq("id", role.id);
    if (error) toast.error(error.message);
    else setRoles((prev) => prev.map((r) => r.id === role.id ? { ...r, is_active: !role.is_active } : r));
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Role Templates</h2>
          <p className="text-sm text-muted-foreground">
            Create reusable permission templates to assign to admin accounts
          </p>
        </div>
        <Button onClick={() => { setEditingRole(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Create Role
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : roles.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-1">No roles yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create role templates to define what different admin accounts can access.
            You can start from pre-built templates or configure permissions manually.
          </p>
          <Button onClick={() => { setEditingRole(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Create Your First Role
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {roles.map((role) => {
            const permCount = role.permissions?.length || 0;
            const readCount = role.permissions?.filter((p) => p.endsWith(":read")).length || 0;
            const writeCount = permCount - readCount;
            return (
              <div key={role.id} className="rounded-lg border bg-card overflow-hidden hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{role.name}</h3>
                        {!role.is_active && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-green-600 font-medium">{readCount} read</span>
                      <span className="text-blue-600 font-medium">{writeCount} write</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{permCount} total</span>
                    </div>
                    <Switch checked={role.is_active} onCheckedChange={() => toggleActive(role)} className="scale-90" />
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => { setEditingRole(role); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteId(role.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Permission chips */}
                <div className="px-4 py-2 flex flex-wrap gap-1">
                  {role.permissions?.slice(0, 8).map((perm) => (
                    <Badge key={perm} variant="secondary" className={`text-[10px] ${perm.endsWith(":write") ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"}`}>
                      {perm}
                    </Badge>
                  ))}
                  {permCount > 8 && (
                    <Badge variant="outline" className="text-[10px]">+{permCount - 8} more</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Dialog */}
      <RoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={fetchRoles}
        editingRole={editingRole}
        schoolId={schoolId}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Role?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will also remove this role from all admins it is assigned to. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ────────────────────────────────────────────
   Admin Accounts Tab
───────────────────────────────────────────── */
function AdminAccountsTab({ schoolId }: { schoolId: string }) {
  const [admins, setAdmins] = useState<any[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [assignments, setAssignments] = useState<AdminRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removeAdminId, setRemoveAdminId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [adminsRes, rolesRes, assignmentsRes] = await Promise.all([
        supabase.from("admins").select("*").eq("school_id", schoolId).order("name", { ascending: true }),
        supabase.from("admin_roles").select("*").eq("school_id", schoolId).eq("is_active", true).order("name", { ascending: true }),
        supabase.from("admin_role_assignments").select("*, admin_roles(*)").eq("school_id", schoolId),
      ]);
      if (adminsRes.error) throw adminsRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      setAdmins(adminsRes.data ?? []);
      setRoles((rolesRes.data ?? []) as AdminRole[]);
      setAssignments((assignmentsRes.data ?? []) as AdminRoleAssignment[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function getAdminRoles(adminId: string): AdminRole[] {
    return assignments
      .filter((a) => a.admin_id === adminId)
      .map((a) => (a as any).admin_roles as AdminRole)
      .filter(Boolean);
  }

  function openAssignDialog(adminId: string) {
    const currentRoles = getAdminRoles(adminId);
    setSelectedAdminId(adminId);
    setSelectedRoleIds(currentRoles.map((r) => r.id));
    setAssignDialogOpen(true);
  }

  async function saveRoleAssignments() {
    if (!schoolId || !selectedAdminId) return;
    setSaving(true);
    try {
      // Get current assignments for this admin
      const currentRoleIds = assignments
        .filter((a) => a.admin_id === selectedAdminId)
        .map((a) => a.role_id);

      // Remove unselected roles
      const toRemove = currentRoleIds.filter((id) => !selectedRoleIds.includes(id));
      if (toRemove.length > 0) {
        const { error: delError } = await supabase
          .from("admin_role_assignments")
          .delete()
          .eq("admin_id", selectedAdminId)
          .eq("school_id", schoolId)
          .in("role_id", toRemove);
        if (delError) throw delError;
      }

      // Add new roles
      const toAdd = selectedRoleIds.filter((id) => !currentRoleIds.includes(id));
      if (toAdd.length > 0) {
        const inserts = toAdd.map((roleId) => ({
          school_id: schoolId,
          admin_id: selectedAdminId,
          role_id: roleId,
        }));
        const { error: insError } = await supabase
          .from("admin_role_assignments")
          .insert(inserts);
        if (insError) throw insError;
      }

      toast.success("Role assignments updated");
      setAssignDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update assignments");
    } finally {
      setSaving(false);
    }
  }

  async function removeAdminAccess() {
    if (!removeAdminId) return;
    setSaving(true);
    try {
      // Soft-deactivate the admin rather than deleting
      const { error } = await supabase
        .from("admins")
        .update({ is_active: false })
        .eq("id", removeAdminId);
      if (error) throw error;
      toast.success("Admin access revoked");
      setRemoveAdminId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke access");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Admin Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Manage admin accounts and assign role-based permissions
          </p>
        </div>
        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
          {admins.length} admin{admins.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : admins.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-1">No admin accounts</h3>
          <p className="text-sm text-muted-foreground">
            Admin accounts are created during school registration and setup.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => {
            const adminRoles = getAdminRoles(admin.id);
            const allPerms = adminRoles.flatMap((r) => r.permissions || []);
            const uniquePerms = [...new Set(allPerms)];

            return (
              <div key={admin.id} className={`rounded-lg border bg-card overflow-hidden hover:border-primary/30 transition-colors ${!admin.is_active ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold ${admin.is_primary_admin ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                      {admin.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{admin.name}</span>
                        {admin.is_primary_admin && (
                          <Badge className="text-[10px] h-4 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-0">Primary</Badge>
                        )}
                        {!admin.is_active && (
                          <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground">Deactivated</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {adminRoles.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground mr-2">
                        {adminRoles.slice(0, 2).map((r) => (
                          <Badge key={r.id} variant="secondary" className="text-[10px]">{r.name}</Badge>
                        ))}
                        {adminRoles.length > 2 && (
                          <span className="text-muted-foreground">+{adminRoles.length - 2}</span>
                        )}
                      </div>
                    )}
                    {!admin.is_primary_admin && admin.is_active && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs"
                          onClick={() => openAssignDialog(admin.id)}>
                          Assign Roles
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setRemoveAdminId(admin.id)}>
                          Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {adminRoles.length > 0 && uniquePerms.length > 0 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-1">
                    {uniquePerms.slice(0, 6).map((perm) => (
                      <Badge key={perm} variant="secondary" className={`text-[10px] ${perm.endsWith(":write") ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"}`}>
                        {perm}
                      </Badge>
                    ))}
                    {uniquePerms.length > 6 && (
                      <Badge variant="outline" className="text-[10px]">+{uniquePerms.length - 6}</Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Roles Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign Roles — {admins.find((a) => a.id === selectedAdminId)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No roles available. Create roles in the Role Templates tab first.
              </p>
            ) : (
              roles.map((role) => {
                const isChecked = selectedRoleIds.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedRoleIds((prev) =>
                          prev.includes(role.id)
                            ? prev.filter((id) => id !== role.id)
                            : [...prev, role.id]
                        );
                      }}
                      className="rounded border-gray-300 text-primary focus:ring-primary/30"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{role.name}</p>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {role.permissions?.length || 0} permissions
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveRoleAssignments} disabled={saving}>
              {saving ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <Dialog open={!!removeAdminId} onOpenChange={() => setRemoveAdminId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Revoke Admin Access?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will deactivate this admin account. They will no longer be able to access the admin portal.
            Their role assignments will be preserved in case you reactivate them later.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveAdminId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={removeAdminAccess} disabled={saving}>
              {saving ? "Revoking..." : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function AdminUsersPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [tabValue, setTabValue] = useState("roles");

  if (schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!schoolId) {
    return (
      <DashboardLayout role="admin">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
          Unable to determine your school context.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create role templates and assign granular permissions to admin accounts.
            Only primary admins (the school owner) can manage other admins.
          </p>
        </div>

        <Tabs value={tabValue} onValueChange={setTabValue}>
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Role Templates
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-2">
              <Check className="h-4 w-4" />
              Permission Matrix
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Users className="h-4 w-4" />
              Admin Accounts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="mt-4">
            <RoleTemplatesTab schoolId={schoolId} />
          </TabsContent>

          <TabsContent value="matrix" className="mt-4">
            <AdminPermissionMatrix
              schoolId={schoolId}
              onRefresh={() => {
                // Triggers refetch in role templates and admin accounts tabs
              }}
            />
          </TabsContent>

          <TabsContent value="admins" className="mt-4">
            <AdminAccountsTab schoolId={schoolId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
