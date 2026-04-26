"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Eye, Loader2, Search, XCircle } from "lucide-react";

interface AlumniApplication {
  id: string;
  full_name: string;
  occupation: string;
  email: string;
  phone: string;
  story: string;
  image_url: string;
  status: "pending" | "approved" | "rejected";
  review_notes: string;
  submitted_at: string;
  reviewed_at: string | null;
  linkedin_url?: string;
  x_url?: string;
  tiktok_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  website_url?: string;
}

export default function AdminAlumniPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [applications, setApplications] = useState<AlumniApplication[]>([]);

  const [selected, setSelected] = useState<AlumniApplication | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  async function loadApplications() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/admin/alumni/applications?${params.toString()}`);
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load alumni applications");
      }

      setApplications(payload.data.applications || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to load applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, [statusFilter]);

  const stats = useMemo(
    () => ({
      pending: applications.filter((item) => item.status === "pending").length,
      approved: applications.filter((item) => item.status === "approved").length,
      rejected: applications.filter((item) => item.status === "rejected").length,
    }),
    [applications]
  );

  function statusBadge(status: string) {
    if (status === "approved") return <Badge className="bg-emerald-600">Approved</Badge>;
    if (status === "rejected") return <Badge className="bg-red-600">Rejected</Badge>;
    return <Badge className="bg-amber-500">Pending</Badge>;
  }

  async function approveApplication() {
    if (!selected) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/alumni/applications/${selected.id}/approve`, {
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Approval failed");
      }

      toast({
        title: "Approved",
        description: "Alumni profile published successfully.",
      });

      setViewOpen(false);
      setSelected(null);
      await loadApplications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Approval failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  async function rejectApplication() {
    if (!selected) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/alumni/applications/${selected.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Rejection failed");
      }

      toast({
        title: "Rejected",
        description: "Application has been rejected.",
      });

      setRejectOpen(false);
      setViewOpen(false);
      setSelected(null);
      setRejectionReason("");
      await loadApplications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Rejection failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Alumni Applications</h1>
            <p className="text-sm text-slate-600">
              Review, approve, and reject alumni profile submissions.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pending}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Approved</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.approved}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Rejected</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <div>
              <Label className="text-xs text-slate-500">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-slate-500">Search</Label>
              <Input
                className="mt-1"
                placeholder="Name, occupation, or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void loadApplications();
                  }
                }}
              />
            </div>

            <Button className="self-end" variant="outline" onClick={() => loadApplications()}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Applicant</th>
                  <th className="px-4 py-3 font-medium">Occupation</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading applications...
                    </td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No applications found.
                    </td>
                  </tr>
                ) : (
                  applications.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                            <img src={item.image_url} alt={item.full_name} className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{item.full_name}</p>
                            <p className="text-xs text-slate-500">{item.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.occupation}</td>
                      <td className="px-4 py-3">{statusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(item.submitted_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(item);
                            setViewOpen(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alumni Application</DialogTitle>
            <DialogDescription>Review details before approving or rejecting.</DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                <div className="overflow-hidden rounded-lg border">
                  <img src={selected.image_url} alt={selected.full_name} className="h-full w-full object-cover" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900">{selected.full_name}</p>
                  <p className="text-sm text-slate-600">{selected.occupation}</p>
                  <p className="text-sm text-slate-600">{selected.email}</p>
                  {selected.phone ? <p className="text-sm text-slate-600">{selected.phone}</p> : null}
                  <div>{statusBadge(selected.status)}</div>
                </div>
              </div>

              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Story</p>
                <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{selected.story}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ["LinkedIn", selected.linkedin_url],
                  ["X", selected.x_url],
                  ["TikTok", selected.tiktok_url],
                  ["Instagram", selected.instagram_url],
                  ["Facebook", selected.facebook_url],
                  ["Website", selected.website_url],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <a
                      key={String(label)}
                      href={String(value)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      {label}
                    </a>
                  ))}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            {selected?.status === "pending" ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setRejectOpen(true)}
                  disabled={processing}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={approveApplication} disabled={processing}>
                  {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Approve and Publish
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejecting this alumni profile application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Reason for rejection..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={rejectApplication} disabled={processing}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
