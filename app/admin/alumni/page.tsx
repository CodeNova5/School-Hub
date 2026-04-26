"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CheckCircle2, Edit3, Eye, Loader2, Search, Trash2, XCircle } from "lucide-react";

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

interface AlumniProfile {
  id: string;
  profile_slug: string;
  full_name: string;
  occupation: string;
  story: string;
  image_url: string;
  is_visible: boolean;
  linkedin_url?: string;
  x_url?: string;
  tiktok_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  website_url?: string;
  created_at: string;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminAlumniPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("applications");
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [statusFilter, setStatusFilter] = useState("pending");
  const [applicationsSearchQuery, setApplicationsSearchQuery] = useState("");
  const [profilesSearchQuery, setProfilesSearchQuery] = useState("");

  const [applicationsPage, setApplicationsPage] = useState(1);
  const [profilesPage, setProfilesPage] = useState(1);
  const pageSize = 10;

  const [applications, setApplications] = useState<AlumniApplication[]>([]);
  const [applicationsPagination, setApplicationsPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
  });
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [bulkRejectionReason, setBulkRejectionReason] = useState("");

  const [profiles, setProfiles] = useState<AlumniProfile[]>([]);
  const [profilesPagination, setProfilesPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
  });

  const [selected, setSelected] = useState<AlumniApplication | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [editingProfile, setEditingProfile] = useState<AlumniProfile | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  async function loadApplications(options?: { resetPage?: boolean }) {
    try {
      setLoadingApplications(true);
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      params.set("page", String(options?.resetPage ? 1 : applicationsPage));
      params.set("pageSize", String(pageSize));
      if (applicationsSearchQuery.trim()) {
        params.set("search", applicationsSearchQuery.trim());
      }

      const res = await fetch(`/api/admin/alumni/applications?${params.toString()}`);
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load alumni applications");
      }

      setApplications(payload.data.applications || []);
      setApplicationsPagination(
        payload.data.pagination || {
          page: 1,
          pageSize,
          total: 0,
          totalPages: 1,
        }
      );
      setSelectedApplicationIds([]);
      if (options?.resetPage) {
        setApplicationsPage(1);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to load applications",
        variant: "destructive",
      });
    } finally {
      setLoadingApplications(false);
    }
  }

  async function loadProfiles(options?: { resetPage?: boolean }) {
    try {
      setLoadingProfiles(true);
      const params = new URLSearchParams();
      params.set("page", String(options?.resetPage ? 1 : profilesPage));
      params.set("pageSize", String(pageSize));
      if (profilesSearchQuery.trim()) {
        params.set("search", profilesSearchQuery.trim());
      }

      const res = await fetch(`/api/admin/alumni/profiles?${params.toString()}`);
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load alumni profiles");
      }

      setProfiles(payload.data.profiles || []);
      setProfilesPagination(
        payload.data.pagination || {
          page: 1,
          pageSize,
          total: 0,
          totalPages: 1,
        }
      );
      if (options?.resetPage) {
        setProfilesPage(1);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to load profiles",
        variant: "destructive",
      });
    } finally {
      setLoadingProfiles(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, [statusFilter, applicationsPage]);

  useEffect(() => {
    loadProfiles();
  }, [profilesPage]);

  const stats = useMemo(
    () => ({
      pending: applications.filter((item) => item.status === "pending").length,
      approved: applications.filter((item) => item.status === "approved").length,
      rejected: applications.filter((item) => item.status === "rejected").length,
    }),
    [applications]
  );

  const allCurrentPageSelected =
    applications.length > 0 && applications.every((item) => selectedApplicationIds.includes(item.id));

  function toggleAllCurrentPage(selectedValue: boolean) {
    if (selectedValue) {
      setSelectedApplicationIds(applications.map((item) => item.id));
      return;
    }
    setSelectedApplicationIds([]);
  }

  function toggleSingleSelection(id: string, selectedValue: boolean) {
    setSelectedApplicationIds((prev) => {
      if (selectedValue) {
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }

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
      await loadProfiles();
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

  async function runBulkAction(action: "approve" | "reject") {
    if (selectedApplicationIds.length === 0) {
      toast({
        title: "No selection",
        description: "Select at least one application first.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/admin/alumni/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ids: selectedApplicationIds,
          reason: action === "reject" ? bulkRejectionReason.trim() : "",
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Bulk action failed");
      }

      toast({
        title: "Bulk action completed",
        description: `${payload.data.processedCount} application(s) updated.`,
      });

      setBulkRejectionReason("");
      await loadApplications();
      await loadProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Bulk action failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  async function saveProfileEdits() {
    if (!editingProfile) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/alumni/profiles/${editingProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProfile),
      });
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update profile");
      }

      toast({
        title: "Profile updated",
        description: "Alumni profile changes were saved.",
      });

      setEditProfileOpen(false);
      setEditingProfile(null);
      await loadProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to update profile",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  async function deleteProfile(profileId: string) {
    const shouldDelete = window.confirm("Delete this approved alumni profile?");
    if (!shouldDelete) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/alumni/profiles/${profileId}`, {
        method: "DELETE",
      });
      const payload = await res.json();

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to delete profile");
      }

      toast({
        title: "Profile deleted",
        description: "Approved alumni profile has been removed.",
      });

      await loadProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to delete profile",
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
              Review applications in bulk and manage approved alumni profiles.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="applications">Applications Review</TabsTrigger>
            <TabsTrigger value="profiles">Approved Profiles</TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-slate-500">Pending (page)</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-slate-500">Approved (page)</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.approved}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-slate-500">Rejected (page)</p>
                <p className="mt-1 text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                <div>
                  <Label className="text-xs text-slate-500">Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setApplicationsPage(1);
                    }}
                  >
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
                    value={applicationsSearchQuery}
                    onChange={(e) => setApplicationsSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void loadApplications({ resetPage: true });
                      }
                    }}
                  />
                </div>

                <Button className="self-end" variant="outline" onClick={() => loadApplications({ resetPage: true })}>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <Input
                  placeholder="Bulk rejection reason (optional)"
                  value={bulkRejectionReason}
                  onChange={(e) => setBulkRejectionReason(e.target.value)}
                />
                <Button
                  variant="destructive"
                  onClick={() => runBulkAction("reject")}
                  disabled={processing || selectedApplicationIds.length === 0}
                >
                  Reject Selected ({selectedApplicationIds.length})
                </Button>
                <Button
                  onClick={() => runBulkAction("approve")}
                  disabled={processing || selectedApplicationIds.length === 0}
                >
                  Approve Selected ({selectedApplicationIds.length})
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        <Checkbox
                          checked={allCurrentPageSelected}
                          onCheckedChange={(checked) => toggleAllCurrentPage(Boolean(checked))}
                        />
                      </th>
                      <th className="px-4 py-3 font-medium">Applicant</th>
                      <th className="px-4 py-3 font-medium">Occupation</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingApplications ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Loading applications...
                        </td>
                      </tr>
                    ) : applications.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No applications found.
                        </td>
                      </tr>
                    ) : (
                      applications.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedApplicationIds.includes(item.id)}
                              onCheckedChange={(checked) => toggleSingleSelection(item.id, Boolean(checked))}
                            />
                          </td>
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

            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-500">
                Page {applicationsPagination.page} of {applicationsPagination.totalPages} • {applicationsPagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={applicationsPagination.page <= 1}
                  onClick={() => setApplicationsPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={applicationsPagination.page >= applicationsPagination.totalPages}
                  onClick={() => setApplicationsPage((prev) => Math.min(applicationsPagination.totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profiles" className="space-y-4">
            <div className="rounded-lg border bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <Label className="text-xs text-slate-500">Search Approved Profiles</Label>
                  <Input
                    className="mt-1"
                    placeholder="Name, occupation, or slug"
                    value={profilesSearchQuery}
                    onChange={(e) => setProfilesSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void loadProfiles({ resetPage: true });
                      }
                    }}
                  />
                </div>
                <Button className="self-end" variant="outline" onClick={() => loadProfiles({ resetPage: true })}>
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
                      <th className="px-4 py-3 font-medium">Profile</th>
                      <th className="px-4 py-3 font-medium">Slug</th>
                      <th className="px-4 py-3 font-medium">Visibility</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingProfiles ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Loading profiles...
                        </td>
                      </tr>
                    ) : profiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          No approved profiles found.
                        </td>
                      </tr>
                    ) : (
                      profiles.map((profile) => (
                        <tr key={profile.id} className="border-b last:border-b-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                                <img src={profile.image_url} alt={profile.full_name} className="h-full w-full object-cover" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{profile.full_name}</p>
                                <p className="text-xs text-slate-500">{profile.occupation}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{profile.profile_slug}</td>
                          <td className="px-4 py-3">
                            {profile.is_visible ? <Badge className="bg-emerald-600">Visible</Badge> : <Badge variant="outline">Hidden</Badge>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{new Date(profile.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingProfile(profile);
                                  setEditProfileOpen(true);
                                }}
                              >
                                <Edit3 className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteProfile(profile.id)}
                                disabled={processing}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-500">
                Page {profilesPagination.page} of {profilesPagination.totalPages} • {profilesPagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={profilesPagination.page <= 1}
                  onClick={() => setProfilesPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={profilesPagination.page >= profilesPagination.totalPages}
                  onClick={() => setProfilesPage((prev) => Math.min(profilesPagination.totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
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

      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Approved Profile</DialogTitle>
            <DialogDescription>
              Update alumni details and social links. Changes apply immediately to the public profile.
            </DialogDescription>
          </DialogHeader>

          {editingProfile ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input
                    value={editingProfile.full_name}
                    onChange={(e) =>
                      setEditingProfile((prev) => (prev ? { ...prev, full_name: e.target.value } : prev))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Occupation</Label>
                  <Input
                    value={editingProfile.occupation}
                    onChange={(e) =>
                      setEditingProfile((prev) => (prev ? { ...prev, occupation: e.target.value } : prev))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Image URL</Label>
                <Input
                  value={editingProfile.image_url}
                  onChange={(e) =>
                    setEditingProfile((prev) => (prev ? { ...prev, image_url: e.target.value } : prev))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Story</Label>
                <Textarea
                  rows={6}
                  value={editingProfile.story}
                  onChange={(e) =>
                    setEditingProfile((prev) => (prev ? { ...prev, story: e.target.value } : prev))
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["linkedin_url", "LinkedIn URL"],
                  ["x_url", "X URL"],
                  ["tiktok_url", "TikTok URL"],
                  ["instagram_url", "Instagram URL"],
                  ["facebook_url", "Facebook URL"],
                  ["website_url", "Website URL"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input
                      value={(editingProfile as any)[key] || ""}
                      onChange={(e) =>
                        setEditingProfile((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingProfile.is_visible}
                  onCheckedChange={(checked) =>
                    setEditingProfile((prev) => (prev ? { ...prev, is_visible: Boolean(checked) } : prev))
                  }
                />
                <Label>Visible on public site</Label>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfileOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={saveProfileEdits} disabled={processing || !editingProfile}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
