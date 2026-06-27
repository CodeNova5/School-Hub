"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  School,
  Pencil,
  PauseCircle,
  PlayCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Shield,
  Zap,
} from "lucide-react";
import type { School as SchoolType, SchoolPlan } from "@/lib/types";
import { usePlanDisplayInfo, PLAN_KEYS_IN_ORDER } from "@/hooks/use-plan-display-info";

interface SchoolWithStats extends SchoolType {
  studentCount?: number;
  teacherCount?: number;
}

const emptyForm = { name: "", subdomain: "", address: "", phone: "", email: "", plan: 'basic' as SchoolPlan };

export default function SchoolsManagementPage() {
  const { toast } = useToast();
  const { getPlanInfo, isLoading: plansLoading } = usePlanDisplayInfo();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Create / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolWithStats | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Suspend/Delete/Charge confirm
  const [confirmSchool, setConfirmSchool] = useState<SchoolWithStats | null>(null);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "activate" | "delete" | "charge" | null>(null);
  const [charging, setCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [chargePreview, setChargePreview] = useState<{
    plan_name: string;
    billing_interval: string;
    amount: number;
  } | null>(null);
  const [chargePreviewLoading, setChargePreviewLoading] = useState(false);

  useEffect(() => {
    fetchSchools();
  }, []);

  async function fetchSchools() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched: SchoolWithStats[] = await Promise.all(
        (data ?? []).map(async (school: SchoolType) => {
          const [{ count: studentCount }, { count: teacherCount }] = await Promise.all([
            supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", school.id),
            supabase.from("teachers").select("*", { count: "exact", head: true }).eq("school_id", school.id),
          ]);
          return { ...school, studentCount: studentCount ?? 0, teacherCount: teacherCount ?? 0 };
        })
      );

      setSchools(enriched);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingSchool(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(school: SchoolWithStats) {
    setEditingSchool(school);
    setForm({
      name: school.name,
      subdomain: school.subdomain ?? "",
      address: school.address ?? "",
      phone: school.phone ?? "",
      email: school.email ?? "",
      plan: school.plan ?? 'basic',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Validation", description: "School name is required.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);

      if (editingSchool) {
        // Update — use PATCH API for plan changes (it has validation)
        const res = await fetch(`/api/super-admin/schools/${editingSchool.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            subdomain: form.subdomain.trim() || null,
            address: form.address.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            plan: form.plan,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error ?? "Failed to update school");
        toast({ title: "Saved", description: "School updated successfully." });
      } else {
        // Create via API (to handle admin user setup if needed)
        const res = await fetch("/api/super-admin/schools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error ?? "Failed to create school");
        toast({ title: "Created", description: `School "${form.name}" created successfully.` });
      }

      setDialogOpen(false);
      fetchSchools();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmSchool || !confirmAction) return;

    if (confirmAction === "charge") {
      setCharging(true);
      setChargeResult(null);
      try {
        const res = await fetch(`/api/super-admin/schools/${confirmSchool.id}/charge`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setChargeResult({ success: false, message: data.error || "Charge failed" });
        } else if (data.success) {
          setChargeResult({
            success: true,
            message: `✅ Charged ₦${(data.amount / 100).toLocaleString()} — ${data.school}`,
          });
          fetchSchools();
        } else {
          setChargeResult({
            success: false,
            message: `❌ Charge failed: ${data.gateway_response || data.message}`,
          });
        }
      } catch (err: any) {
        setChargeResult({ success: false, message: err.message || "Charge failed" });
      } finally {
        setCharging(false);
      }
      return;
    }

    try {
      setSaving(true);

      if (confirmAction === "delete") {
        const res = await fetch(`/api/super-admin/schools/${confirmSchool.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const r = await res.json();
          throw new Error(r.error ?? "Failed to delete school");
        }
        toast({ title: "Deleted", description: `School "${confirmSchool.name}" deleted.` });
      } else {
        const isActive = confirmAction === "activate";
        const { error } = await supabase
          .from("schools")
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq("id", confirmSchool.id);
        if (error) throw error;
        toast({
          title: isActive ? "Activated" : "Suspended",
          description: `School "${confirmSchool.name}" has been ${isActive ? "activated" : "suspended"}.`,
        });
      }

      setConfirmSchool(null);
      setConfirmAction(null);
      fetchSchools();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const filtered = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.subdomain ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schools</h1>
          <p className="text-muted-foreground mt-1">
            {schools.length} school{schools.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          Add School
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search schools by name or subdomain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Schools ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <School className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{search ? "No schools match your search." : "No schools yet. Create one!"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Subdomain</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Teachers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{school.name}</p>
                          {school.email && (
                            <p className="text-xs text-muted-foreground">{school.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {school.subdomain ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {school.subdomain}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{school.studentCount ?? 0}</TableCell>
                      <TableCell className="text-right">{school.teacherCount ?? 0}</TableCell>
                      <TableCell>
                        <Badge
                          variant={school.is_active ? "default" : "secondary"}
                          className={school.is_active ? "bg-green-500" : ""}
                        >
                          {school.is_active ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />Suspended
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getPlanInfo(school.plan ?? 'basic').badge_color}
                        >
                          {getPlanInfo(school.plan ?? 'basic').label_short}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => openEditDialog(school)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {school.is_active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Suspend"
                              onClick={() => {
                                setConfirmSchool(school);
                                setConfirmAction("suspend");
                              }}
                            >
                              <PauseCircle className="h-4 w-4 text-amber-500" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Activate"
                              onClick={() => {
                                setConfirmSchool(school);
                                setConfirmAction("activate");
                              }}
                            >
                              <PlayCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Charge Now"
                            onClick={async () => {
                              setChargeResult(null);
                              setChargePreview(null);
                              setChargePreviewLoading(true);
                              setConfirmSchool(school);
                              setConfirmAction("charge");
                              // Fetch subscription preview info
                              try {
                                const { data: sub } = await supabase
                                  .rpc("get_school_subscription", { p_school_id: school.id });
                                const subscription = Array.isArray(sub) ? sub[0] : sub;
                                if (subscription) {
                                  const amount = subscription.billing_interval === "termly"
                                    ? subscription.termly_price
                                    : subscription.yearly_price;
                                  setChargePreview({
                                    plan_name: subscription.plan_name,
                                    billing_interval: subscription.billing_interval,
                                    amount: Number(amount) || 0,
                                  });
                                }
                              } catch (err) {
                                console.error("Failed to fetch subscription preview:", err);
                              } finally {
                                setChargePreviewLoading(false);
                              }
                            }}
                          >
                            <Zap className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => {
                              setConfirmSchool(school);
                              setConfirmAction("delete");
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSchool ? "Edit School" : "Add New School"}</DialogTitle>
            <DialogDescription>
              {editingSchool
                ? "Update the school details below."
                : "Fill in the details to register a new school on the platform."}
            </DialogDescription>
          </DialogHeader>            <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="s-name">School Name *</Label>
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Greenfield Academy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-subdomain">Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="s-subdomain"
                  value={form.subdomain}
                  onChange={(e) =>
                    setForm({ ...form, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                  }
                  placeholder="greenfield"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">.myapp.com</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, numbers and hyphens.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Contact Email</Label>
              <Input
                id="s-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@greenfield.edu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-phone">Phone</Label>
              <Input
                id="s-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+234 800 000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-address">Address</Label>
              <Input
                id="s-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 School Road, Lagos"
              />
            </div>
            {/* Plan selector — only shown when editing */}
            {editingSchool && (
              <div className="space-y-2">
                <Label htmlFor="s-plan">Subscription Plan</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PLAN_KEYS_IN_ORDER.map((plan) => {
                    const info = getPlanInfo(plan);
                    const isSelected = form.plan === plan;
                    return (
                      <button
                        key={plan}
                        type="button"
                        onClick={() => setForm({ ...form, plan: plan as SchoolPlan })}
                        className={`relative flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-center transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                            : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
                        }`}
                      >
                        <Shield className={`h-5 w-5 ${info.color}`} />
                        <span className="text-sm font-semibold">{info.label_short}</span>
                        <span className="text-xs text-muted-foreground">{info.price_hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchool ? "Save Changes" : "Create School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog
        open={!!confirmSchool && !!confirmAction && confirmAction !== "charge"}
        onOpenChange={() => {
          setConfirmSchool(null);
          setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "delete"
                ? "Delete School"
                : confirmAction === "suspend"
                ? "Suspend School"
                : "Activate School"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "delete" ? (
                <>
                  This will <strong>permanently delete</strong> &ldquo;{confirmSchool?.name}&rdquo; and{" "}
                  <strong>all associated data</strong> (students, teachers, results, etc.). This action
                  cannot be undone.
                </>
              ) : confirmAction === "suspend" ? (
                <>
                  Suspending &ldquo;{confirmSchool?.name}&rdquo; will prevent all users of this school
                  from logging in. You can re-activate it at any time.
                </>
              ) : (
                <>
                  Re-activating &ldquo;{confirmSchool?.name}&rdquo; will restore access for all users.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={saving}
              className={
                confirmAction === "delete"
                  ? "bg-red-600 hover:bg-red-700"
                  : confirmAction === "suspend"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction === "delete"
                ? "Delete"
                : confirmAction === "suspend"
                ? "Suspend"
                : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Charge Dialog (separate, with result states) */}
      <AlertDialog
        open={!!confirmSchool && confirmAction === "charge"}
        onOpenChange={() => {
          if (!charging) {
            setConfirmSchool(null);
            setConfirmAction(null);
            setChargeResult(null);
            setChargePreview(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {chargeResult ? (
                chargeResult.success ? "Charge Successful" : "Charge Failed"
              ) : (
                <>Charge {confirmSchool?.name}?</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {chargeResult ? (
                <span className={chargeResult.success ? "text-green-600" : "text-red-600"}>
                  {chargeResult.message}
                </span>
              ) : charging ? (
                <div className="flex items-center gap-3 py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span>Charging stored authorization code...</span>
                </div>
              ) : chargePreviewLoading ? (
                <div className="flex items-center gap-3 py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span>Loading subscription details...</span>
                </div>
              ) : chargePreview ? (
                <div className="space-y-4 py-2">
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">School</span>
                      <span className="text-sm font-semibold">{confirmSchool?.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Plan</span>
                      <span className="text-sm font-semibold capitalize">
                        {chargePreview.plan_name}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({chargePreview.billing_interval === "termly" ? "Per Term" : "Yearly"})
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium">Amount to charge</span>
                      <span className="text-lg font-bold text-blue-600">
                        ₦{(chargePreview.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will charge the school&apos;s stored payment method. The money goes to the platform&apos;s Paystack account.
                  </p>
                </div>
              ) : (
                <>
                  This will charge the school&apos;s stored payment method for their current subscription.
                  The money goes to the platform&apos;s Paystack account.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {chargeResult ? (
              <AlertDialogAction
                onClick={() => {
                  setConfirmSchool(null);
                  setConfirmAction(null);
                  setChargeResult(null);
                }}
              >
                Done
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel disabled={charging}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmAction}
                  disabled={charging}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {charging ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Charging...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" /> Charge Now</>
                  )}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
