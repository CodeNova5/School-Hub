"use client";

import { useState, useEffect } from "react";
import { useSchoolContext } from "@/hooks/use-school-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AttendanceClassCard } from "@/components/attendance-class-card";
import { AttendanceMarkingModal } from "@/components/attendance-marking-modal";
import * as XLSX from "xlsx-js-style";
import { DashboardLayout } from "@/components/dashboard-layout";

interface StudentAttendance {
    id: string;
    student_id: string;
    first_name: string;
    last_name: string;
    gender: string;
    attendanceStatus: "present" | "absent" | "late" | "excused" | "not_marked";
    attendanceId?: string;
}

interface TeacherAttendance {
    id: string;
    teacher_id: string;
    first_name: string;
    last_name: string;
    email: string;
    attendanceStatus: "present" | "absent" | "late" | "excused" | "not_marked";
    attendanceId?: string;
}

interface ClassData {
    id: string;
    name: string;
    stream?: string;
    class_level_id?: string;
    students: StudentAttendance[];
}

interface ProcessedAttendanceData {
    [classId: string]: { [studentId: string]: StudentAttendance };
}

interface ClassStats {
    present: number;
    absent: number;
    late: number;
    excused: number;
    notMarked: number;
}

export default function SchoolAttendancePage() {
    const { schoolId } = useSchoolContext();
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [teachers, setTeachers] = useState<TeacherAttendance[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [attendanceData, setAttendanceData] = useState<ProcessedAttendanceData>({});
    const [teacherAttendanceData, setTeacherAttendanceData] = useState<{
        [teacherId: string]: TeacherAttendance;
    }>({});
    const [selectedClassForModal, setSelectedClassForModal] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"students" | "teachers">("students");

    // Fetch all classes and their attendance data
    useEffect(() => {
        if (schoolId) {
            fetchAllClassesAndAttendance(selectedDate);
            fetchTeachersAndAttendance(selectedDate);
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

    async function fetchTeachersAndAttendance(date: string) {
        if (!schoolId) return;
        try {
            const [{ data: teachersData, error: teachersError }, { data: teacherAttendanceRecords, error: teacherAttendanceError }] = await Promise.all([
                supabase
                    .from("teachers")
                    .select("id, first_name, last_name, email, status")
                    .eq("school_id", schoolId)
                    .eq("status", "active")
                    .order("first_name", { ascending: true }),
                supabase
                    .from("teacher_attendance")
                    .select("*")
                    .eq("school_id", schoolId)
                    .eq("date", date),
            ]);

            if (teachersError || teacherAttendanceError) {
                console.warn("Error fetching teacher data:", teachersError || teacherAttendanceError);
                return;
            }

            const teacherAttendanceLookup: { [teacherId: string]: TeacherAttendance } = {};

            (teachersData || []).forEach((teacher: any) => {
                const attendance = (teacherAttendanceRecords || []).find(
                    (a: any) => a.teacher_id === teacher.id
                );

                const teacherAttendance: TeacherAttendance = {
                    id: teacher.id,
                    teacher_id: teacher.id,
                    first_name: teacher.first_name,
                    last_name: teacher.last_name,
                    email: teacher.email,
                    attendanceStatus: attendance ? (attendance.status as any) : "not_marked",
                    attendanceId: attendance?.id,
                };

                teacherAttendanceLookup[teacher.id] = teacherAttendance;
            });

            setTeachers(Object.values(teacherAttendanceLookup));
            setTeacherAttendanceData(teacherAttendanceLookup);
        } catch (error) {
            console.error("Error fetching teacher attendance data:", error);
        }
    }

    function handleDateChange(date: string) {
        setSelectedDate(date);
        fetchAllClassesAndAttendance(date);
        fetchTeachersAndAttendance(date);
    }

    function setToday() {
        const today = new Date().toISOString().split("T")[0];
        setSelectedDate(today);
        fetchAllClassesAndAttendance(today);
        fetchTeachersAndAttendance(today);
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

    function updateTeacherAttendance(
        teacherId: string,
        status: TeacherAttendance["attendanceStatus"]
    ) {
        setTeacherAttendanceData((prev) => ({
            ...prev,
            [teacherId]: {
                ...prev[teacherId],
                attendanceStatus: status,
            },
        }));

        setTeachers((prev) =>
            prev.map((teacher) =>
                teacher.id === teacherId
                    ? { ...teacher, attendanceStatus: status }
                    : teacher
            )
        );
    }

    function markAllTeachersPresent() {
        const updatedData = { ...teacherAttendanceData };
        Object.entries(updatedData).forEach(([teacherId]) => {
            updatedData[teacherId].attendanceStatus = "present";
        });
        setTeacherAttendanceData(updatedData);

        setTeachers((prev) =>
            prev.map((teacher) => ({
                ...teacher,
                attendanceStatus: "present" as const,
            }))
        );
    }

    function resetAllTeachersAttendance() {
        const updatedData = { ...teacherAttendanceData };
        Object.entries(updatedData).forEach(([teacherId]) => {
            updatedData[teacherId].attendanceStatus = "not_marked";
        });
        setTeacherAttendanceData(updatedData);

        setTeachers((prev) =>
            prev.map((teacher) => ({
                ...teacher,
                attendanceStatus: "not_marked" as const,
            }))
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
        const savingToast = toast.loading("Saving attendance for all classes and teachers...");

        try {
            const allAttendanceRecords: Array<{
                school_id: string;
                student_id: string;
                class_id: string;
                date: string;
                status: string;
            }> = [];

            const allTeacherAttendanceRecords: Array<{
                school_id: string;
                teacher_id: string;
                date: string;
                status: string;
            }> = [];

            const allExistingIds: string[] = [];
            const allExistingTeacherIds: string[] = [];
            const notificationRecords: Array<{
                student_id: string;
                status: string;
                studentName: string;
            }> = [];

            // Collect all student records to save and delete
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

            // Collect all teacher records to save and delete
            Object.entries(teacherAttendanceData).forEach(([teacherId, teacher]) => {
                if (teacher.attendanceStatus !== "not_marked") {
                    allTeacherAttendanceRecords.push({
                        school_id: schoolId!,
                        teacher_id: teacher.id,
                        date: selectedDate,
                        status: teacher.attendanceStatus,
                    });
                }

                if (teacher.attendanceId) {
                    allExistingTeacherIds.push(teacher.attendanceId);
                }
            });

            // Delete existing student records
            if (allExistingIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from("attendance")
                    .delete()
                    .eq("school_id", schoolId)
                    .in("id", allExistingIds);

                if (deleteError) throw deleteError;
            }

            // Delete existing teacher records
            if (allExistingTeacherIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from("teacher_attendance")
                    .delete()
                    .eq("school_id", schoolId)
                    .in("id", allExistingTeacherIds);

                if (deleteError) throw deleteError;
            }

            // Insert new student records
            if (allAttendanceRecords.length > 0) {
                const { error: insertError } = await supabase
                    .from("attendance")
                    .insert(allAttendanceRecords);

                if (insertError) throw insertError;
            }

            // Insert new teacher records
            if (allTeacherAttendanceRecords.length > 0) {
                const { error: insertError } = await supabase
                    .from("teacher_attendance")
                    .insert(allTeacherAttendanceRecords);

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
            await fetchTeachersAndAttendance(selectedDate);
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

    const getClassStats = (classId: string): ClassStats => {
        const classStudents = attendanceData[classId] || {};
        const stats = {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            notMarked: 0,
        };

        Object.values(classStudents).forEach((student) => {
            switch (student.attendanceStatus) {
                case "present":
                    stats.present++;
                    break;
                case "absent":
                    stats.absent++;
                    break;
                case "late":
                    stats.late++;
                    break;
                case "excused":
                    stats.excused++;
                    break;
                default:
                    stats.notMarked++;
            }
        });

        return stats;
    };

    const totalStudents = classes.reduce((sum, cls) => sum + cls.students.length, 0);
    const markedStudents = Object.values(attendanceData).reduce(
        (sum, classData) =>
            sum + Object.values(classData).filter((s) => s.attendanceStatus !== "not_marked").length,
        0
    );
    const markedTeachers = Object.values(teacherAttendanceData).filter(
        (t) => t.attendanceStatus !== "not_marked"
    ).length;

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
        <DashboardLayout role="admin">
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    {activeTab === "students"
                                        ? `${markedStudents}/${totalStudents} students marked for ${getFormattedDate(selectedDate)}`
                                        : `${markedTeachers}/${teachers.length} teachers marked for ${getFormattedDate(selectedDate)}`
                                    }
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleExportAttendance}
                                    disabled={isSaving || classes.length === 0}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export All
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Tab Navigation */}
                    <div className="flex gap-2 mb-6 border-b">
                        <button
                            onClick={() => setActiveTab("students")}
                            className={`px-4 py-2 font-medium transition-colors ${
                                activeTab === "students"
                                    ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            Student Attendance
                        </button>
                        {teachers.length > 0 && (
                            <button
                                onClick={() => setActiveTab("teachers")}
                                className={`px-4 py-2 font-medium transition-colors ${
                                    activeTab === "teachers"
                                        ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                                        : "text-gray-600 hover:text-gray-900"
                                }`}
                            >
                                Teacher Attendance
                            </button>
                        )}
                    </div>

                    {/* Date Selection Card */}
                    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                        <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
                            <div className="flex-1">
                                <Label className="block text-sm font-medium text-gray-700 mb-2">Select Date</Label>
                                <Input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    className="max-w-xs"
                                />
                            </div>
                            <Button variant="outline" onClick={setToday} disabled={isSaving}>
                                Set to Today
                            </Button>
                        </div>
                    </div>

                    {/* Classes Grid */}
                    {classes.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                            <p className="text-gray-500">No classes found for this school</p>
                        </div>
                    ) : (
                        <>
                            {/* Student Attendance Tab */}
                            {activeTab === "students" && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                        {classes.map((cls) => {
                                            const stats = getClassStats(cls.id);
                                            return (
                                                <AttendanceClassCard
                                                    key={cls.id}
                                                    id={cls.id}
                                                    name={cls.name}
                                                    stream={cls.stream}
                                                    studentCount={cls.students.length}
                                                    present={stats.present}
                                                    absent={stats.absent}
                                                    late={stats.late}
                                                    excused={stats.excused}
                                                    notMarked={stats.notMarked}
                                                    onMarkAttendance={() => setSelectedClassForModal(cls.id)}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Save All Button for Students */}
                                    <div className="bg-white rounded-lg shadow-sm p-6 sticky bottom-0 border-t">
                                        <Button
                                            onClick={submitAllAttendance}
                                            disabled={isSaving || (markedStudents === 0 && markedTeachers === 0)}
                                            size="lg"
                                            className="w-full md:w-auto"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                `Save All Attendance (${markedStudents} students${teachers.length > 0 ? ` + ${markedTeachers} teachers` : ""})`
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}

                            {/* Teacher Attendance Tab */}
                            {activeTab === "teachers" && teachers.length > 0 && (
                                <>
                                    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                                        {/* Teacher Actions */}
                                        <div className="flex gap-2 mb-4">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={markAllTeachersPresent}
                                                disabled={isSaving}
                                            >
                                                Mark All Present
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={resetAllTeachersAttendance}
                                                disabled={isSaving}
                                            >
                                                Reset All
                                            </Button>
                                        </div>

                                        {/* Teacher Attendance Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-gray-50">
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {teachers.map((teacher, index) => (
                                                        <tr key={teacher.id} className="border-b hover:bg-gray-50">
                                                            <td className="px-4 py-3 text-gray-600">{index + 1}</td>
                                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                                {teacher.first_name} {teacher.last_name}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-600">{teacher.email}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant={teacher.attendanceStatus === "present" ? "default" : "outline"}
                                                                        onClick={() => updateTeacherAttendance(teacher.id, "present")}
                                                                        disabled={isSaving}
                                                                        className="w-20"
                                                                    >
                                                                        Present
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant={teacher.attendanceStatus === "absent" ? "destructive" : "outline"}
                                                                        onClick={() => updateTeacherAttendance(teacher.id, "absent")}
                                                                        disabled={isSaving}
                                                                        className="w-20"
                                                                    >
                                                                        Absent
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant={teacher.attendanceStatus === "late" ? "default" : "outline"}
                                                                        onClick={() => updateTeacherAttendance(teacher.id, "late")}
                                                                        disabled={isSaving}
                                                                        className="w-20"
                                                                    >
                                                                        Late
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant={teacher.attendanceStatus === "excused" ? "default" : "outline"}
                                                                        onClick={() => updateTeacherAttendance(teacher.id, "excused")}
                                                                        disabled={isSaving}
                                                                        className="w-20"
                                                                    >
                                                                        Excused
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Save All Button for Teachers */}
                                    <div className="bg-white rounded-lg shadow-sm p-6 sticky bottom-0 border-t">
                                        <Button
                                            onClick={submitAllAttendance}
                                            disabled={isSaving || (markedStudents === 0 && markedTeachers === 0)}
                                            size="lg"
                                            className="w-full md:w-auto"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                `Save All Attendance (${markedStudents} students${teachers.length > 0 ? ` + ${markedTeachers} teachers` : ""})`
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Attendance Marking Modal */}
                {selectedClassForModal && (
                    <AttendanceMarkingModal
                        open={selectedClassForModal !== null}
                        className={classes.find((c) => c.id === selectedClassForModal)?.name || ""}
                        students={classes.find((c) => c.id === selectedClassForModal)?.students || []}
                        onUpdateAttendance={(studentId, status) =>
                            updateStudentAttendance(selectedClassForModal, studentId, status)
                        }
                        onMarkAllPresent={() => markClassAllPresent(selectedClassForModal)}
                        onReset={() => resetClassAttendance(selectedClassForModal)}
                        onClose={() => setSelectedClassForModal(null)}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
