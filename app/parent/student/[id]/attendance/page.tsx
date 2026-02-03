"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { AttendanceTimeline } from "@/components/attendance-timeline";
import { 
  ArrowLeft, 
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Minus
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: string;
  status: "present" | "late" | "excused" | "absent";
  time_in: string | null;
  time_out: string | null;
  subject_id: string;
  subjects?: {
    name: string;
  };
}

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  classes?: {
    name: string;
  };
}

export default function ParentStudentAttendancePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [studentId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/parent/login");
        return;
      }

      // Verify parent and get student
      const { data: parent } = await supabase
        .from("parents")
        .select("email")
        .eq("user_id", user.id)
        .single();

      if (!parent) {
        toast.error("Parent account not found");
        router.push("/parent/dashboard");
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*, classes(name)")
        .eq("id", studentId)
        .eq("parent_email", parent.email)
        .single();

      if (studentError || !studentData) {
        toast.error("Student not found or not authorized");
        router.push("/parent/dashboard");
        return;
      }

      setStudent(studentData);

      // Get attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("*, subjects(name)")
        .eq("student_id", studentId)
        .order("date", { ascending: false });

      if (attendanceError) throw attendanceError;

      setAttendance(attendanceData || []);
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return null;
  }

  const totalRecords = attendance.length;
  const presentCount = attendance.filter(a => a.status === "present").length;
  const lateCount = attendance.filter(a => a.status === "late").length;
  const absentCount = attendance.filter(a => a.status === "absent").length;
  const excusedCount = attendance.filter(a => a.status === "excused").length;

  const attendanceRate = totalRecords === 0 ? 0 : Math.round(((presentCount + lateCount + excusedCount) / totalRecords) * 100);

  return (
    <DashboardLayout role="parent">
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {student.first_name} {student.last_name} - Attendance
            </h1>
            <p className="text-gray-600 mt-1">
              {student.student_id} • {student.classes?.name || "No Class"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{attendanceRate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Present</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Late</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Absent</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{absentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Excused</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{excusedCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {attendance.length > 0 ? (
              <AttendanceTimeline attendance={attendance} />
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No attendance records yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Subject</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Time In</th>
                    <th className="text-left py-3 px-4">Time Out</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((record) => (
                    <tr key={record.id} className="border-b">
                      <td className="py-3 px-4">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{record.subjects?.name || "N/A"}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          record.status === "present" ? "bg-green-100 text-green-700" :
                          record.status === "late" ? "bg-yellow-100 text-yellow-700" :
                          record.status === "absent" ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{record.time_in || "-"}</td>
                      <td className="py-3 px-4">{record.time_out || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {attendance.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No attendance records found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
