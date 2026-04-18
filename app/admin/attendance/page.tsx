"use client";

import { useState, useEffect } from "react";
import { useSchoolContext } from "@/hooks/use-school-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
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

interface ClassData {
  id: string;
  name: string;
  stream?: string;
  class_level_id?: string;
  students: StudentAttendance[];
  isExpanded: boolean;
}

interface ProcessedAttendanceData {
  [classId: string]: { [studentId: string]: StudentAttendance };
}

export default function SchoolAttendancePage() {
  const { schoolId } = useSchoolContext();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attendanceData, setAttendanceData] = useState<ProcessedAttendanceData>({});

  // Fetch all classes and their attendance data
  useEffect(() => {
    if (schoolId) {
      fetchAllClassesAndAttendance(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function fetchAllClassesAndAttendance(date: string) {
    if (!schoolId) return;
    setIsLoading(true);
    try {
      const [{ data: classesData, error: classesError }, { data: studentsData, error: studentsError }, { data: attendanceRecords, error: attendanceError }] = await Promise.all([
        supabase
          .from("classes")
          .select("*")
          .eq("school_id", schoolId)
          .order("name", { ascending: true }),
        supabase
          .from("students")
          .select("*")
          .eq("school_id", schoolId)
          .eq("status", "active")
          .order("class_id"),
        supabase
          .from("attendance")
          .select("*")
          .eq("school_id", schoolId)
          .eq("date", date),
      ]);

      if (classesError || studentsError || attendanceError) {
        throw new Error("Failed to fetch data");
      }

      // Process attendance data into a lookup structure
      const attendanceLookup: ProcessedAttendanceData = {};
      const processedClasses: ClassData[] = [];

      // Initialize attendance lookup and classes
      (classesData || []).forEach((cls: any) => {
        attendanceLookup[cls.id] = {};
        processedClasses.push({
          id: cls.id,
          name: cls.name,
          stream: cls.stream,
          class_level_id: cls.class_level_id,
          students: [],
          isExpanded: false,
        });
      });

      // Group students by class and build attendance status
      const studentsByClass: { [classId: string]: StudentAttendance[] } = {};
      (studentsData || []).forEach((student: any) => {
        if (!studentsByClass[student.class_id]) {
          studentsByClass[student.class_id] = [];
        }

        const attendance = (attendanceRecords || []).find(
          (a: any) => a.student_id === student.id
        );

        const studentAttendance: StudentAttendance = {
          id: student.id,
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          gender: student.gender || "",
          attendanceStatus: attendance ? (attendance.status as any) : "not_marked",
          attendanceId: attendance?.id,
        };

        studentsByClass[student.class_id].push(studentAttendance);
        attendanceLookup[student.class_id][student.id] = studentAttendance;
      });

      // Assign students to their classes
      const finalClasses = processedClasses.map((cls) => ({
        ...cls,
        students: studentsByClass[cls.id] || [],
      }));

      setClasses(finalClasses);
      setAttendanceData(attendanceLookup);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      toast.error("Failed to load attendance data");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    fetchAllClassesAndAttendance(date);
  }

  function setToday() {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
    fetchAllClassesAndAttendance(today);
  }

  function toggleClassExpand(classId: string) {
    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === classId ? { ...cls, isExpanded: !cls.isExpanded } : cls
      )
    );
  }

  function updateStudentAttendance(
    classId: string,
    studentId: string,
    status: StudentAttendance["attendanceStatus"]
  ) {
    setAttendanceData((prev) => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [studentId]: {
          ...prev[classId][studentId],
          attendanceStatus: status,
        },
      },
    }));

    // Also update the classes state for UI refresh
    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === classId
          ? {
              ...cls,
              students: cls.students.map((student) =>
                student.id === studentId
                  ? { ...student, attendanceStatus: status }
                  : student
              ),
            }
          : cls
      )
    );
  }

  function markClassAllPresent(classId: string) {
    const updatedData = { ...attendanceData };
    updatedData[classId] = Object.fromEntries(
      Object.entries(updatedData[classId]).map(([studentId, student]) => [
        studentId,
        { ...student, attendanceStatus: "present" as const },
      ])
    );
    setAttendanceData(updatedData);

    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === classId
          ? {
              ...cls,
              students: cls.students.map((student) => ({
                ...student,
                attendanceStatus: "present" as const,
              })),
            }
          : cls
      )
    );

    toast.success(`All students in ${classes.find(c => c.id === classId)?.name} marked as present`);
  }

  function resetClassAttendance(classId: string) {
    const updatedData = { ...attendanceData };
    updatedData[classId] = Object.fromEntries(
      Object.entries(updatedData[classId]).map(([studentId, student]) => [
        studentId,
        { ...student, attendanceStatus: "not_marked" as const },
      ])
    );
    setAttendanceData(updatedData);

    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === classId
          ? {
              ...cls,
              students: cls.students.map((student) => ({
                ...student,
                attendanceStatus: "not_marked" as const,
              })),
            }
          : cls
      )
    );
  }

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
          const { data: student, error: studentError } = await supabase
            .from("students")
            .select("parent_email, parent_name")
            .eq("id", record.student_id)
            .single();

          if (studentError || !student?.parent_email) {
            console.warn(
              `⚠️ No parent email found for student ${record.student_id} (${record.studentName})`
            );
            failureCount++;
            continue;
          }

          const { data: parentArray, error: parentError } = await supabase
            .from("parents")
            .select("user_id, id, is_active")
            .eq("email", student.parent_email);

          if (parentError || !parentArray || parentArray.length === 0) {
            console.warn(
              `⚠️ No parent account found for email ${student.parent_email}.`
            );
            failureCount++;
            continue;
          }

          const parent = parentArray[0];

          if (!parent?.user_id || !parent.is_active) {
            console.warn(
              `⚠️ Parent account inactive or missing user_id for ${student.parent_email}`
            );
            failureCount++;
            continue;
          }

          const { data: tokens, error: tokensError } = await supabase
            .from("notification_tokens")
            .select("token, user_id, device_type, is_active")
            .eq("user_id", parent.user_id)
            .eq("is_active", true);

          if (tokensError || !tokens || tokens.length === 0) {
            console.warn(
              `⚠️ No active notification tokens found for parent ${student.parent_email}.`
            );
            failureCount++;
            continue;
          }

          const { title, body } = getNotificationMessage(
            record.status,
            record.studentName
          );

          const response = await fetch("/api/admin/send-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            console.error(`❌ API Error (${response.status}):`, errorText);
            failureCount++;
            continue;
          }

          const result = await response.json();
          if (result.success || result.successCount > 0) {
            console.log(`✅ Notification sent to parent ${student.parent_email}`);
            successCount++;
          } else {
            console.error(`❌ API returned error:`, result);
            failureCount++;
          }
        } catch (error) {
          console.error(`❌ Unexpected error processing student:`, error);
          failureCount++;
        }
      }

      console.log(
        `\n📊 Notification Summary:\n✅ Sent: ${successCount}\n❌ Failed: ${failureCount}\n📱 Total: ${attendanceRecords.length}`
      );

      if (failureCount > 0 && successCount > 0) {
        toast.warning(
          `${successCount}/${attendanceRecords.length} parent notifications sent.`
        );
      } else if (successCount > 0) {
        toast.success(`✅ All ${successCount} parent notifications sent!`);
      }
    } catch (error) {
      console.error("Fatal error in sendNotificationsToParents:", error);
      toast.error("Failed to send parent notifications. Check console for details.");
    }
  }

  async function submitAllAttendance() {
    setIsSaving(true);
    const savingToast = toast.loading("Saving attendance for all classes...");

    try {
      const allAttendanceRecords: Array<{
        school_id: string;
        student_id: string;
        class_id: string;
        date: string;
        status: string;
      }> = [];

      const allExistingIds: string[] = [];
      const notificationRecords: Array<{
        student_id: string;
        status: string;
        studentName: string;
      }> = [];

      // Collect all records to save and delete
      Object.entries(attendanceData).forEach(([classId, students]) => {
        Object.entries(students).forEach(([studentId, student]) => {
          if (student.attendanceStatus !== "not_marked") {
            allAttendanceRecords.push({
              school_id: schoolId!,
              student_id: student.id,
              class_id: classId,
              date: selectedDate,
              status: student.attendanceStatus,
            });

            notificationRecords.push({
              student_id: student.id,
              status: student.attendanceStatus,
              studentName: `${student.first_name} ${student.last_name}`,
            });
          }

          if (student.attendanceId) {
            allExistingIds.push(student.attendanceId);
          }
        });
      });

      // Delete existing records
      if (allExistingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("attendance")
          .delete()
          .eq("school_id", schoolId)
          .in("id", allExistingIds);

        if (deleteError) throw deleteError;
      }

      // Insert new records
      if (allAttendanceRecords.length > 0) {
        const { error: insertError } = await supabase
          .from("attendance")
          .insert(allAttendanceRecords);

        if (insertError) throw insertError;
      }

      toast.success("✅ Attendance saved successfully!", { id: savingToast });

      // Send notifications asynchronously
      if (notificationRecords.length > 0) {
        sendNotificationsToParents(notificationRecords).catch((error) =>
          console.error("Error in notification sending:", error)
        );
      }

      // Refresh data
      await fetchAllClassesAndAttendance(selectedDate);
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance", { id: savingToast });
    } finally {
      setIsSaving(false);
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
    try {
      const exportData: any[] = [];

      classes.forEach((cls) => {
        cls.students.forEach((student, index) => {
          exportData.push({
            Class: cls.name,
            "#": index + 1,
            "Student ID": student.student_id,
            Name: `${student.first_name} ${student.last_name}`,
            Gender: student.gender,
            Status: student.attendanceStatus.replace("_", " ").toUpperCase(),
            Date: selectedDate,
          });
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      XLSX.writeFile(wb, `school-attendance-${selectedDate}.xlsx`);
      toast.success("Attendance exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export attendance");
    }
  }

  const statusColors = {
    present: "bg-green-100 text-green-800",
    absent: "bg-red-100 text-red-800",
    late: "bg-yellow-100 text-yellow-800",
    excused: "bg-blue-100 text-blue-800",
    not_marked: "bg-gray-100 text-gray-800",
  };

  const totalStudents = classes.reduce((sum, cls) => sum + cls.students.length, 0);
  const markedStudents = Object.values(attendanceData).reduce(
    (sum, classData) =>
      sum + Object.values(classData).filter((s) => s.attendanceStatus !== "not_marked").length,
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading attendance data...</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>School Attendance</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {markedStudents}/{totalStudents} students marked
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportAttendance}
              disabled={isSaving || classes.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Selection */}
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
              <Button variant="outline" onClick={setToday} disabled={isSaving}>
                Today
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-1">{getFormattedDate(selectedDate)}</p>
          </div>
        </div>

        {/* Classes Section */}
        {classes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No classes found for this school</div>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
              >
                {/* Class Header */}
                <button
                  onClick={() => toggleClassExpand(cls.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left flex items-center gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                      <p className="text-xs text-gray-500">{cls.students.length} students</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {cls.students.filter((s) => s.attendanceStatus !== "not_marked").length}/
                      {cls.students.length}
                    </span>
                    {cls.isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                </button>

                {/* Class Content - Expanded */}
                {cls.isExpanded && (
                  <div className="border-t bg-gray-50 px-4 py-3 space-y-3">
                    {/* Quick Actions */}
                    <div className="flex gap-2 pb-3 border-b">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markClassAllPresent(cls.id)}
                        disabled={isSaving}
                      >
                        Mark All Present
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resetClassAttendance(cls.id)}
                        disabled={isSaving}
                      >
                        Reset
                      </Button>
                    </div>

                    {/* Attendance Grid */}
                    <div className="bg-white rounded-lg overflow-hidden">
                      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-100 font-medium text-xs">
                        <div className="col-span-1">#</div>
                        <div className="col-span-4">Student Name</div>
                        <div className="col-span-2">Gender</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-3">Action</div>
                      </div>

                      {cls.students.map((student, index) => (
                        <div
                          key={student.id}
                          className="grid grid-cols-12 gap-4 px-4 py-3 border-b items-center hover:bg-gray-50 last:border-b-0"
                        >
                          <div className="col-span-1 text-xs text-gray-600">{index + 1}</div>
                          <div className="col-span-4">
                            <p className="font-medium text-sm">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{student.student_id}</p>
                          </div>
                          <div className="col-span-2 text-xs text-gray-600 capitalize">
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
                                updateStudentAttendance(
                                  cls.id,
                                  student.id,
                                  e.target.value as StudentAttendance["attendanceStatus"]
                                )
                              }
                              disabled={isSaving}
                              className="w-full px-2 py-1.5 border rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
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

                      {cls.students.length === 0 && (
                        <div className="text-center py-6 text-gray-500 text-sm">
                          No students in this class
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Save Button */}
        {classes.length > 0 && (
          <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-white">
            <Button
              onClick={submitAllAttendance}
              disabled={isSaving || markedStudents === 0}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save All Attendance"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
