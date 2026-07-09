"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Check,
  X,
  Save,
  Shield,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PERMISSION_GROUPS } from "@/lib/admin-permissions";
import type { AdminRole, AdminPermission } from "@/lib/types";

interface Props {
  schoolId: string;
  onRefresh: () => void;
}

export function AdminPermissionMatrix({ schoolId, onRefresh }: Props) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);

  // roleId → Set<permission string>
  const [permsState, setPermsState] = useState<Map<string, Set<string>>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Keep a ref of the original state to detect changes
  const originalRef = useRef<Map<string, Set<string>>>(new Map());

  const fetchRoles = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_roles")
        .select("*")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });

      if (error) throw error;
      const roleList = (data ?? []) as AdminRole[];
      setRoles(roleList);

      const state = new Map<string, Set<string>>();
      for (const role of roleList) {
        state.set(role.id, new Set(role.permissions || []));
      }
      setPermsState(state);
      originalRef.current = new Map();
      for (const [id, perms] of state) {
        originalRef.current.set(id, new Set(perms));
      }

      // Default: expand first group
      if (PERMISSION_GROUPS.length > 0) {
        setExpandedGroups(new Set([PERMISSION_GROUPS[0].namespace]));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const hasChanges = useMemo(() => {
    const orig = originalRef.current;
    if (orig.size === 0) return false;
    if (orig.size !== permsState.size) return true;
    for (const [roleId, currentPerms] of permsState) {
      const origPerms = orig.get(roleId);
      if (!origPerms) return true;
      if (currentPerms.size !== origPerms.size) return true;
      for (const p of currentPerms) {
        if (!origPerms.has(p)) return true;
      }
    }
    return false;
  }, [permsState]);

  // ── Toggle helpers ──

  function togglePermission(roleId: string, permission: string) {
    setPermsState((prev) => {
      const next = new Map(prev);
      const set = new Set(prev.get(roleId));
      if (set.has(permission)) {
        set.delete(permission);
      } else {
        set.add(permission);
      }
      next.set(roleId, set);
      return next;
    });
  }

  /** Toggle a permission across ALL roles at once */
  function togglePermissionForAllRoles(permission: string) {
    setPermsState((prev) => {
      const next = new Map(prev);
      const allHaveIt = roles.every((r) => prev.get(r.id)?.has(permission));
      for (const role of roles) {
        const set = new Set(prev.get(role.id));
        if (allHaveIt) {
          set.delete(permission);
        } else {
          set.add(permission);
        }
        next.set(role.id, set);
      }
      return next;
    });
  }

  /** Toggle all permissions for a single role */
  function toggleAllForRole(roleId: string) {
    const ALL_POSSIBLE_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) =>
      g.permissions.map((p) => p.permission)
    );
    setPermsState((prev) => {
      const next = new Map(prev);
      const current = prev.get(roleId) ?? new Set();
      const allSelected = ALL_POSSIBLE_PERMISSIONS.every((p) => current.has(p));

      const newSet = allSelected ? new Set<string>() : new Set(ALL_POSSIBLE_PERMISSIONS);
      next.set(roleId, newSet);
      return next;
    });
  }

  /** Toggle a whole permission group for a role */
  function toggleGroupForRole(roleId: string, groupPerms: string[]) {
    setPermsState((prev) => {
      const next = new Map(prev);
      const set = new Set(prev.get(roleId));
      const allSelected = groupPerms.every((p) => set.has(p));
      for (const p of groupPerms) {
        if (allSelected) set.delete(p);
        else set.add(p);
      }
      next.set(roleId, set);
      return next;
    });
  }

  /** Toggle a group across all roles */
  function toggleGroupForAllRoles(groupPerms: string[]) {
    setPermsState((prev) => {
      const next = new Map(prev);
      const allHaveAll = roles.every((r) =>
        groupPerms.every((p) => prev.get(r.id)?.has(p))
      );
      for (const role of roles) {
        const set = new Set(prev.get(role.id));
        for (const p of groupPerms) {
          if (allHaveAll) set.delete(p);
          else set.add(p);
        }
        next.set(role.id, set);
      }
      return next;
    });
  }

  // ── Save ──

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Promise<any>[] = [];
      for (const [roleId, currentPerms] of permsState) {
        const origPerms = originalRef.current.get(roleId);
        if (!origPerms) continue;

        // Compare
        const currentArr = [...currentPerms].sort();
        const origArr = [...origPerms].sort();
        if (currentArr.join(",") === origArr.join(",")) continue;

        updates.push(
          supabase
            .from("admin_roles")
            .update({ permissions: currentArr })
            .eq("id", roleId)
        );
      }

      if (updates.length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      const results = await Promise.all(updates);
      for (const result of results) {
        if (result.error) throw result.error;
      }

      toast.success(`Updated ${updates.length} role${updates.length > 1 ? "s" : ""}`);
      originalRef.current = new Map();
      for (const [id, perms] of permsState) {
        originalRef.current.set(id, new Set(perms));
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading state ──

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="font-semibold text-lg mb-1">No roles yet</h3>
        <p className="text-sm text-muted-foreground">
          Create roles in the Role Templates tab first, then use the matrix to
          fine-tune permissions across all roles at once.
        </p>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Permission Matrix</h2>
          <p className="text-sm text-muted-foreground">
            Manage permissions across all roles. Rows are permissions, columns are roles.
            Click any cell to toggle.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
        </Button>
      </div>

      {/* Matrix table — desktop */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 px-4 py-3 text-left font-semibold min-w-[200px]">
                Permission
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  className="px-3 py-3 text-center font-semibold min-w-[120px]"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="truncate text-xs max-w-[110px]">
                      {role.name}
                    </span>
                    <button
                      onClick={() => toggleAllForRole(role.id)}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                      title="Toggle all permissions for this role"
                    >
                      toggle all
                    </button>
                  </div>
                </th>
              ))}
              {/* All-roles toggle column */}
              <th className="px-3 py-3 text-center min-w-[60px]">
                <span className="text-xs text-muted-foreground">All</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => {
              const isExpanded = expandedGroups.has(group.namespace);
              return (
                <>
                  {/* Group header row */}
                  <tr
                    key={group.namespace}
                    className="border-b bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => {
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.namespace)) {
                          next.delete(group.namespace);
                        } else {
                          next.add(group.namespace);
                        }
                        return next;
                      });
                    }}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{group.icon}</span>
                        <span className="font-semibold">{group.label}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {group.permissions.length} perm{group.permissions.length > 1 ? "s" : ""}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                        )}
                      </div>
                    </td>
                    {roles.map((role) => {
                      const selectedCount = group.permissions.filter((p) =>
                        permsState.get(role.id)?.has(p.permission)
                      ).length;
                      const allSelected = selectedCount === group.permissions.length;
                      return (
                        <td key={role.id} className="px-3 py-2.5 text-center">
                          {allSelected ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : selectedCount > 0 ? (
                            <div className="h-4 w-4 rounded bg-amber-200 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                          )}
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            {selectedCount}/{group.permissions.length}
                          </span>
                        </td>
                      );
                    })}
                    {/* All-roles group toggle */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroupForAllRoles(
                            group.permissions.map((p) => p.permission)
                          );
                        }}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                      >
                        toggle
                      </button>
                    </td>
                  </tr>

                  {/* Expanded permission rows */}
                  {isExpanded &&
                    group.permissions.map((permDef) => {
                      const perm = permDef.permission;
                      return (
                        <tr
                          key={perm}
                          className="border-b hover:bg-muted/10 transition-colors"
                        >
                          <td className="px-4 py-2 pl-10">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {permDef.label}
                              </span>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${
                                  perm.endsWith(":write")
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                    : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                }`}
                              >
                                {perm.split(":")[1]}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground pl-0 mt-0.5">
                              {permDef.description}
                            </p>
                          </td>
                          {roles.map((role) => {
                            const isChecked = permsState.get(role.id)?.has(perm) ?? false;
                            return (
                              <td
                                key={role.id}
                                className="px-3 py-2 text-center"
                              >
                                <label className="inline-flex items-center justify-center cursor-pointer w-8 h-8 rounded-md hover:bg-muted/30 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      togglePermission(role.id, perm)
                                    }
                                    className="rounded border-gray-300 text-primary focus:ring-primary/30 cursor-pointer"
                                  />
                                </label>
                              </td>
                            );
                          })}
                          {/* All-roles toggle for this permission */}
                          <td className="px-3 py-2 text-center">
                            <label className="inline-flex items-center justify-center cursor-pointer w-8 h-8 rounded-md hover:bg-muted/30 transition-colors">
                              <input
                                type="checkbox"
                                checked={roles.every((r) =>
                                  permsState.get(r.id)?.has(perm)
                                )}
                                onChange={() => togglePermissionForAllRoles(perm)}
                                className="rounded border-gray-300 text-primary focus:ring-primary/30 cursor-pointer"
                              />
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: role cards */}
      <div className="md:hidden space-y-4">
        {roles.map((role) => {
          const rolePerms = permsState.get(role.id) ?? new Set();
          return (
            <div
              key={role.id}
              className="rounded-lg border bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                <span className="font-semibold text-sm">{role.name}</span>
                <button
                  onClick={() => toggleAllForRole(role.id)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                >
                  toggle all
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                {PERMISSION_GROUPS.map((group) => {
                  const groupPerms = group.permissions.map((p) => p.permission);
                  const allSelected = groupPerms.every((p) => rolePerms.has(p));
                  return (
                    <div key={group.namespace}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{group.icon}</span>
                          <span className="text-xs font-medium">
                            {group.label}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleGroupForRole(role.id, groupPerms)}
                          className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          {allSelected ? "deselect all" : "select all"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.permissions.map((p) => {
                          const isChecked = rolePerms.has(p.permission);
                          return (
                            <label
                              key={p.permission}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? p.permission.endsWith(":write")
                                    ? "bg-blue-50 border-blue-200 text-blue-700"
                                    : "bg-green-50 border-green-200 text-green-700"
                                  : "bg-muted/20 border-transparent text-muted-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  togglePermission(role.id, p.permission)
                                }
                                className="sr-only"
                              />
                              {p.label}
                              {isChecked && <Check className="h-3 w-3" />}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
