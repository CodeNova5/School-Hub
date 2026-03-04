"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { Student } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface StudentAttendance {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  attendanceStatus: "present" | "absent" | "late" | "excused" | "not_marked";
  attendanceId?: string;
}

interface TeacherAttendanceTabProps {
  classId: string;
  className: string;
  students: Student[];
  schoolId?: string | null;
}

export default function TeacherAttendanceTab({
  classId,
  className,
  students,
  schoolId,
}: TeacherAttendanceTabProps) {
  const [attendanceStudents, setAttendanceStudents] = useState<StudentAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, [classId]);

  async function fetchAttendance(date: string) {
    setAttendanceLoading(true);
    try {
      let query = supabase
        .from("attendance")
        .select("*")
        .eq("class_id", classId)
        .eq("date", date);

      if (schoolId) {
        query = query.eq("school_id", schoolId);
      }

      const { data: attendanceData, error } = await query;

      const studentsWithAttendance: StudentAttendance[] = (students || []).map((student: any) => {
        const attendance = (Array.isArray(attendanceData) ? attendanceData : []).find(
          (a: any) => a.student_id === student.id
        );
        return {
          ...student,
          attendanceStatus: attendance ? (attendance.status as any) : "not_marked",
          attendanceId: attendance?.id,
        };
      });

      setAttendanceStudents(studentsWithAttendance);
    } catch (error) {
      console.error("Error fetching attendance:", error);
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
          let studentQuery = supabase
              .from("students")
              .select("parent_email, parent_name")
            .eq("id", record.student_id);

          if (schoolId) {
            studentQuery = studentQuery.eq("school_id", schoolId);
          }

          const { data: student, error: studentError } = await studentQuery.single();
  
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
            let parentQuery = supabase
              .from("parents")
              .select("user_id, id, is_active")
              .eq("email", student.parent_email);

            if (schoolId) {
              parentQuery = parentQuery.eq("school_id", schoolId);
            }

            const { data: parentArray, error: parentError } = await parentQuery;
  
            if (parentError) {
              console.error(
                `❌ Error finding parent account for ${student.parent_email}:`,
                parentError.message
              );
              failureCount++;
              continue;
            }
  
            if (!parentArray || parentArray.length === 0) {
              console.warn(
                `⚠️ No parent account found for email ${student.parent_email}. Parent may not be registered.`
              );
              failureCount++;
              continue;
            }

            const parent = parentArray[0];
  
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
          school_id: schoolId,
        }));

      const existingRecords = attendanceStudents.filter((s) => s.attendanceId);

      // Delete existing records
      if (existingRecords.length > 0) {
        const deleteIds = existingRecords.map((s) => s.attendanceId).filter(Boolean);
        if (deleteIds.length > 0) {
          let deleteQuery = supabase
            .from("attendance")
            .delete()
            .in("id", deleteIds);

          if (schoolId) {
            deleteQuery = deleteQuery.eq("school_id", schoolId);
          }

          const { error: deleteError } = await deleteQuery;
          if (deleteError) {
            throw deleteError;
          }
        }
      }

      // Insert new records
      if (attendanceRecords.length > 0) {
        const { error: insertError } = await supabase
          .from("attendance")
          .insert(attendanceRecords);
        if (insertError) {
          throw insertError;
        }
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
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <CardTitle className="text-lg sm:text-xl">Class Attendance</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportAttendance}
              disabled={attendanceLoading}
              className="text-xs sm:text-sm"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden xs:inline">Export</span>
              <span className="xs:hidden">Export</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        {/* Date Selection and Quick Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b">
          <div className="flex-1 w-full sm:w-auto">
            <Label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Select Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="flex-1 text-sm h-9 sm:h-10"
              />
              <Button variant="outline" onClick={setToday} className="text-xs sm:text-sm px-3 h-9 sm:h-10 shrink-0">
                Today
              </Button>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-1.5">{getFormattedDate(selectedDate)}</p>
          </div>

          <div className="w-full sm:w-auto">
            <Label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Quick Actions</Label>
            <Button 
              onClick={markAllPresent} 
              variant="outline" 
              disabled={attendanceLoading}
              className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
            >
              Mark All Present
            </Button>
          </div>
        </div>

        {/* Attendance List */}
        {attendanceLoading ? (
          <div className="text-center py-8 text-sm sm:text-base text-gray-500">Loading attendance data...</div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {/* Desktop Table Header - Hidden on mobile */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg font-medium text-sm">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Student Name</div>
              <div className="col-span-2">Gender</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Action</div>
            </div>

            {attendanceStudents.map((student, index) => (
              <div key={student.id}>
                {/* Desktop Layout */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-4 py-3 border rounded-lg items-center hover:bg-gray-50">
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

                {/* Mobile Card Layout */}
                <div className="lg:hidden border rounded-lg p-3 sm:p-4 space-y-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-sm sm:text-base truncate">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{student.student_id}</p>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium shrink-0 ${
                        statusColors[student.attendanceStatus]
                      }`}
                    >
                      {student.attendanceStatus.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs sm:text-sm">
                    <div className="flex-1">
                      <span className="text-gray-600">Gender: </span>
                      <span className="font-medium capitalize">{student.gender || "N/A"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Mark Attendance</Label>
                    <select
                      value={student.attendanceStatus}
                      onChange={(e) =>
                        updateStudentAttendanceStatus(
                          student.id,
                          e.target.value as StudentAttendance["attendanceStatus"]
                        )
                      }
                      className="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="not_marked">Not Marked</option>
                      <option value="present">✓ Present</option>
                      <option value="absent">✗ Absent</option>
                      <option value="late">⏰ Late</option>
                      <option value="excused">📋 Excused</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {attendanceStudents.length === 0 && (
              <div className="text-center py-8 text-sm sm:text-base text-gray-500">No students found in this class</div>
            )}
          </div>
        )}

        {/* Save Button */}
        {attendanceStudents.length > 0 && (
          <div className="flex gap-2 pt-3 sm:pt-4 border-t sticky bottom-0 bg-white">
            <Button 
              onClick={submitAttendance} 
              disabled={attendanceLoading} 
              className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-medium"
            >
              {attendanceLoading ? "Saving..." : "Save Attendance"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
