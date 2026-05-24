"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  ShieldAlert
} from "lucide-react";

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

export default function AdminParentsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parents, setParents] = useState<ParentSummary[]>([]);
  const [totals, setTotals] = useState<{ parents: number; families: number } | null>(null);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", is_active: false });

  const selectedParent = useMemo(
    () => parents.find((parent) => parent.id === selectedParentId) || null,
    [parents, selectedParentId]
  );

  const loadParents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      params.set("page", String(meta.page));
      params.set("pageSize", String(meta.pageSize));

      const response = await fetch(`/api/admin/parents?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load parents");
      }

      const fetchedParents = payload.data.parents || [];
      setParents(fetchedParents);
      if (payload.data.totals) setTotals(payload.data.totals);
      if (payload.data.meta) setMeta((current) => ({ ...current, ...payload.data.meta }));

      if (fetchedParents.length > 0) {
        const stillVisible = selectedParentId && fetchedParents.some((parent: ParentSummary) => parent.id === selectedParentId);
        if (!stillVisible) {
          setSelectedParentId(fetchedParents[0].id);
          setEditForm({
            name: fetchedParents[0].name,
            email: fetchedParents[0].email,
            phone: fetchedParents[0].phone || "",
            is_active: fetchedParents[0].is_active,
          });
        }
      } else {
        setSelectedParentId(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to load parents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, meta.page, meta.pageSize, selectedParentId, toast]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setMeta((m) => ({ ...m, page: 1 }));
    }, 400);

    return () => clearTimeout(t);
  }, [search]);

  // Reload when debounced search or pagination changes
  useEffect(() => {
    loadParents();
  }, [debouncedSearch, meta.page, meta.pageSize]);

  function selectParent(parent: ParentSummary) {
    setSelectedParentId(parent.id);
    setEditForm({
      name: parent.name,
      email: parent.email,
      phone: parent.phone || "",
      is_active: parent.is_active,
    });
    // Only open dialog overlay on smaller viewports where split-pane is hidden
    if (window.innerWidth < 1280) {
      setDetailsOpen(true);
    }
  }

  // Keyboard navigation handlers
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!parents || parents.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.min(parents.length - 1, Math.max(0, i + 1));
        const p = parents[next];
        if (p) {
          setSelectedParentId(p.id);
          setEditForm({ name: p.name, email: p.email, phone: p.phone || "", is_active: p.is_active });
        }
        return next;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) => {
        const prev = Math.max(0, i - 1);
        const p = parents[prev];
        if (p) {
          setSelectedParentId(p.id);
          setEditForm({ name: p.name, email: p.email, phone: p.phone || "", is_active: p.is_active });
        }
        return prev;
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (selectedIndex >= 0 && parents[selectedIndex]) {
        selectParent(parents[selectedIndex]);
      }
    }
  }, [parents, selectedIndex]);

  useEffect(() => {
    const el = rowRefs.current[selectedIndex];
    if (el) el.focus();
  }, [selectedIndex]);

  useEffect(() => {
    if (!selectedParentId) {
      setSelectedIndex(-1);
      return;
    }
    const idx = parents.findIndex((p) => p.id === selectedParentId);
    setSelectedIndex(idx);
  }, [selectedParentId, parents]);

  async function saveParent() {
    if (!selectedParent) return;

    try {
      setSaving(true);
      const response = await fetch("/api/admin/parents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedParent.id,
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          is_active: editForm.is_active,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update parent");
      }

      toast({
        title: "Saved",
        description: "Parent record updated successfully.",
      });

      setDetailsOpen(false);
      await loadParents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to save parent",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(() => ({
    parents: totals?.parents ?? parents.length,
    active: parents.filter((parent) => parent.is_active).length,
    linkedStudents: parents.reduce((total, parent) => total + parent.student_count, 0),
  }), [parents, totals]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-[1600px] mx-auto p-4 sm:p-6 animate-in fade-in duration-300">
        
        {/* Header Stats Section */}
        <Card className="border-slate-200/80 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                <Users className="h-6 w-6 text-indigo-200" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Parents & Guardians</CardTitle>
                <CardDescription className="text-slate-300 mt-1">
                  Manage independent guardian profiles, platform status, and associated student tracking accounts.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-3 bg-slate-50/50 border-t border-slate-100">
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-xs transition hover:shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Records</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{stats.parents}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-xs transition hover:shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Accounts</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600">{stats.active}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-xs transition hover:shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Linked Students</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-indigo-600">{stats.linkedStudents}</p>
            </div>
          </CardContent>
        </Card>

        {/* Search & Action Bar */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search parents, emails, or students..."
              className="h-10 rounded-lg pl-9 bg-slate-50/50 focus-visible:bg-white"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setDebouncedSearch(search);
                  setMeta((m) => ({ ...m, page: 1 }));
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" className="rounded-lg h-10 gap-2 text-slate-600 border-slate-200" onClick={loadParents}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild size="sm" className="rounded-lg h-10 gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-xs">
              <Link href="/admin/parents/new">
                <Plus className="h-4 w-4" />
                Add Parent
              </Link>
            </Button>
          </div>
        </div>

        {/* Content Body Layout */}
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-start">
          
          {/* Left Pane: Directory List/Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/40">
                <Button 
                  size="sm"
                  variant={viewMode === "cards" ? "secondary" : "ghost"} 
                  className="h-8 rounded-md px-3 text-xs gap-1.5 font-medium"
                  onClick={() => setViewMode("cards")} 
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </Button>
                <Button 
                  size="sm"
                  variant={viewMode === "table" ? "secondary" : "ghost"} 
                  className="h-8 rounded-md px-3 text-xs gap-1.5 font-medium"
                  onClick={() => setViewMode("table")} 
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Table
                </Button>
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border">
                Use <kbd className="font-sans font-bold">↑</kbd> <kbd className="font-sans font-bold">↓</kbd> to navigate, <kbd className="font-sans font-bold">Enter</kbd> to manage
              </span>
            </div>

            {loading ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs p-6">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm font-medium text-slate-500 mt-3">Fetching directory entries...</p>
              </div>
            ) : parents.length === 0 ? (
              <Card className="border-dashed border-slate-300 bg-slate-50/30">
                <CardContent className="flex min-h-[350px] flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                    <Users className="h-8 w-8" />
                  </div>
                  <p className="text-base font-semibold text-slate-900">No records discovered</p>
                  <p className="max-w-xs text-xs text-slate-500">
                    Try amending your search term or initialize a brand new parent container account.
                  </p>
                </CardContent>
              </Card>
            ) : viewMode === "cards" ? (
              <div 
                className="space-y-3 outline-none" 
                ref={listContainerRef} 
                tabIndex={0} 
                onKeyDown={handleKeyDown} 
                aria-label="Parents dynamic directory list"
              >
                {parents.map((parent) => {
                  const isSelected = selectedParentId === parent.id;
                  return (
                    <Card
                      key={parent.id}
                      className={`cursor-pointer border-slate-200 shadow-2xs transition-all hover:bg-slate-50/50 hover:border-slate-300 ${
                        isSelected ? "ring-2 ring-indigo-600 ring-offset-1 bg-indigo-50/10 border-indigo-200" : ""
                      }`}
                      onClick={() => selectParent(parent)}
                    >
                      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-slate-900 tracking-tight">{parent.name}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" />{parent.email}</span>
                            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" />{parent.phone || "No designated phone"}</span>
                            <span className="inline-flex items-center gap-1.5 font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm"><GraduationCap className="h-3.5 w-3.5" />{parent.student_count} Student{parent.student_count === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 sm:border-none sm:pt-0 justify-between sm:justify-end">
                          <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200/80 rounded-md px-2 py-0.5">{parent.family_count} Family unit{parent.family_count === 1 ? "" : "s"}</Badge>
                          <Badge variant={parent.is_active ? "default" : "secondary"} className={`rounded-md px-2 py-0.5 ${parent.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50" : ""}`}>
                            {parent.is_active ? "Active" : "Suspended"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse" role="table" aria-label="Parents structured grid">
                    <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="p-3 pl-4">Full Name</th>
                        <th className="p-3">Email Address</th>
                        <th className="p-3">Phone Line</th>
                        <th className="p-3 text-center">Students</th>
                        <th className="p-3 text-center">Families</th>
                        <th className="p-3 pr-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parents.map((parent, idx) => {
                        const isSelected = selectedIndex === idx;
                        return (
                          <tr
                            key={parent.id}
                            ref={(el) => { rowRefs.current[idx] = el; }}
                            tabIndex={0}
                            onClick={() => { setSelectedIndex(idx); selectParent(parent); }}
                            onKeyDown={(e) => { if (e.key === "Enter") selectParent(parent); }}
                            className={`cursor-pointer transition-colors outline-none ${isSelected ? "bg-indigo-50/40" : "hover:bg-slate-50/60"}`}
                          >
                            <td className="p-3 pl-4 font-medium text-slate-900">{parent.name}</td>
                            <td className="p-3 text-slate-600">{parent.email}</td>
                            <td className="p-3 text-slate-500">{parent.phone || "—"}</td>
                            <td className="p-3 text-center font-medium text-slate-700">{parent.student_count}</td>
                            <td className="p-3 text-center font-medium text-slate-700">{parent.family_count}</td>
                            <td className="p-3 pr-4 text-right">
                              <Badge variant={parent.is_active ? "default" : "secondary"} className={`rounded-md ${parent.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : ""}`}>
                                {parent.is_active ? "Active" : "Suspended"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination Controls - Permanently Rendered Outside Loader Conditional */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 text-center sm:text-left">
                Showing <span className="text-slate-900">{(meta.page - 1) * meta.pageSize + 1}</span> to{" "}
                <span className="text-slate-900">{Math.min(meta.page * meta.pageSize, meta.total)}</span> of{" "}
                <span className="text-slate-900">{meta.total}</span> listings
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-md"
                    onClick={() => setMeta((m) => ({ ...m, page: Math.max(1, m.page - 1) }))} 
                    disabled={meta.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-semibold px-3 text-slate-700 min-w-[70px] text-center">
                    {meta.page} / {meta.totalPages}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-md"
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
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Pane: Split Screen Live Profile Editor (Hidden on Mobile/Tablets) */}
          <Card className="sticky top-6 border-slate-200 shadow-sm hidden xl:block overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-5">
              <CardTitle className="text-lg font-bold text-slate-900">
                {selectedParent ? "Focus Record Inspector" : "No Profile Selected"}
              </CardTitle>
              <CardDescription>
                {selectedParent ? "Make real-time edits directly to this credentials layer." : "Choose an entity card from the matching roster view."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {selectedParent ? (
                <div className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="parent-name" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Full Name</Label>
                      <Input id="parent-name" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 h-10 rounded-lg" />
                    </div>
                    <div>
                      <Label htmlFor="parent-email" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email Address</Label>
                      <Input id="parent-email" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 h-10 rounded-lg" />
                    </div>
                    <div>
                      <Label htmlFor="parent-phone" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone Connection</Label>
                      <Input id="parent-phone" value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} className="mt-1.5 h-10 rounded-lg" />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 p-4 transition-all">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                          {editForm.is_active ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-slate-400" />}
                          Account Access Status
                        </p>
                        <p className="text-xs text-slate-500">Deactivating flags this profile as inactive across modules.</p>
                      </div>
                      <Button 
                        type="button" 
                        size="sm"
                        variant={editForm.is_active ? "default" : "outline"} 
                        className={`rounded-lg font-medium transition-all min-w-[90px] ${
                          editForm.is_active ? "bg-emerald-600 hover:bg-emerald-700 shadow-xs" : "border-slate-300 text-slate-700"
                        }`} 
                        onClick={() => setEditForm((current) => ({ ...current, is_active: !current.is_active }))}
                      >
                        {editForm.is_active ? "Active" : "Suspended"}
                      </Button>
                    </div>
                  </div>

                  {/* Child Entities Sub-list */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Associated Students</p>
                      <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 rounded-md font-semibold">{selectedParent.student_count}</Badge>
                    </div>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {selectedParent.students.length > 0 ? selectedParent.students.map((student) => (
                        <div key={student.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 flex items-start gap-3">
                          <div className="p-1.5 bg-white rounded-md border text-slate-400 mt-0.5">
                            <GraduationCap className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                            <p className="text-xs font-mono text-slate-400">{student.student_id || "No registry numerical ID"}</p>
                            <p className="text-xs text-indigo-600 font-medium mt-1">{student.class_name || "Unassigned Academic Cohort"}</p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-xs text-slate-400 py-4 text-center italic">No dependent student nodes mapped yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-slate-100 pt-4">
                    <Button className="rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-sm gap-2" onClick={saveParent} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Commit Operations
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400 gap-2">
                  <Users className="h-8 w-8 stroke-1 text-slate-300" />
                  <p className="text-sm font-medium">Select a Parent Profile</p>
                  <p className="text-xs max-w-[200px]">Highlight any specific index on the left tracking console to patch records.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Small Screen Overlay Dialog Drawer */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md w-[92vw] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Manage: {selectedParent?.name}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Modify properties below and save.</DialogDescription>
          </DialogHeader>
          {selectedParent && (
            <div className="space-y-4 pt-2">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="modal-name" className="text-xs font-semibold text-slate-500">Full Name</Label>
                  <Input id="modal-name" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="h-10 mt-1" />
                </div>
                <div>
                  <Label htmlFor="modal-email" className="text-xs font-semibold text-slate-500">Email Address</Label>
                  <Input id="modal-email" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} className="h-10 mt-1" />
                </div>
                <div>
                  <Label htmlFor="modal-phone" className="text-xs font-semibold text-slate-500">Phone</Label>
                  <Input id="modal-phone" value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} className="h-10 mt-1" />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 border p-3">
                  <span className="text-sm font-medium text-slate-900">Account Access</span>
                  <Button 
                    size="sm"
                    variant={editForm.is_active ? "default" : "outline"}
                    className={editForm.is_active ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    onClick={() => setEditForm((current) => ({ ...current, is_active: !current.is_active }))}
                  >
                    {editForm.is_active ? "Active" : "Suspended"}
                  </Button>
                </div>
              </div>
              <Button className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 rounded-lg gap-2 mt-2 shadow-xs" onClick={saveParent} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Parent Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}