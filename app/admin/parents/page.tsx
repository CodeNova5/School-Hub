"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Loader2, Mail, Phone, Save, Search, Users } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parents, setParents] = useState<ParentSummary[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", is_active: false });

  const selectedParent = useMemo(
    () => parents.find((parent) => parent.id === selectedParentId) || null,
    [parents, selectedParentId]
  );

  async function loadParents() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/admin/parents?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load parents");
      }

      const fetchedParents = payload.data.parents || [];
      setParents(fetchedParents);

      if (fetchedParents.length > 0) {
        const stillVisible = selectedParentId && fetchedParents.some((parent: ParentSummary) => parent.id === selectedParentId);
        if (!stillVisible) {
          selectParent(fetchedParents[0]);
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
  }

  useEffect(() => {
    loadParents();
  }, []);

  function selectParent(parent: ParentSummary) {
    setSelectedParentId(parent.id);
    setEditForm({
      name: parent.name,
      email: parent.email,
      phone: parent.phone || "",
      is_active: parent.is_active,
    });
    setDetailsOpen(true);
  }

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
    parents: parents.length,
    active: parents.filter((parent) => parent.is_active).length,
    linkedStudents: parents.reduce((total, parent) => total + parent.student_count, 0),
  }), [parents]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-sky-700 to-blue-700 text-white">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5" />
              Parents and Guardians
            </CardTitle>
            <p className="text-sm text-sky-100">
              Manage individual parent accounts, activation status, and linked students.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Parents</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.parents}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Active</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.active}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Linked students</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.linkedStudents}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search parents, guardians, or linked students"
              className="h-11 rounded-xl pl-9"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  loadParents();
                }
              }}
            />
          </div>
          <Button className="rounded-xl" onClick={loadParents}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading parents...
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              {parents.length === 0 ? (
                <Card className="border-dashed border-slate-300">
                  <CardContent className="flex min-h-[30vh] flex-col items-center justify-center gap-3 py-10 text-center">
                    <Users className="h-10 w-10 text-slate-300" />
                    <p className="text-lg font-semibold text-slate-900">No parents found</p>
                    <p className="max-w-md text-sm text-slate-500">
                      Parent records will appear here after student creation or activation.
                    </p>
                  </CardContent>
                </Card>
              ) : parents.map((parent) => (
                <Card key={parent.id} className={`cursor-pointer border-slate-200 shadow-sm transition hover:border-sky-300 ${selectedParentId === parent.id ? "ring-2 ring-sky-200" : ""}`} onClick={() => selectParent(parent)}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{parent.name}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{parent.email}</span>
                        <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{parent.phone || "No phone"}</span>
                        <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{parent.student_count} student{parent.student_count === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={parent.is_active ? "default" : "secondary"} className={parent.is_active ? "bg-emerald-600" : ""}>
                        {parent.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{parent.family_count} family{parent.family_count === 1 ? "" : "ies"}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>{selectedParent?.name || "Select a parent"}</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedParent ? (
                  <div className="space-y-5">
                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="parent-name">Name</Label>
                        <Input id="parent-name" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-11 rounded-xl" />
                      </div>
                      <div>
                        <Label htmlFor="parent-email">Email</Label>
                        <Input id="parent-email" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} className="mt-1 h-11 rounded-xl" />
                      </div>
                      <div>
                        <Label htmlFor="parent-phone">Phone</Label>
                        <Input id="parent-phone" value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} className="mt-1 h-11 rounded-xl" />
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Account status</p>
                          <p className="text-xs text-slate-500">Controls whether this parent is marked active in the portal.</p>
                        </div>
                        <Button type="button" variant={editForm.is_active ? "default" : "outline"} className={editForm.is_active ? "bg-emerald-600 hover:bg-emerald-700" : ""} onClick={() => setEditForm((current) => ({ ...current, is_active: !current.is_active }))}>
                          {editForm.is_active ? "Active" : "Inactive"}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Linked students</p>
                        <Badge variant="outline">{selectedParent.student_count}</Badge>
                      </div>
                      <div className="mt-3 space-y-3">
                        {selectedParent.students.length > 0 ? selectedParent.students.map((student) => (
                          <div key={student.id} className="rounded-lg bg-slate-50 p-3">
                            <p className="font-semibold text-slate-900">{student.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{student.student_id || "No student ID"}</p>
                            <div className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                              <GraduationCap className="h-3.5 w-3.5" />
                              {student.class_name || "No class assigned"}
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm text-slate-500">No linked students yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <Button className="rounded-xl" onClick={saveParent} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Choose a parent to view and edit their account.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedParent?.name || "Parent details"}</DialogTitle>
          </DialogHeader>
          {selectedParent && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                This side panel mirrors the editor so the selected record is easy to inspect on smaller screens.
              </p>
              <Button className="w-full rounded-xl" onClick={saveParent} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}