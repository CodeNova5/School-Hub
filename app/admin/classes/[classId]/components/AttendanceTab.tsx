"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import * as XLSX from "xlsx-js-style";

interface StudentAttendance {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  attendanceStatus: "present" | "absent" | "late" | "excused" | "not_marked";
  attendanceId?: string;
}

interface AttendanceTabProps {
  classId: string;
  className: string;
}

export function AttendanceTab({ classId, className }: AttendanceTabProps) {
  const [attendanceStudents, setAttendanceStudents] = useState<StudentAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, []);

  async function fetchAttendance(date: string) {
    setAttendanceLoading(true);
    try {
      const [studentsData, attendanceData] = await Promise.all([
        apiClient.readStudents(classId),
        apiClient.apiRead({
          table: "attendance",
          select: "*",
          filters: { class_id: classId, date },
        }),
      ]);

      const studentsWithAttendance: StudentAttendance[] = (studentsData || []).map((student: any) => {
        const attendance = attendanceData?.find((a: any) => a.student_id === student.id);
        return {
          ...student,
          attendanceStatus: attendance ? (attendance.status as any) : "not_marked",
          attendanceId: attendance?.id,
        };
      });

      setAttendanceStudents(studentsWithAttendance);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error("Failed to load attendance");
    } finally {
      setAttendanceLoading(false);
    }
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    fetchAttendance(date);
  }

  function setToday() {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
    fetchAttendance(today);
  }

  function markAllPresent() {
    setAttendanceStudents((prev) =>
      prev.map((student) => ({
        ...student,
        attendanceStatus: "present",
      }))
    );
    toast.success("All students marked as present");
  }

  function updateStudentAttendanceStatus(
    studentId: string,
    status: StudentAttendance["attendanceStatus"]
  ) {
    setAttendanceStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, attendanceStatus: status } : student
      )
    );
  }

  async function submitAttendance() {
    setAttendanceLoading(true);
    const savingToast = toast.loading("Saving attendance...");

    try {
      const attendanceRecords = attendanceStudents
        .filter((s) => s.attendanceStatus !== "not_marked")
        .map((student) => ({
          student_id: student.id,
          class_id: classId,
          date: selectedDate,
          status: student.attendanceStatus,
          marked_by: null,
        }));

      const existingRecords = attendanceStudents.filter((s) => s.attendanceId);

      // Delete existing records
      if (existingRecords.length > 0) {
        const deleteIds = existingRecords.map((s) => s.attendanceId).filter(Boolean);
        for (const id of deleteIds) {
          await apiClient.apiWrite({
            table: "attendance",
            operation: "delete",
            filters: { id },
          });
        }
      }

      // Insert new records
      if (attendanceRecords.length > 0) {
        await apiClient.apiWrite({
          table: "attendance",
          operation: "insert",
          data: attendanceRecords,
        });
      }

      toast.success("Attendance saved successfully!", { id: savingToast });
      await fetchAttendance(selectedDate);
    } catch (error) {
      toast.error("Failed to save attendance", { id: savingToast });
      console.error(error);
    } finally {
      setAttendanceLoading(false);
    }
  }

  function getFormattedDate(dateString: string) {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  async function handleExportAttendance() {
    const exportData = attendanceStudents.map((s, i) => ({
      "#": i + 1,
      "Student ID": s.student_id,
      Name: `${s.first_name} ${s.last_name}`,
      Gender: s.gender,
      Status: s.attendanceStatus.replace("_", " ").toUpperCase(),
      Date: selectedDate,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `${className || "class"}-attendance-${selectedDate}.xlsx`);
    toast.success("Attendance exported successfully");
  }

  const statusColors = {
    present: "bg-green-100 text-green-800",
    absent: "bg-red-100 text-red-800",
    late: "bg-yellow-100 text-yellow-800",
    excused: "bg-blue-100 text-blue-800",
    not_marked: "bg-gray-100 text-gray-800",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Class Attendance</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportAttendance}
              disabled={attendanceLoading}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Selection and Quick Actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b">
          <div className="flex-1">
            <Label className="block text-sm font-medium mb-2">Select Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={setToday}>
                Today
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-1">{getFormattedDate(selectedDate)}</p>
          </div>

          <div>
            <Label className="block text-sm font-medium mb-2">Quick Actions</Label>
            <Button onClick={markAllPresent} variant="outline" disabled={attendanceLoading}>
              Mark All Present
            </Button>
          </div>
        </div>

        {/* Attendance List */}
        {attendanceLoading ? (
          <div className="text-center py-8 text-gray-500">Loading attendance data...</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg font-medium text-sm">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Student Name</div>
              <div className="col-span-2">Gender</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Action</div>
            </div>

            {attendanceStudents.map((student, index) => (
              <div
                key={student.id}
                className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg items-center hover:bg-gray-50"
              >
                <div className="col-span-1 text-gray-600">{index + 1}</div>
                <div className="col-span-4">
                  <p className="font-medium">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{student.student_id}</p>
                </div>
                <div className="col-span-2 text-sm text-gray-600 capitalize">
                  {student.gender || "N/A"}
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      statusColors[student.attendanceStatus]
                    }`}
                  >
                    {student.attendanceStatus.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <div className="col-span-3">
                  <select
                    value={student.attendanceStatus}
                    onChange={(e) =>
                      updateStudentAttendanceStatus(
                        student.id,
                        e.target.value as StudentAttendance["attendanceStatus"]
                      )
                    }
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  >
                    <option value="not_marked">Not Marked</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>
            ))}

            {attendanceStudents.length === 0 && (
              <div className="text-center py-8 text-gray-500">No students found in this class</div>
            )}
          </div>
        )}

        {/* Save Button */}
        {attendanceStudents.length > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={submitAttendance} disabled={attendanceLoading} className="flex-1">
              Save Attendance
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
