"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, GraduationCap, Loader2, Mail, Phone, Search, Sparkles, Users } from "lucide-react";

interface StudentOption {
  id: string;
  student_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  class_name: string | null;
  created_at: string;
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

export default function NewParentPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedStudentRecords, setSelectedStudentRecords] = useState<StudentOption[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    relationship_type: "Guardian",
    is_primary_contact: false,
  });

  async function loadStudents(search = "") {
    try {
      setLoadingStudents(true);
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("search", search.trim());
      }
      params.set("pageSize", "120");

      const response = await fetch(`/api/admin/students?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load students");
      }

      setStudents(payload.data.students || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to load students",
        variant: "destructive",
      });
    } finally {
      setLoadingStudents(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStudentSearch(studentSearch);
    }, 350);

    return () => clearTimeout(timer);
  }, [studentSearch]);

  useEffect(() => {
    loadStudents(debouncedStudentSearch);
  }, [debouncedStudentSearch]);

  const selectedStudents = useMemo(() => selectedStudentRecords, [selectedStudentRecords]);

  function toggleStudent(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;

    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );

    setSelectedStudentRecords((current) =>
      current.some((item) => item.id === studentId)
        ? current.filter((item) => item.id !== studentId)
        : [...current, student]
    );
  }

  function removeStudent(studentId: string) {
    setSelectedStudentIds((current) => current.filter((id) => id !== studentId));
    setSelectedStudentRecords((current) => current.filter((item) => item.id !== studentId));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: "Missing name", description: "Parent name is required", variant: "destructive" });
      return;
    }

    if (!formData.email.trim()) {
      toast({ title: "Missing email", description: "Parent email is required", variant: "destructive" });
      return;
    }

    if (selectedStudentIds.length === 0) {
      toast({ title: "No students selected", description: "Choose at least one student to link", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/parents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          relationship_type: formData.relationship_type,
          is_primary_contact: formData.is_primary_contact,
          student_ids: selectedStudentIds,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create parent");
      }

      toast({
        title: "Parent created",
        description: `${payload.data.parent?.name || formData.name} has been added and linked to ${selectedStudentIds.length} student(s).`,
      });
      router.push("/admin/parents");
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to create parent",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-sky-700 to-blue-700 px-6 py-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-sky-100">
                <Sparkles className="h-4 w-4" />
                Parents and Guardians
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Add Parent</h1>
              <p className="mt-1 text-sm text-sky-100">Create a new parent account and link the student records they should manage.</p>
            </div>
            <Button asChild variant="outline" className="h-11 rounded-xl border-white/20 bg-white text-sky-700 shadow-sm hover:bg-sky-50 hover:text-sky-800">
              <Link href="/admin/parents">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Parents
              </Link>
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <Users className="h-5 w-5 text-sky-600" />
                  Parent Details
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">Capture the account details for the parent or guardian.</p>
              </CardHeader>
              <CardContent className="space-y-5 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldGroup>
                    <Label htmlFor="parent-name">Full name</Label>
                    <Input
                      id="parent-name"
                      value={formData.name}
                      onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Jane Doe"
                      className="h-11 rounded-xl"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label htmlFor="parent-email">Email</Label>
                    <Input
                      id="parent-email"
                      type="email"
                      value={formData.email}
                      onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                      placeholder="jane@example.com"
                      className="h-11 rounded-xl"
                    />
                  </FieldGroup>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldGroup>
                    <Label htmlFor="parent-phone">Phone</Label>
                    <Input
                      id="parent-phone"
                      value={formData.phone}
                      onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="08012345678"
                      className="h-11 rounded-xl"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label htmlFor="relationship-type">Relationship type</Label>
                    <Input
                      id="relationship-type"
                      value={formData.relationship_type}
                      onChange={(event) => setFormData((current) => ({ ...current, relationship_type: event.target.value }))}
                      placeholder="Guardian"
                      className="h-11 rounded-xl"
                    />
                  </FieldGroup>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Primary contact</p>
                      <p className="text-xs text-slate-500">Mark this parent as the primary contact for the selected students.</p>
                    </div>
                    <Button
                      type="button"
                      variant={formData.is_primary_contact ? "default" : "outline"}
                      className={formData.is_primary_contact ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      onClick={() => setFormData((current) => ({ ...current, is_primary_contact: !current.is_primary_contact }))}
                    >
                      {formData.is_primary_contact ? "Primary contact" : "Not primary"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <GraduationCap className="h-5 w-5 text-sky-600" />
                  Link Students
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">Search and select the students this parent should be connected to.</p>
              </CardHeader>
              <CardContent className="space-y-5 px-6 py-6">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Search by student name, ID, or email"
                    className="h-11 rounded-xl pl-9"
                  />
                </div>

                {loadingStudents ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
                    <div className="flex items-center gap-3 text-slate-600">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading students...
                    </div>
                  </div>
                ) : students.length === 0 ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
                    <GraduationCap className="h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-lg font-semibold text-slate-900">No students found</p>
                    <p className="max-w-md text-sm text-slate-500">Try a different search term or load more students from the school registry.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {students.map((student) => {
                      const selected = selectedStudentIds.includes(student.id);
                      return (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => toggleStudent(student.id)}
                          className={`rounded-2xl border p-4 text-left transition ${selected ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{student.name}</p>
                              <p className="mt-1 text-sm text-slate-500">{student.student_id || "No student ID"}</p>
                            </div>
                            <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                              <Check className="h-4 w-4" />
                            </div>
                          </div>

                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-slate-400" />
                              <span>{student.email || "No email"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-slate-400" />
                              <span>{student.phone || "No phone"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-slate-400" />
                              <span>{student.class_name || "No class assigned"}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <Badge variant={student.is_active ? "default" : "secondary"} className={student.is_active ? "bg-emerald-600" : ""}>
                              {student.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <span className="text-xs text-slate-400">{selected ? "Selected" : "Tap to select"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-700 text-white">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5" />
                  Summary
                </CardTitle>
                <p className="text-sm text-slate-200">Review the parent record before creating it.</p>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Parent</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{formData.name || "Untitled parent"}</p>
                  <p className="text-sm text-slate-500">{formData.email || "No email"}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Selected students</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedStudentIds.length}</p>
                  <p className="text-sm text-slate-500">{selectedStudentIds.length > 0 ? `${selectedStudentIds.length} student(s) will be linked.` : "Choose at least one student to continue."}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Relationship</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formData.relationship_type || "Guardian"}</p>
                  <p className="text-sm text-slate-500">Applied to all selected student links.</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Selected list</p>
                  <div className="mt-3 space-y-3">
                    {selectedStudents.length > 0 ? selectedStudents.map((student) => (
                      <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                        <div>
                          <p className="font-semibold text-slate-900">{student.name}</p>
                          <p className="text-sm text-slate-500">{student.student_id || "No student ID"}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 rounded-lg px-2 text-slate-500 hover:text-slate-900"
                          onClick={() => removeStudent(student.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    )) : (
                      <p className="text-sm text-slate-500">No students selected yet.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" className="h-11 flex-1 rounded-xl" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Parent
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
