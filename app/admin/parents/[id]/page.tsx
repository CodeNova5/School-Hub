"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

  async function handleCommitChanges() {
    try {
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
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
        
        {/* Navigation Action Bar */}
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="rounded-lg gap-2 text-slate-600 hover:bg-slate-100">
            <Link href="/admin/parents">
              <ArrowLeft className="h-4 w-4" /> Back to Directory
            </Link>
          </Button>
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
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Communication Email Address</Label>
                <Input id="edit-email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-10 mt-1 rounded-lg" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-phone" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Secure Telephone Line</Label>
                <Input id="edit-phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="h-10 mt-1 rounded-lg" />
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
                <Button className="rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-xs gap-2 px-4 h-10" onClick={handleCommitChanges} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Commit Changes
                </Button>
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
                  <div key={student.id} className="rounded-lg border border-slate-150 bg-slate-50/50 p-3.5 flex items-start gap-3">
                    <div className="p-2 bg-white rounded-md border text-slate-400 mt-0.5">
                      <GraduationCap className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                      <p className="text-xs font-mono text-slate-400">{student.student_id || "No active ID"}</p>
                      <p className="text-xs font-medium text-indigo-600 mt-1.5 bg-indigo-50/80 px-2 py-0.5 rounded w-max">
                        {student.class_name || "Unassigned Cohort"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-6">No independent students connected to this entity reference.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}