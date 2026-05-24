"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  GraduationCap, 
  Loader2, 
  Mail, 
  Phone, 
  Search, 
  Users, 
  RefreshCw, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight
} from "lucide-react";

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
}

export default function AdminParentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<ParentSummary[]>([]);
  const [totals, setTotals] = useState<{ parents: number; families: number } | null>(null);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });

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

      setParents(payload.data.parents || []);
      if (payload.data.totals) setTotals(payload.data.totals);
      if (payload.data.meta) setMeta((current) => ({ ...current, ...payload.data.meta }));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to load parents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, meta.page, meta.pageSize, toast]);

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

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!parents || parents.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) => Math.min(parents.length - 1, Math.max(0, i + 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (selectedIndex >= 0 && parents[selectedIndex]) {
        router.push(`/admin/parents/${parents[selectedIndex].id}`);
      }
    }
  }, [parents, selectedIndex, router]);

  useEffect(() => {
    const el = rowRefs.current[selectedIndex];
    if (el) el.focus();
  }, [selectedIndex]);

  const stats = useMemo(() => ({
    parents: totals?.parents ?? parents.length,
    active: parents.filter((p) => p.is_active).length,
  }), [parents, totals]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-[1400px] mx-auto p-4 sm:p-6 animate-in fade-in duration-200">
        
        {/* Banner Summary */}
        <Card className="border-slate-200/80 shadow-xs overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Users className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight">Parent Records Directory</CardTitle>
                <CardDescription className="text-slate-400 mt-0.5">
                  View, filter, and audit independent guardian identities system-wide.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Dynamic Toolbar */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, email, or student reference..."
              className="h-10 pl-9 bg-slate-50/50 focus-visible:bg-white rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" className="h-10 rounded-lg text-slate-600 border-slate-200 gap-2" onClick={loadParents}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild size="sm" className="h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 gap-2 shadow-xs">
              <Link href="/admin/parents/new">
                <Plus className="h-4 w-4" /> Add Parent
              </Link>
            </Button>
          </div>
        </div>

        {/* Central Data Table Container */}
        <div 
          className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden outline-none"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-label="Parents directory table keyboard context"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse" role="table">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3.5 pl-6">Full Name</th>
                  <th className="p-3.5">Email Address</th>
                  <th className="p-3.5">Phone Line</th>
                  <th className="p-3.5 text-center">Linked Students</th>
                  <th className="p-3.5 text-center">Family Units</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                      Loading master directory entries...
                    </td>
                  </tr>
                ) : parents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500 font-medium">
                      No matching parent configurations discovered.
                    </td>
                  </tr>
                ) : (
                  parents.map((parent, idx) => {
                    const isSelected = selectedIndex === idx;
                    return (
                      <tr
                        key={parent.id}
                        ref={(el) => { rowRefs.current[idx] = el; }}
                        tabIndex={-1}
                        onClick={() => router.push(`/admin/parents/${parent.id}`)}
                        className={`cursor-pointer transition-colors outline-none ${isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50/50"}`}
                      >
                        <td className="p-3.5 pl-6 font-semibold text-slate-900">{parent.name}</td>
                        <td className="p-3.5 text-slate-600">
                          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" />{parent.email}</span>
                        </td>
                        <td className="p-3.5 text-slate-500">
                          <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" />{parent.phone || "—"}</span>
                        </td>
                        <td className="p-3.5 text-center font-medium text-slate-700">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 rounded font-medium">
                            {parent.student_count}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-center font-medium text-slate-700">{parent.family_count}</td>
                        <td className="p-3.5">
                          <Badge variant={parent.is_active ? "default" : "secondary"} className={`rounded ${parent.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-3xs" : ""}`}>
                            {parent.is_active ? "Active" : "Suspended"}
                          </Badge>
                        </td>
                        <td className="p-3.5 pr-6 text-right">
                          <Button variant="ghost" size="sm" className="h-8 rounded text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 gap-1 font-medium">
                            Manage <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Consolidated Footprint Pagination */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 text-center sm:text-left">
            Showing <span className="text-slate-900">{(meta.page - 1) * meta.pageSize + 1}</span> to{" "}
            <span className="text-slate-900">{" "}{Math.min(meta.page * meta.pageSize, meta.total)}</span> of{" "}
            <span className="text-slate-900">{meta.total}</span> data blocks
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
              <Button 
                variant="ghost" size="icon" className="h-8 w-8 rounded-md"
                onClick={() => setMeta((m) => ({ ...m, page: Math.max(1, m.page - 1) }))} 
                disabled={meta.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-semibold px-3 text-slate-700 min-w-[65px] text-center">
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
              <option value={10}>10 records</option>
              <option value={20}>20 records</option>
              <option value={50}>50 records</option>
            </select>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}