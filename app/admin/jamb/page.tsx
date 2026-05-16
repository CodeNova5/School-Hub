"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSchoolContext } from "@/hooks/use-school-context";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, ShieldOff, Users } from "lucide-react";

type StudentAccessRow = {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  class_name: string;
  jamb_access: {
    id: string;
    is_active: boolean;
    granted_at: string | null;
    revoked_at: string | null;
    notes: string | null;
  } | null;
};

export default function AdminJambPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [students, setStudents] = useState<StudentAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const studentsPerPage = 10;

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadStudents();
    }
  }, [schoolId, schoolLoading]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  async function loadStudents() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/jamb-access");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load JAMB access data");
      }

      setStudents(result.data || []);
      setCurrentPage(1);
    } catch (error: any) {
      toast.error(error.message || "Unable to load JAMB access data");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAccess(studentId: string, active: boolean) {
    try {
      setUpdatingStudentId(studentId);
      const response = await fetch("/api/admin/jamb-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, active }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update JAMB access");
      }

      setStudents((current) =>
        current.map((student) =>
          student.id === studentId
            ? {
                ...student,
                jamb_access: result.data,
              }
            : student
        )
      );

      toast.success(active ? "JAMB access granted" : "JAMB access revoked");
    } catch (error: any) {
      toast.error(error.message || "Failed to update access");
    } finally {
      setUpdatingStudentId(null);
    }
  }

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return students;

    return students.filter((student) => {
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      return (
        fullName.includes(term) ||
        student.student_id?.toLowerCase().includes(term) ||
        student.class_name?.toLowerCase().includes(term)
      );
    });
  }, [searchTerm, students]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / studentsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const paginatedStudents = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * studentsPerPage;
    return filteredStudents.slice(startIndex, startIndex + studentsPerPage);
  }, [filteredStudents, safeCurrentPage]);

  const startItem = filteredStudents.length === 0 ? 0 : (safeCurrentPage - 1) * studentsPerPage + 1;
  const endItem = Math.min(safeCurrentPage * studentsPerPage, filteredStudents.length);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">JAMB CBT Access</h1>
            <p className="mt-1 text-gray-600">
              Grant or revoke JAMB practice access for individual students.
            </p>
          </div>
          <Button onClick={loadStudents} variant="outline" className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Students only see the JAMB CBT feature when access is enabled here.
          </AlertDescription>
        </Alert>

        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle>Students</CardTitle>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name, ID, or class"
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No students matched your search.</div>
            ) : (
              <>
                <div className="divide-y">
                  {paginatedStudents.map((student) => {
                    const accessActive = Boolean(student.jamb_access?.is_active);
                    const disabled = updatingStudentId === student.id;

                    return (
                      <div
                        key={student.id}
                        className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-base font-semibold text-gray-900">
                              {student.first_name} {student.last_name}
                            </h3>
                            <Badge variant={accessActive ? "success" : "outline"}>
                              {accessActive ? "Access enabled" : "Locked"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {student.student_id || "No student ID"} · {student.class_name}
                          </p>
                          {student.jamb_access?.notes ? (
                            <p className="text-xs text-gray-500">Note: {student.jamb_access.notes}</p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3">
                          <ShieldOff className={`h-4 w-4 ${accessActive ? "text-gray-400" : "text-red-500"}`} />
                          <Switch
                            checked={accessActive}
                            disabled={disabled}
                            onCheckedChange={(checked) => toggleAccess(student.id, checked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-4 border-t px-5 py-4 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
                  <p>
                    Showing {startItem}-{endItem} of {filteredStudents.length} students
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </Button>
                    <span className="min-w-24 text-center">
                      Page {safeCurrentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}