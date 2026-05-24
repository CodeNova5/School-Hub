"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  GraduationCap, 
  ShieldCheck, 
  ShieldAlert 
} from "lucide-react";

interface ParentStudent {
  id: string;
  student_id: string | null;
  name: string;
  class_name: string | null;
}

interface ParentDetails {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  student_count: number;
  students: ParentStudent[];
}

export default function AdminParentEditPage() {
  const params = useParams<{ id: string }>();
  const parentId = params?.id;
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parent, setParent] = useState<ParentDetails | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", is_active: false });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  useEffect(() => {
    if (!parentId) {
      toast({
        title: "Error",
        description: "Missing parent identifier",
        variant: "destructive",
      });
      router.push("/admin/parents");
      return;
    }

    async function fetchParentDetails() {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/parents/${parentId}`);
        const payload = await response.json();
        
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to load individual target profile");
        }
        
        const parentData = payload.data.parent;
        setParent(parentData);
        setForm({
          name: parentData.name,
          email: parentData.email,
          phone: parentData.phone || "",
          is_active: parentData.is_active,
        });
        setErrors({});
        setHasChanges(false);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to parse profile payload",
          variant: "destructive",
        });
        router.push("/admin/parents");
      } finally {
        setLoading(false);
      }
    }
      fetchParentDetails();
  }, [parentId, router, toast]);

    // Track unsaved changes
    useEffect(() => {
      if (!parent) return;
      const changed = (
        parent.name !== form.name ||
        parent.email !== form.email ||
        (parent.phone || "") !== form.phone ||
        parent.is_active !== form.is_active
      );
      setHasChanges(changed);
    }, [form, parent]);

    // Warn on window/tab close when there are unsaved changes
    useEffect(() => {
      function handleBeforeUnload(e: BeforeUnloadEvent) {
        if (!hasChanges) return;
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
      }
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasChanges]);

  async function handleCommitChanges() {
    try {
      // client-side validation
      const valid = validateForm();
      if (!valid) return;
      setSaving(true);
      const response = await fetch("/api/admin/parents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: parentId,
          name: form.name,
          email: form.email,
          phone: form.phone,
          is_active: form.is_active,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Execution fault during dynamic transaction");
      }

      toast({
        title: "Database Synchronized",
        description: "Parent record architecture written back successfully.",
      });
      router.push("/admin/parents");
    } catch (error: any) {
      toast({
        title: "Transaction Failure",
        description: error.message || "Unable to reconcile modified data maps",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const validateForm = useCallback(() => {
    const nextErrors: { name?: string; email?: string } = {};
    if (!form.name || form.name.trim().length < 2) nextErrors.name = "Provide a valid display name.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email || !emailRegex.test(form.email)) nextErrors.email = "Provide a valid email address.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form]);

  function handleCancelChanges() {
    if (!parent) return;
    setForm({ name: parent.name, email: parent.email, phone: parent.phone || "", is_active: parent.is_active });
    setErrors({});
    setHasChanges(false);
    toast({ title: "Reverted", description: "Unsaved changes were discarded." });
  }

  function handleBackClick() {
    if (hasChanges) {
      setShowDiscardDialog(true);
      return;
    }
    router.push("/admin/parents");
  }

  function confirmLeaveWithoutSaving() {
    setShowDiscardDialog(false);
    router.push("/admin/parents");
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Decompressing operational index data...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes have not been saved yet. Leaving now will reset this form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeaveWithoutSaving}>Discard and leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
        
        {/* Navigation Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="rounded-lg gap-2 text-slate-600 hover:bg-slate-100" onClick={handleBackClick}>
              <ArrowLeft className="h-4 w-4" /> Back to Directory
            </Button>
            <div className="text-sm">
              <p className="text-base font-semibold text-slate-900">{parent?.name || "Parent"}</p>
              <p className="text-xs text-slate-400">{parent?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 font-bold border-indigo-200 rounded px-2">{parent?.student_count || 0} children</Badge>
            {hasChanges && <span className="text-xs text-amber-600 italic">Unsaved changes</span>}
          </div>
        </div>

        {/* Split Section Layout: Content Forms */}
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] items-start">
          
          {/* Identity Parameters Box */}
          <Card className="border-slate-200 shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-5">
              <CardTitle className="text-base font-bold text-slate-900">Identity Configuration</CardTitle>
              <CardDescription>Update primary database vectors safely.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="edit-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Full Name</Label>
                <Input id="edit-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-10 mt-1 rounded-lg" />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Communication Email Address</Label>
                <Input id="edit-email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-10 mt-1 rounded-lg" />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-phone" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Secure Telephone Line</Label>
                <Input id="edit-phone" type="tel" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="h-10 mt-1 rounded-lg" />
              </div>

              {/* Toggle Panel Container */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 p-4 mt-6">
                <div className="space-y-0.5 pr-2">
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    {form.is_active ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-500" />}
                    Platform Activity Core
                  </p>
                  <p className="text-xs text-slate-500">De-allocating keys blocks linked dashboards immediately.</p>
                </div>
                <Button 
                  type="button" size="sm" variant={form.is_active ? "default" : "outline"} 
                  className={`rounded-lg min-w-[90px] font-medium transition-all ${form.is_active ? "bg-emerald-600 hover:bg-emerald-700" : "text-slate-700 bg-white"}`}
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                >
                  {form.is_active ? "Active" : "Suspended"}
                </Button>
              </div>

              <div className="flex items-center justify-end border-t border-slate-100 pt-4 mt-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleCancelChanges} disabled={!hasChanges || saving}>
                    Cancel
                  </Button>
                  <Button aria-label="commit-changes" className="rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-xs gap-2 px-4 h-10" onClick={handleCommitChanges} disabled={saving || !hasChanges}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving..." : "Commit Changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connected Children Nodes View */}
          <Card className="border-slate-200 shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Dependent Links</CardTitle>
                <CardDescription>Mapped student tracking contexts.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 font-bold border-indigo-200 rounded px-2">{parent?.student_count || 0}</Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-3 max-h-[480px] overflow-y-auto">
              {parent && parent.students.length > 0 ? (
                parent.students.map((student) => (
                  <Link
                    key={student.id}
                    href={`/admin/students/${student.id}/report`}
                    className="group block rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-md border text-slate-400 mt-0.5 transition-colors group-hover:border-indigo-200 group-hover:text-indigo-600">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{student.name}</p>
                          <span className="text-[11px] font-medium text-slate-400 group-hover:text-indigo-500">Open report</span>
                        </div>
                        <p className="text-xs font-mono text-slate-400">{student.student_id || "No active ID"}</p>
                        <p className="text-xs font-medium text-indigo-600 mt-1.5 bg-indigo-50/80 px-2 py-0.5 rounded w-max">
                          {student.class_name || "Unassigned Cohort"}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">No connected students yet.</p>
                  <p className="mt-1 text-xs text-slate-400">When a student is linked to this parent, their profile will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}