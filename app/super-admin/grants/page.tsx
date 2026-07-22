"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
import { Switch } from "@/components/ui/switch";
import {
  Gift,
  Shield,
  School,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Ban,
  Sparkles,
  Info,
  ChevronRight,
  ArrowRight,
  FileText,
  Bell,
} from "lucide-react";
import type { SchoolPlan } from "@/lib/types";
import { usePlanDisplayInfo, PLAN_KEYS_IN_ORDER } from "@/hooks/use-plan-display-info";
import { getPlanBadgeColor } from "@/components/subscription-utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface SchoolGrant {
  id: string;
  school_id: string;
  school_name: string;
  plan_key: string;
  grant_type: "term" | "session" | "custom";
  start_date: string;
  end_date: string;
  include_holidays: boolean;
  notes: string;
  granted_by_name: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  term_name: string | null;
  session_name: string | null;
}

interface SchoolOption {
  id: string;
  name: string;
  plan: SchoolPlan;
}

interface TermOption {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
}

interface SessionOption {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatPlanLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// ── Empty form state ───────────────────────────────────────────────────────

const emptyForm = {
  school_id: "",
  plan_key: "pro" as "pro" | "premium",
  grant_type: "term" as "term" | "session" | "custom",
  term_id: "",
  session_id: "",
  start_date: "",
  end_date: "",
  include_holidays: true,
  notes: "",
};

// ============================================================================
// GrantsManagementPage
// ============================================================================

export default function GrantsManagementPage() {
  const { toast } = useToast();
  const { getPlanInfo } = usePlanDisplayInfo();

  // Data
  const [grants, setGrants] = useState<SchoolGrant[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialogs
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete / Expire
  const [deleteGrant, setDeleteGrant] = useState<SchoolGrant | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Send reminder
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Filter tabs
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");

  // ── Fetch data ────────────────────────────────────────────────────────

  const fetchGrants = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/plan-grants");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load grants");
      setGrants(data.grants ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const fetchSchools = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, plan")
        .order("name");
      if (error) throw error;
      setSchools(data ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const fetchSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, name, start_date, end_date")
        .order("start_date", { ascending: false });
      if (error) throw error;
      setSessions(data ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const fetchTermsForSchool = useCallback(async (schoolId: string) => {
    try {
      const { data, error } = await supabase
        .from("terms")
        .select(`
          id,
          name,
          start_date,
          end_date,
          sessions!inner(name)
        `)
        .eq("school_id", schoolId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      setTerms(
        (data ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          session_name: t.sessions?.name ?? "",
          start_date: t.start_date,
          end_date: t.end_date,
        }))
      );
    } catch (err: any) {
      console.error("Failed to fetch terms:", err);
      setTerms([]);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchGrants(), fetchSchools(), fetchSessions()]);
      setLoading(false);
    }
    init();
  }, [fetchGrants, fetchSchools, fetchSessions]);

  // ── When school changes in form, load terms ────────────────────────────

  useEffect(() => {
    if (form.school_id) {
      fetchTermsForSchool(form.school_id);
    } else {
      setTerms([]);
    }
  }, [form.school_id, fetchTermsForSchool]);

  // ── Open grant dialog ──────────────────────────────────────────────────

  function openGrantDialog() {
    setForm({ ...emptyForm, start_date: new Date().toISOString().split("T")[0] });
    setGrantDialogOpen(true);
  }

  // ── Handle grant form changes ──────────────────────────────────────────

  function setGrantForm(partial: Partial<typeof emptyForm>) {
    const updated = { ...form, ...partial };

    // Reset dependent fields
    if ("school_id" in partial) {
      updated.term_id = "";
    }
    if ("grant_type" in partial) {
      updated.term_id = "";
      updated.session_id = "";
    }

    // Auto-fill dates based on grant type
    if (updated.grant_type === "term") {
      const term = terms.find((t) => t.id === updated.term_id);
      if (term) {
        updated.start_date = term.start_date;
        updated.end_date = term.end_date;
      } else {
        updated.start_date = "";
        updated.end_date = "";
      }
    } else if (updated.grant_type === "session") {
      const session = sessions.find((s) => s.id === updated.session_id);
      if (session) {
        updated.start_date = session.start_date.split("T")[0];
        updated.end_date = session.end_date.split("T")[0];
      } else {
        updated.start_date = "";
        updated.end_date = "";
      }
    }

    setForm(updated);
  }

  // ── Calculate duration display ─────────────────────────────────────────

  function getDurationDays(): number {
    if (!form.start_date || !form.end_date) return 0;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  function getDurationLabel(): string {
    const days = getDurationDays();
    if (days === 0) return "";
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    const parts: string[] = [];
    if (weeks > 0) parts.push(`${weeks} week${weeks > 1 ? "s" : ""}`);
    if (remainingDays > 0) parts.push(`${remainingDays} day${remainingDays > 1 ? "s" : ""}`);
    return parts.join(" ");
  }

  // ── Submit grant ───────────────────────────────────────────────────────

  async function handleGrant() {
    if (!form.school_id) {
      toast({ title: "Validation", description: "Please select a school.", variant: "destructive" });
      return;
    }
    if (!form.start_date || !form.end_date) {
      toast({ title: "Validation", description: "Start and end dates are required.", variant: "destructive" });
      return;
    }
    if (form.grant_type === "term" && !form.term_id) {
      toast({ title: "Validation", description: "Please select a term.", variant: "destructive" });
      return;
    }
    if (form.grant_type === "session" && !form.session_id) {
      toast({ title: "Validation", description: "Please select a session.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/super-admin/schools/${form.school_id}/grant-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Failed to create grant");

      toast({
        title: "Plan Granted!",
        description: data.message,
      });

      setGrantDialogOpen(false);
      setForm(emptyForm);
      await fetchGrants();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Expire a grant ────────────────────────────────────────────────────

  async function handleExpireGrant() {
    if (!deleteGrant) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/super-admin/plan-grants?id=${deleteGrant.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to expire grant");

      toast({
        title: "Grant Expired",
        description: `The ${formatPlanLabel(deleteGrant.plan_key)} grant for ${deleteGrant.school_name} has been expired.`,
      });
      setDeleteGrant(null);
      await fetchGrants();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  // ── Send reminder for a single grant ──────────────────────────────────

  async function handleSendReminder(grant: SchoolGrant) {
    setSendingReminder(grant.id);
    try {
      const res = await fetch(`/api/super-admin/plan-grants/${grant.id}/send-reminder`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to send reminder");

      toast({
        title: "✅ Reminder sent",
        description: data.message,
      });
    } catch (err: any) {
      toast({
        title: "❌ Failed to send reminder",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSendingReminder(null);
    }
  }

  // ── Filtered grants ────────────────────────────────────────────────────

  const filteredGrants = grants.filter((g) => {
    const matchesSearch =
      !search ||
      g.school_name.toLowerCase().includes(search.toLowerCase()) ||
      g.plan_key.toLowerCase().includes(search.toLowerCase());

    const now = new Date();
    const expiresAt = new Date(g.expires_at);
    if (filter === "active") return matchesSearch && g.is_active && expiresAt > now;
    if (filter === "expired") return matchesSearch && (!g.is_active || expiresAt <= now);
    return matchesSearch;
  });

  // Calculate stats
  const activeGrantCount = grants.filter(
    (g) => g.is_active && new Date(g.expires_at) > new Date()
  ).length;
  const totalGrantCount = grants.length;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Gift className="h-7 w-7 text-purple-500" />
            Plan Grants
          </h1>
          <p className="text-muted-foreground mt-1">
            Manually grant Pro or Premium plans to schools for cash/direct payment scenarios
          </p>
        </div>
        <Button onClick={openGrantDialog} className="bg-purple-600 hover:bg-purple-700 transition-all duration-200 shadow-sm hover:shadow-md">
          <Plus className="h-4 w-4 mr-2" />
          New Grant
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Grants</p>
                <p className="text-2xl font-bold">{loading ? "..." : totalGrantCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Active Grants</p>
                <p className="text-2xl font-bold">{loading ? "..." : activeGrantCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Expiring in 30 days</p>
                <p className="text-2xl font-bold">
                  {loading
                    ? "..."
                    : grants.filter(
                        (g) =>
                          g.is_active &&
                          new Date(g.expires_at) > new Date() &&
                          daysRemaining(g.expires_at) <= 30
                      ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by school or plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 bg-muted/60 rounded-lg p-1">
              {([
                { id: "all" as const, label: `All (${totalGrantCount})` },
                { id: "active" as const, label: `Active (${activeGrantCount})` },
                { id: "expired" as const, label: `Expired (${totalGrantCount - activeGrantCount})` },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    filter === tab.id
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grants Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Grant History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredGrants.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Gift className="h-12 w-12 mb-4 opacity-40" />
              <p className="font-medium">
                {search || filter !== "all" ? "No grants match your filters." : "No plan grants yet."}
              </p>
              <p className="text-sm mt-1 mb-4">
                {search || filter !== "all"
                  ? "Try adjusting your search or filter."
                  : "Create your first manual grant when a school pays cash or transfers directly."}
              </p>
              {!search && filter === "all" && (
                <Button variant="outline" size="sm" onClick={openGrantDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Grant
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Granted By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrants.map((grant) => {
                    const planInfo = getPlanInfo(grant.plan_key);
                    const daysLeft = grant.is_active ? daysRemaining(grant.expires_at) : 0;
                    const isExpired = !grant.is_active || daysLeft === 0;
                    const isExpiringSoon = grant.is_active && daysLeft > 0 && daysLeft <= 30;

                    return (
                      <TableRow
                        key={grant.id}
                        className="transition-colors duration-150 hover:bg-muted/30"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <School className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{grant.school_name}</p>
                              {grant.notes && (
                                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                  {grant.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPlanBadgeColor(grant.plan_key)}>
                            <Shield className="h-3 w-3 mr-1" />
                            {planInfo.label_short}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {grant.grant_type === "term"
                              ? grant.term_name || "Term"
                              : grant.grant_type === "session"
                              ? grant.session_name || "Session"
                              : "Custom"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(grant.start_date)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <ArrowRight className="h-3 w-3" />
                              <span>{formatDate(grant.end_date)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {daysLeft > 0
                              ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isExpired ? (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              <Ban className="h-3 w-3 mr-1" />
                              Expired
                            </Badge>
                          ) : isExpiringSoon ? (
                            <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expiring Soon
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {grant.granted_by_name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {grant.is_active && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Send Expiry Reminder"
                                  onClick={() => handleSendReminder(grant)}
                                  disabled={sendingReminder === grant.id}
                                >
                                  {sendingReminder === grant.id ? (
                                    <Loader2 className="h-4 w-4 text-pink-500 animate-spin" />
                                  ) : (
                                    <Bell className="h-4 w-4 text-pink-500" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Expire Grant"
                                  onClick={() => setDeleteGrant(grant)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Grant Dialog ─────────────────────────────────────────── */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Gift className="h-5 w-5 text-purple-500" />
              Grant Plan to School
            </DialogTitle>
            <DialogDescription>
              Manually assign a Pro or Premium plan when payment is made via cash or bank transfer.
              The school&apos;s features will be unlocked immediately for the specified period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 max-h-[60vh] overflow-y-auto pr-2">
            {/* School Select */}
            <div className="space-y-2">
              <Label htmlFor="grant-school" className="text-sm font-medium">School *</Label>
              <Select
                value={form.school_id}
                onValueChange={(v) => setGrantForm({ school_id: v })}
              >
                <SelectTrigger id="grant-school" className="w-full">
                  <SelectValue placeholder="Select a school..." />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      <div className="flex items-center gap-2">
                        <School className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{school.name}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
                          {getPlanInfo(school.plan).label_short}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plan Select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Plan *</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["pro", "premium"] as const).map((plan) => {
                  const info = getPlanInfo(plan);
                  const isSelected = form.plan_key === plan;
                  return (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => setGrantForm({ plan_key: plan })}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                        isSelected
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-card hover:shadow-sm"
                      }`}
                    >
                      <Shield className={`h-6 w-6 ${plan === "pro" ? "text-blue-600" : "text-purple-600"}`} />
                      <span className="text-sm font-semibold">{info.label_short}</span>
                      <span className="text-xs text-muted-foreground">{info.price_hint}</span>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="h-4 w-4 text-purple-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grant Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Duration Type *</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "term" as const, label: "Term", icon: <Calendar className="h-4 w-4" />, desc: "Single term" },
                  { id: "session" as const, label: "Session", icon: <Sparkles className="h-4 w-4" />, desc: "Full academic year" },
                  { id: "custom" as const, label: "Custom", icon: <Clock className="h-4 w-4" />, desc: "Arbitrary range" },
                ]).map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      const partial: Partial<typeof emptyForm> = { grant_type: type.id };
                      if (type.id === "custom") {
                        partial.term_id = "";
                        partial.session_id = "";
                      }
                      setGrantForm(partial);
                    }}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all duration-200 ${
                      form.grant_type === type.id
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-card"
                    }`}
                  >
                    <div className={form.grant_type === type.id ? "text-purple-600" : "text-muted-foreground"}>
                      {type.icon}
                    </div>
                    <span className="text-xs font-medium">{type.label}</span>
                    <span className="text-[10px] text-muted-foreground">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Term/Session selectors */}
            {form.grant_type === "term" && (
              <div className="space-y-2">
                <Label htmlFor="grant-term">Select Term *</Label>
                <Select
                  value={form.term_id}
                  onValueChange={(v) => setGrantForm({ term_id: v })}
                >
                  <SelectTrigger id="grant-term">
                    <SelectValue placeholder={form.school_id ? "Choose a term..." : "Select a school first..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {form.school_id ? "No terms found for this school" : "Select a school first"}
                      </div>
                    ) : (
                      terms.map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{term.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({term.session_name})
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatDate(term.start_date)} – {formatDate(term.end_date)}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.grant_type === "session" && (
              <div className="space-y-2">
                <Label htmlFor="grant-session">Select Session *</Label>
                <Select
                  value={form.session_id}
                  onValueChange={(v) => setGrantForm({ session_id: v })}
                >
                  <SelectTrigger id="grant-session">
                    <SelectValue placeholder="Choose a session..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{session.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {formatDate(session.start_date.split("T")[0])} – {formatDate(session.end_date.split("T")[0])}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Range */}
            {form.grant_type === "custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grant-start">Start Date *</Label>
                  <Input
                    id="grant-start"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setGrantForm({ start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grant-end">End Date *</Label>
                  <Input
                    id="grant-end"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setGrantForm({ end_date: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Duration Summary + Include Holidays */}
            {form.start_date && form.end_date && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold">{getDurationLabel()}</span>
                </div>
                {form.grant_type !== "custom" && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Include holidays</span>
                    </div>
                    <Switch
                      checked={form.include_holidays}
                      onCheckedChange={(checked) => setGrantForm({ include_holidays: checked })}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-1 border-t">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold capitalize">{form.plan_key}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="grant-notes">Notes (optional)</Label>
              <Input
                id="grant-notes"
                placeholder="e.g., Paid cash on June 15, 2026 — ₦99,700"
                value={form.notes}
                onChange={(e) => setGrantForm({ notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setGrantDialogOpen(false);
                setForm(emptyForm);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGrant}
              disabled={
                saving ||
                !form.school_id ||
                !form.start_date ||
                !form.end_date ||
                (form.grant_type === "term" && !form.term_id) ||
                (form.grant_type === "session" && !form.session_id)
              }
              className="bg-purple-600 hover:bg-purple-700 min-w-[140px]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Granting...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-2" />
                  Grant Plan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Expire Grant Confirmation ────────────────────────────────────── */}
      <AlertDialog open={!!deleteGrant} onOpenChange={() => !deleting && setDeleteGrant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Expire Grant?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will expire the <strong>{formatPlanLabel(deleteGrant?.plan_key ?? "")}</strong> grant for{" "}
              <strong>{deleteGrant?.school_name}</strong>. If no other active grants exist, the school will
              be downgraded to the Basic plan and lose access to paid features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">School</span>
              <span className="font-medium">{deleteGrant?.school_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium capitalize">{deleteGrant?.plan_key}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span className="font-medium">{deleteGrant ? formatDate(deleteGrant.end_date) : ""}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expires At</span>
              <span className="font-medium">{deleteGrant ? formatDate(deleteGrant.expires_at) : ""}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExpireGrant}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Expiring...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Expire Grant
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
