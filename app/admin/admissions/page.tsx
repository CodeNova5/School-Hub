"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  Search,
  Filter,
  Users,
  Clock,
  UserCheck,
  UserX,
} from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Application {
  id: string;
  application_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  desired_class: string;
  previous_school: string;
  notes: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
}

interface Class {
  id: string;
  name: string;
  level: string;
  education_level: string;
  department: string | null;
}

export default function AdminAdmissionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Approval form data
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedReligion, setSelectedReligion] = useState("");

  // Rejection reason
  const [rejectionReason, setRejectionReason] = useState("");

  // Filter options
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [desiredClassFilter, setDesiredClassFilter] = useState("all");

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchApplications();
    fetchClasses();
  }, [statusFilter]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admissions/list?status=${statusFilter}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const fetchedApps = data.applications || [];
      setApplications(fetchedApps);

      // Auto-fallback to "all" if pending is selected but empty
      if (statusFilter === "pending" && fetchedApps.length === 0) {
        setStatusFilter("all");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, level, education_level, department");

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const handleApprove = async () => {
    if (!selectedClassId) {
      toast({
        title: "Error",
        description: "Please select a class",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/admissions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApplication?.id,
          classId: selectedClassId,
          department: selectedDepartment === "none" ? null : selectedDepartment,
          religion: selectedReligion === "none" ? null : selectedReligion,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      toast({
        title: "Success",
        description: `Application approved. Student ID: ${data.studentId}`,
      });

      setApproveDialogOpen(false);
      setSelectedApplication(null);
      setSelectedClassId("");
      setSelectedDepartment("");
      setSelectedReligion("");
      fetchApplications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      const response = await fetch("/api/admissions/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApplication?.id,
          reason: rejectionReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      toast({
        title: "Success",
        description: "Application rejected successfully",
      });

      setRejectDialogOpen(false);
      setSelectedApplication(null);
      setRejectionReason("");
      fetchApplications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredApplications = applications.filter((app) => {
    const searchLower = searchQuery.toLowerCase();
    
    // Search filter
    const matchesSearch =
      app.application_number.toLowerCase().includes(searchLower) ||
      app.first_name.toLowerCase().includes(searchLower) ||
      app.last_name.toLowerCase().includes(searchLower) ||
      app.parent_name.toLowerCase().includes(searchLower) ||
      app.parent_email.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Desired class filter
    if (desiredClassFilter !== "all" && app.desired_class !== desiredClassFilter) {
      return false;
    }

    // Date range filter
    if (startDate || endDate) {
      const appDate = new Date(app.submitted_at).setHours(0, 0, 0, 0);
      
      if (startDate) {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        if (appDate < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (appDate > end) return false;
      }
    }

    return true;
  });

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <DashboardLayout role="admin">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admissions Management</h1>
          <p className="text-gray-600 mt-1">Review and manage student applications</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
              <Users className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <UserX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Filter and search through applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search Bar */}
              <div>
                <Label className="text-sm mb-2 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, or application number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filter Row 1: Status and Desired Class */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-2 block">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Desired Class</Label>
                  <Select value={desiredClassFilter} onValueChange={setDesiredClassFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {Array.from(new Set(applications.map((app) => app.desired_class))).map(
                        (desiredClass) => (
                          <SelectItem key={desiredClass} value={desiredClass}>
                            {desiredClass}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filter Row 2: Date Range */}
              <div>
                <Label className="text-sm mb-2 block">Date Range</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date" className="text-xs text-gray-600">
                      From
                    </Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date" className="text-xs text-gray-600">
                      To
                    </Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(searchQuery || startDate || endDate || desiredClassFilter !== "all") && (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStartDate("");
                      setEndDate("");
                      setDesiredClassFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Applications Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No applications found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>App Number</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Parent Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Desired Class</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-mono text-sm">{app.application_number}</TableCell>
                        <TableCell className="font-medium">
                          {app.first_name} {app.last_name}
                        </TableCell>
                        <TableCell>{app.parent_name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{app.parent_email}</div>
                            <div className="text-gray-500">{app.parent_phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>{app.desired_class}</TableCell>
                        <TableCell>{getStatusBadge(app.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(app.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedApplication(app);
                                setViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {app.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => {
                                    setSelectedApplication(app);
                                    setApproveDialogOpen(true);
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedApplication(app);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Application Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
              <DialogDescription>
                Application Number: {selectedApplication?.application_number}
              </DialogDescription>
            </DialogHeader>

            {selectedApplication && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 border-b pb-2">Student Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">First Name</Label>
                      <p className="font-medium">{selectedApplication.first_name}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Last Name</Label>
                      <p className="font-medium">{selectedApplication.last_name}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Date of Birth</Label>
                      <p className="font-medium">
                        {selectedApplication.date_of_birth
                          ? new Date(selectedApplication.date_of_birth).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Gender</Label>
                      <p className="font-medium capitalize">{selectedApplication.gender}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Email</Label>
                      <p className="font-medium">{selectedApplication.email || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Phone</Label>
                      <p className="font-medium">{selectedApplication.phone || "N/A"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-gray-600">Address</Label>
                      <p className="font-medium">{selectedApplication.address}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 border-b pb-2">Parent/Guardian Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Parent Name</Label>
                      <p className="font-medium">{selectedApplication.parent_name}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Parent Email</Label>
                      <p className="font-medium">{selectedApplication.parent_email}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-gray-600">Parent Phone</Label>
                      <p className="font-medium">{selectedApplication.parent_phone}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 border-b pb-2">Academic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Desired Class</Label>
                      <p className="font-medium">{selectedApplication.desired_class}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Previous School</Label>
                      <p className="font-medium">{selectedApplication.previous_school || "N/A"}</p>
                    </div>
                    {selectedApplication.notes && (
                      <div className="col-span-2">
                        <Label className="text-gray-600">Additional Notes</Label>
                        <p className="font-medium">{selectedApplication.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 border-b pb-2">Application Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600">Status</Label>
                      <div className="mt-1">{getStatusBadge(selectedApplication.status)}</div>
                    </div>
                    <div>
                      <Label className="text-gray-600">Submitted At</Label>
                      <p className="font-medium">
                        {new Date(selectedApplication.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    {selectedApplication.reviewed_at && (
                      <div>
                        <Label className="text-gray-600">Reviewed At</Label>
                        <p className="font-medium">
                          {new Date(selectedApplication.reviewed_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Approve Application Dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Application</DialogTitle>
              <DialogDescription>
                Approving will create a student record and send activation emails.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Student Name</Label>
                <p className="font-medium">
                  {selectedApplication?.first_name} {selectedApplication?.last_name}
                </p>
              </div>

              <div>
                <Label htmlFor="class_id">Assign to Class *</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="department">Department (Optional)</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Science">Science</SelectItem>
                    <SelectItem value="Arts">Arts</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="religion">Religion (Optional)</Label>
                <Select value={selectedReligion} onValueChange={setSelectedReligion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select religion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Christian">Christian</SelectItem>
                    <SelectItem value="Muslim">Muslim</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={processing || !selectedClassId}>
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve & Create Student
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Application Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>
                Are you sure you want to reject this application?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Student Name</Label>
                <p className="font-medium">
                  {selectedApplication?.first_name} {selectedApplication?.last_name}
                </p>
              </div>

              <div>
                <Label htmlFor="reason">Reason for Rejection (Optional)</Label>
                <Textarea
                  id="reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Application
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}