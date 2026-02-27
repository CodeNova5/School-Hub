"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAttendance(date: string) {
    setAttendanceLoading(true);
    try {
      const [{ data: studentsData, error: studentsError }, { data: attendanceData, error: attendanceError }] = await Promise.all([
        supabase.from("students").select("* ").eq("class_id", classId),
        supabase.from("attendance").select("*").eq("class_id", classId).eq("date", date),
      ]);

      if (studentsError || attendanceError) throw new Error("Failed to fetch attendance data");

      const studentsWithAttendance: StudentAttendance[] = (studentsData || []).map((student: any) => {
        const attendance = (attendanceData || []).find((a: any) => a.student_id === student.id);
        return {
          ...student,
          attendanceStatus: attendance ? (attendance.status as any) : "not_marked",
          attendanceId: attendance?.id,
        };
      });

      setAttendanceStudents(studentsWithAttendance);
    } catch (error) {
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

  // Get notification message based on attendance status
  function getNotificationMessage(
    status: string,
    studentName: string
  ): { title: string; body: string } {
    const statusMessages: Record<string, { title: string; body: string }> = {
      present: {
        title: "✅ Student Present",
        body: `${studentName} was marked present on ${new Date(selectedDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}.`,
      },
      absent: {
        title: "❌ Student Absent",
        body: `${studentName} was marked absent on ${new Date(selectedDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}. Please contact the school if this is an error.`,
      },
      late: {
        title: "⏰ Student Late",
        body: `${studentName} was marked late on ${new Date(selectedDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}.`,
      },
      excused: {
        title: "📋 Absence Excused",
        body: `${studentName}'s absence on ${new Date(selectedDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} has been marked as excused.`,
      },
    };
    return (
      statusMessages[status] || {
        title: "Attendance Updated",
        body: `${studentName}'s attendance has been updated.`,
      }
    );
  }

  // Send notifications to parents
  async function sendNotificationsToParents(
    attendanceRecords: Array<{
      student_id: string;
      status: string;
      studentName: string;
    }>
  ) {
    try {
      console.log(`📱 Starting to send attendance notifications to ${attendanceRecords.length} students...`);

      let successCount = 0;
      let failureCount = 0;

      for (const record of attendanceRecords) {
        try {
          // Get student's parent email
          const { data: student, error: studentError } = await supabase
            .from("students")
            .select("parent_email, parent_name")
            .eq("id", record.student_id)
            .single();

          if (studentError) {
            console.error(`❌ Error fetching student ${record.student_id}:`, studentError);
            failureCount++;
            continue;
          }

          if (!student?.parent_email) {
            console.warn(
              `⚠️ No parent email found for student ${record.student_id} (${record.studentName})`
            );
            failureCount++;
            continue;
          }

          console.log(`🔍 Looking up parent account for email: ${student.parent_email}`);

          // Find parent user by email
          const { data: parent, error: parentError } = await supabase
            .from("parents")
            .select("user_id, id, is_active")
            .eq("email", student.parent_email)
            .single();

          if (parentError) {
            console.error(
              `❌ Error finding parent account for ${student.parent_email}:`,
              parentError.message
            );
            failureCount++;
            continue;
          }

          if (!parent) {
            console.warn(
              `⚠️ No parent account found for email ${student.parent_email}. Parent may not be registered.`
            );
            failureCount++;
            continue;
          }

          if (!parent?.user_id) {
            console.warn(
              `⚠️ Parent account exists but has no user_id for ${student.parent_email}`
            );
            failureCount++;
            continue;
          }

          if (!parent.is_active) {
            console.warn(
              `⚠️ Parent account is inactive for ${student.parent_email}. They need to activate their account.`
            );
            failureCount++;
            continue;
          }

          console.log(`👤 Found parent: ${parent.user_id}`);

          // Get parent's notification tokens
          const { data: tokens, error: tokensError } = await supabase
            .from("notification_tokens")
            .select("token, user_id, device_type, is_active")
            .eq("user_id", parent.user_id)
            .eq("is_active", true);

          if (tokensError) {
            console.error(
              `❌ Error fetching tokens for parent ${student.parent_email}:`,
              tokensError
            );
            failureCount++;
            continue;
          }

          if (!tokens || tokens.length === 0) {
            console.warn(
              `⚠️ No active notification tokens found for parent ${student.parent_email}. Parent may not have enabled notifications.`
            );
            failureCount++;
            continue;
          }

          console.log(
            `📲 Found ${tokens.length} active notification token(s) for parent ${student.parent_email}`
          );

          // Get notification message
          const { title, body } = getNotificationMessage(
            record.status,
            record.studentName
          );

          console.log(`📤 Sending notification to parent ${student.parent_email}...`);

          // Send notification via API
          const response = await fetch("/api/admin/send-notification", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title,
              body,
              target: "user",
              targetValue: parent.user_id,
              data: {
                type: "attendance",
                studentId: record.student_id,
                status: record.status,
                date: selectedDate,
              },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `❌ API Error (${response.status}) for parent ${student.parent_email}:`,
              errorText
            );
            failureCount++;
            continue;
          }

          try {
            const result = await response.json();
            if (result.success || result.successCount > 0) {
              console.log(
                `✅ Notification sent to parent ${student.parent_email}: ${result.successCount || 1} delivered`
              );
              successCount++;
            } else {
              console.error(
                `❌ API returned error for parent ${student.parent_email}:`,
                result
              );
              failureCount++;
            }
          } catch (parseError) {
            console.error(
              `❌ Failed to parse API response for parent ${student.parent_email}:`,
              parseError
            );
            failureCount++;
          }
        } catch (error) {
          console.error(`❌ Unexpected error processing student ${record.student_id}:`, error);
          failureCount++;
        }
      }

      console.log(
        `\n📊 Notification Summary:\n✅ Sent: ${successCount}\n❌ Failed: ${failureCount}\n📱 Total: ${attendanceRecords.length}`
      );

      if (failureCount > 0) {
        toast.warning(
          `${successCount}/${attendanceRecords.length} parent notifications sent. Check browser console for details.`
        );
      } else if (successCount > 0) {
        toast.success(`✅ All ${successCount} parent notifications sent successfully!`);
      }
    } catch (error) {
      console.error("Fatal error in sendNotificationsToParents:", error);
      toast.error("Failed to send parent notifications. Check console for details.");
    }
  }

  // ...existing code...
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
        if (deleteIds.length > 0) {
          await supabase.from("attendance").delete().in("id", deleteIds);
        }
      }

      // Insert new records
      if (attendanceRecords.length > 0) {
        await supabase.from("attendance").insert(attendanceRecords);
      }

      // Send notifications to parents
      if (attendanceRecords.length > 0) {
        const notificationRecords = attendanceRecords.map((record) => {
          const student = attendanceStudents.find((s) => s.id === record.student_id);
          return {
            student_id: record.student_id,
            status: record.status,
            studentName: student ? `${student.first_name} ${student.last_name}` : "Student",
          };
        });

        // Send notifications asynchronously without blocking the save
        sendNotificationsToParents(notificationRecords).catch((error) =>
          console.error("Error in notification sending:", error)
        );
      }

      toast.success("Attendance saved successfully!", { id: savingToast });
      await fetchAttendance(selectedDate);
    } catch (error) {
      toast.error("Failed to save attendance", { id: savingToast });
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
