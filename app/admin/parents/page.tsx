"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  Save,
  Search,
  Users,
  RefreshCw,
  Plus,
  LayoutGrid,
  Table2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParentStudent {
  id: string;
  student_id: string | null;
  name: string;
  class_name: string | null;
}

interface ParentSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  student_count: number;
  family_count: number;
  relationships: string[];
  students: ParentStudent[];
}

type EditForm = { name: string; email: string; phone: string; is_active: boolean };

const EMPTY_FORM: EditForm = { name: "", email: "", phone: "", is_active: false };

function formFromParent(p: ParentSummary): EditForm {
  return { name: p.name, email: p.email, phone: p.phone ?? "", is_active: p.is_active };
}

// ---------------------------------------------------------------------------
// Shared edit fields — used in both split-pane and dialog
// ---------------------------------------------------------------------------

function ParentEditFields({
  form,
  onChange,
}: {
  form: EditForm;
  onChange: (patch: Partial<EditForm>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="field-name" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Full Name
        </Label>
        <Input
          id="field-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="mt-1.5 h-10"
        />
      </div>

      <div>
        <Label htmlFor="field-email" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Email
        </Label>
        <Input
          id="field-email"
          type="email"
          value={form.email}
          onChange={(e) => onChange({ email: e.target.value })}
          className="mt-1.5 h-10"
        />
      </div>

      <div>
        <Label htmlFor="field-phone" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Phone
        </Label>
        <Input
          id="field-phone"
          value={form.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          className="mt-1.5 h-10"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          {form.is_active ? (
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-900">Account status</p>
            <p className="text-xs text-slate-500">Deactivating disables portal access.</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={form.is_active ? "default" : "outline"}
          className={form.is_active ? "bg-emerald-600 hover:bg-emerald-700 min-w-[90px]" : "min-w-[90px]"}
          onClick={() => onChange({ is_active: !form.is_active })}
        >
          {form.is_active ? "Active" : "Suspended"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminParentsPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [parents, setParents] = useState<ParentSummary[]>([]);
  const [totals, setTotals] = useState<{ parents: number; families: number } | null>(null);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);

  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedParent = useMemo(
    () => parents.find((p) => p.id === selectedParentId) ?? null,
    [parents, selectedParentId]
  );

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadParents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      params.set("page", String(meta.page));
      params.set("pageSize", String(meta.pageSize));

      const res = await fetch(`/api/admin/parents?${params}`);
      const payload = await res.json();

      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to load parents");

      const fetched: ParentSummary[] = payload.data.parents ?? [];
      setParents(fetched);
      if (payload.data.totals) setTotals(payload.data.totals);
      if (payload.data.meta) setMeta((m) => ({ ...m, ...payload.data.meta }));

      if (fetched.length > 0) {
        const stillVisible = selectedParentId && fetched.some((p) => p.id === selectedParentId);
        if (!stillVisible) {
          setSelectedParentId(fetched[0].id);
          setEditForm(formFromParent(fetched[0]));
        }
      } else {
        setSelectedParentId(null);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Unable to load parents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, meta.page, meta.pageSize, selectedParentId, toast]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setMeta((m) => ({ ...m, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadParents();
  }, [debouncedSearch, meta.page, meta.pageSize]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  function selectParent(parent: ParentSummary) {
    setSelectedParentId(parent.id);
    setEditForm(formFromParent(parent));
    if (window.innerWidth < 1280) setDialogOpen(true);
  }

  // Keep selectedIndex in sync with selectedParentId
  useEffect(() => {
    if (!selectedParentId) { setSelectedIndex(-1); return; }
    setSelectedIndex(parents.findIndex((p) => p.id === selectedParentId));
  }, [selectedParentId, parents]);

  // Scroll focused row into view
  useEffect(() => {
    rowRefs.current[selectedIndex]?.focus();
  }, [selectedIndex]);

  // Keyboard navigation for card/table list
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!parents.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.min(parents.length - 1, Math.max(0, i + 1));
        const p = parents[next];
        if (p) { setSelectedParentId(p.id); setEditForm(formFromParent(p)); }
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => {
        const prev = Math.max(0, i - 1);
        const p = parents[prev];
        if (p) { setSelectedParentId(p.id); setEditForm(formFromParent(p)); }
        return prev;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = parents[selectedIndex];
      if (p) selectParent(p);
    }
  }, [parents, selectedIndex]);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function saveParent() {
    if (!selectedParent) return;
    try {
      setSaving(true);
      const res = await fetch("/api/admin/parents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedParent.id, ...editForm }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to update parent");
      toast({ title: "Saved", description: "Parent updated successfully." });
      setDialogOpen(false);
      await loadParents();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Unable to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => ({
    total: totals?.parents ?? parents.length,
    active: parents.filter((p) => p.is_active).length,
    students: parents.reduce((n, p) => n + p.student_count, 0),
  }), [parents, totals]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const StatusBadge = ({ active }: { active: boolean }) => (
    <Badge
      variant={active ? "default" : "secondary"}
      className={active ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50" : ""}
    >
      {active ? "Active" : "Suspended"}
    </Badge>
  );

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout role="admin">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">

        {/* ── Page header ── */}
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <Users className="h-6 w-6 text-indigo-200" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Parents & Guardians</CardTitle>
                <CardDescription className="text-slate-300 mt-1">
                  Manage guardian profiles, account status, and student links.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-3 bg-slate-50/50 border-t border-slate-100">
            {[
              { label: "Total Parents", value: stats.total, color: "text-slate-900" },
              { label: "Active", value: stats.active, color: "text-emerald-600" },
              { label: "Linked Students", value: stats.students, color: "text-indigo-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-xs hover:shadow-sm transition-shadow">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className={`mt-2 text-3xl font-bold tracking-tight ${color}`}>{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Search & actions bar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setDebouncedSearch(search); setMeta((m) => ({ ...m, page: 1 })); } }}
              placeholder="Search by name, email, or student…"
              className="h-10 pl-9 bg-slate-50/50 focus-visible:bg-white"
            />
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" className="h-10 gap-2 text-slate-600" onClick={loadParents}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild size="sm" className="h-10 gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Link href="/admin/parents/new">
                <Plus className="h-4 w-4" />
                Add Parent
              </Link>
            </Button>
          </div>
        </div>

        {/* ── Content: list + side panel ── */}
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-start">

          {/* Left: directory list */}
          <div className="space-y-4">

            {/* View toggle + keyboard hint */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/40">
                {(["cards", "table"] as const).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={viewMode === mode ? "secondary" : "ghost"}
                    className="h-8 rounded-md px-3 text-xs gap-1.5 font-medium"
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === "cards" ? <LayoutGrid className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                    {mode === "cards" ? "Cards" : "Table"}
                  </Button>
                ))}
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border">
                <kbd className="font-sans font-bold">↑</kbd>
                <kbd className="font-sans font-bold">↓</kbd>
                to navigate · <kbd className="font-sans font-bold">Enter</kbd> to edit
              </span>
            </div>

            {/* List / loader / empty state */}
            {loading ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-500">Loading parents…</p>
              </div>
            ) : parents.length === 0 ? (
              <Card className="border-dashed border-slate-300 bg-slate-50/30">
                <CardContent className="flex min-h-[350px] flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                    <Users className="h-8 w-8" />
                  </div>
                  <p className="text-base font-semibold text-slate-900">No parents found</p>
                  <p className="max-w-xs text-xs text-slate-500">
                    Try a different search term, or add a new parent account.
                  </p>
                </CardContent>
              </Card>
            ) : viewMode === "cards" ? (
              <div
                className="space-y-3 outline-none"
                ref={listContainerRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                aria-label="Parents list"
              >
                {parents.map((parent) => {
                  const isSelected = selectedParentId === parent.id;
                  return (
                    <Card
                      key={parent.id}
                      className={`cursor-pointer border-slate-200 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50/50 ${
                        isSelected ? "ring-2 ring-indigo-600 ring-offset-1 bg-indigo-50/10 border-indigo-200" : ""
                      }`}
                      onClick={() => selectParent(parent)}
                    >
                      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-slate-900">{parent.name}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              {parent.email}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {parent.phone ?? "No phone"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                              <GraduationCap className="h-3.5 w-3.5" />
                              {parent.student_count} student{parent.student_count !== 1 && "s"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 sm:border-none sm:pt-0 justify-between sm:justify-end">
                          <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200/80 rounded-md">
                            {parent.family_count} family unit{parent.family_count !== 1 && "s"}
                          </Badge>
                          <StatusBadge active={parent.is_active} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table" aria-label="Parents table">
                    <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="p-3 pl-4">Name</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3 text-center">Students</th>
                        <th className="p-3 text-center">Families</th>
                        <th className="p-3 pr-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parents.map((parent, idx) => (
                        <tr
                          key={parent.id}
                          ref={(el) => { rowRefs.current[idx] = el; }}
                          tabIndex={0}
                          onClick={() => { setSelectedIndex(idx); selectParent(parent); }}
                          onKeyDown={(e) => { if (e.key === "Enter") selectParent(parent); }}
                          className={`cursor-pointer outline-none transition-colors ${
                            selectedIndex === idx ? "bg-indigo-50/40" : "hover:bg-slate-50/60"
                          }`}
                        >
                          <td className="p-3 pl-4 font-medium text-slate-900">{parent.name}</td>
                          <td className="p-3 text-slate-600">{parent.email}</td>
                          <td className="p-3 text-slate-500">{parent.phone ?? "—"}</td>
                          <td className="p-3 text-center text-slate-700 font-medium">{parent.student_count}</td>
                          <td className="p-3 text-center text-slate-700 font-medium">{parent.family_count}</td>
                          <td className="p-3 pr-4 text-right">
                            <StatusBadge active={parent.is_active} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <p className="text-xs text-slate-500 text-center sm:text-left">
                Showing{" "}
                <span className="font-semibold text-slate-900">{(meta.page - 1) * meta.pageSize + 1}</span>
                {" – "}
                <span className="font-semibold text-slate-900">{Math.min(meta.page * meta.pageSize, meta.total)}</span>
                {" of "}
                <span className="font-semibold text-slate-900">{meta.total}</span>
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 rounded-md"
                    onClick={() => setMeta((m) => ({ ...m, page: Math.max(1, m.page - 1) }))}
                    disabled={meta.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-semibold px-3 text-slate-700 min-w-[70px] text-center">
                    {meta.page} / {meta.totalPages}
                  </span>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 rounded-md"
                    onClick={() => setMeta((m) => ({ ...m, page: Math.min(m.totalPages, m.page + 1) }))}
                    disabled={meta.page >= meta.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <select
                  value={meta.pageSize}
                  onChange={(e) => setMeta((m) => ({ ...m, pageSize: Number(e.target.value), page: 1 }))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 h-9"
                >
                  {[10, 20, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Right: split-pane editor (desktop only) */}
          <Card className="sticky top-6 border-slate-200 shadow-sm hidden xl:block overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-5">
              <CardTitle className="text-base font-semibold text-slate-900">
                {selectedParent ? selectedParent.name : "No parent selected"}
              </CardTitle>
              <CardDescription>
                {selectedParent
                  ? "Edit this parent's details and save when done."
                  : "Select a parent from the list to edit their details."}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              {selectedParent ? (
                <div className="space-y-5">
                  <ParentEditFields
                    form={editForm}
                    onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                  />

                  {/* Associated students */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Students</p>
                      <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 rounded-md font-semibold">
                        {selectedParent.student_count}
                      </Badge>
                    </div>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {selectedParent.students.length > 0 ? (
                        selectedParent.students.map((student) => (
                          <div key={student.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 flex items-start gap-3">
                            <div className="p-1.5 bg-white rounded-md border text-slate-400 mt-0.5">
                              <GraduationCap className="h-4 w-4" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                              <p className="text-xs font-mono text-slate-400">{student.student_id ?? "No ID"}</p>
                              <p className="text-xs text-indigo-600 font-medium">{student.class_name ?? "Unassigned"}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 py-4 text-center italic">No students linked yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={saveParent} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400 gap-2">
                  <Users className="h-8 w-8 stroke-1 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">Select a parent to edit</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile / tablet edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[92vw] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">
              Edit — {selectedParent?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update this parent's details below.
            </DialogDescription>
          </DialogHeader>

          {selectedParent && (
            <div className="space-y-4 pt-2">
              <ParentEditFields
                form={editForm}
                onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
              />
              <Button
                className="w-full h-10 gap-2 bg-indigo-600 hover:bg-indigo-700"
                onClick={saveParent}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}