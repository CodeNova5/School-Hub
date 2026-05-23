"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, GraduationCap, Loader2, Mail, Phone, Search, Users } from "lucide-react";

interface FamilyParent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  relationships: string[];
  student_count: number;
}

interface FamilyStudent {
  id: string;
  student_id: string | null;
  name: string;
  class_name: string | null;
}

interface FamilyCluster {
  family_id: string;
  family_name: string;
  student_count: number;
  parent_count: number;
  parents: FamilyParent[];
  students: FamilyStudent[];
  primary_contacts: FamilyParent[];
  relationship_summary: Record<string, number>;
  last_activity_at: string | null;
}

export default function AdminFamiliesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState<FamilyCluster[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<FamilyCluster | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  async function loadFamilies() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/admin/families?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load families");
      }

      setFamilies(payload.data.families || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to load families",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFamilies();
  }, []);

  const stats = useMemo(() => ({
    families: families.length,
    parents: families.reduce((total, family) => total + family.parent_count, 0),
    students: families.reduce((total, family) => total + family.student_count, 0),
  }), [families]);

  function openFamily(family: FamilyCluster) {
    setSelectedFamily(family);
    setDetailsOpen(true);
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-700 text-white">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5" />
              Families
            </CardTitle>
            <p className="text-sm text-slate-200">
              Derived household clusters built from existing parents and student links.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Families</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.families}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Parents</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.parents}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Students</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.students}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search families, parents, or students"
              className="h-11 rounded-xl pl-9"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  loadFamilies();
                }
              }}
            />
          </div>
          <Button className="rounded-xl" onClick={loadFamilies}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading families...
            </div>
          </div>
        ) : families.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="flex min-h-[30vh] flex-col items-center justify-center gap-3 py-10 text-center">
              <Users className="h-10 w-10 text-slate-300" />
              <p className="text-lg font-semibold text-slate-900">No families found</p>
              <p className="max-w-md text-sm text-slate-500">
                Families will appear here once students are linked to one or more parents or guardians.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {families.map((family) => (
              <Card key={family.family_id} className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg text-slate-900">{family.family_name}</CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        {family.parent_count} parent{family.parent_count === 1 ? "" : "s"} · {family.student_count} student{family.student_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      Derived
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Primary contacts</p>
                      <div className="mt-2 space-y-2">
                        {family.primary_contacts.length > 0 ? family.primary_contacts.map((parent) => (
                          <div key={parent.id} className="flex items-center justify-between gap-2 text-sm text-slate-700">
                            <span>{parent.name}</span>
                            <Badge variant={parent.is_active ? "default" : "secondary"} className={parent.is_active ? "bg-emerald-600" : ""}>
                              {parent.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        )) : (
                          <p className="text-sm text-slate-500">No primary contact marked</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Children</p>
                      <div className="mt-2 space-y-2">
                        {family.students.slice(0, 3).map((student) => (
                          <div key={student.id} className="flex items-center justify-between gap-2 text-sm text-slate-700">
                            <span>{student.name}</span>
                            <span className="text-xs text-slate-500">{student.class_name || "No class"}</span>
                          </div>
                        ))}
                        {family.students.length > 3 && (
                          <p className="text-xs text-slate-500">+{family.students.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Object.entries(family.relationship_summary).slice(0, 4).map(([relationship, count]) => (
                      <Badge key={relationship} variant="outline" className="rounded-full">
                        {relationship}: {count}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                    <Button variant="outline" className="rounded-xl" onClick={() => openFamily(family)}>
                      View details
                    </Button>
                    <Button asChild className="rounded-xl">
                      <Link href="/admin/parents">
                        Manage parents
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedFamily?.family_name || "Family details"}</DialogTitle>
          </DialogHeader>

          {selectedFamily && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Parents</p>
                  <div className="mt-3 space-y-3">
                    {selectedFamily.parents.map((parent) => (
                      <div key={parent.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{parent.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{parent.email}</p>
                          </div>
                          <Badge variant={parent.is_active ? "default" : "secondary"} className={parent.is_active ? "bg-emerald-600" : ""}>
                            {parent.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {parent.phone || "No phone"}</span>
                          <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {parent.student_count} student{parent.student_count === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Students</p>
                  <div className="mt-3 space-y-3">
                    {selectedFamily.students.map((student) => (
                      <div key={student.id} className="rounded-lg bg-slate-50 p-3">
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{student.student_id || "No student ID"}</p>
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                          <GraduationCap className="h-3.5 w-3.5" />
                          {student.class_name || "No class assigned"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Relationships</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(selectedFamily.relationship_summary).map(([relationship, count]) => (
                      <Badge key={relationship} variant="outline" className="rounded-full">
                        {relationship}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}