"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { Calendar, Clock, BookOpen, GraduationCap, Download, Loader2, User } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type PeriodSlot = {
  id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
};

type TimetableCell = {
  subject: string;
  fullSubject: string;
  teacher: string;
  period: PeriodSlot;
  rows: any[];
};

export default function StudentTimetablePage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [timetable, setTimetable] = useState<Record<string, Record<string, TimetableCell>>>({});
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);

  useEffect(() => {
    loadTimetable();
  }, []);

  async function loadTimetable() {
    try {
      setLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        return;
      }

      // Get student info
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          first_name,
          last_name,
          class_id,
          classes (
            id,
            name,
            level,
            education_level
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (studentError || !student) {
        toast.error("Student profile not found");
        return;
      }

      setStudentName(`${student.first_name} ${student.last_name}`);
      const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
      setClassName(classData?.name || "");

      // Get student's enrolled subject_class_ids from student_subjects table
      const { data: studentSubjects, error: studentSubjectsError } = await supabase
        .from("student_subjects")
        .select("subject_class_id")
        .eq("student_id", student.id);

      if (studentSubjectsError) {
        console.error("Error fetching student subjects:", studentSubjectsError);
        toast.error("Failed to load your subjects");
        return;
      }

      const enrolledSubjectClassIds = studentSubjects?.map(ss => ss.subject_class_id) || [];

      if (enrolledSubjectClassIds.length === 0) {
        toast.info("You are not enrolled in any subjects yet");
        setLoading(false);
        return;
      }

      // Fetch all timetable entries for the student's class
      const { data: timetableData, error: timetableError } = await supabase
        .from("timetable_entries")
        .select(`
          *,
          classes(id, name),
          period_slots(id, day_of_week, period_number, start_time, end_time, is_break),
          subject_classes (
            id,
            subject_code,
            subjects ( name ),
            teachers ( first_name, last_name )
          )
        `)
        .eq("class_id", student.class_id);

      if (timetableError) {
        console.error("Error fetching timetable:", timetableError);
        toast.error("Failed to load timetable");
        return;
      }

      if (!timetableData) {
        toast.info("No timetable entries found");
        return;
      }

      // Filter entries to only include subjects the student is enrolled in
      const studentTimetableEntries = timetableData.filter((entry) => {
        const subjectClass = Array.isArray(entry.subject_classes)
          ? entry.subject_classes[0]
          : entry.subject_classes;
        return subjectClass && enrolledSubjectClassIds.includes(subjectClass.id);
      });

      // Fetch all period slots
      const { data: slotsData } = await supabase
        .from("period_slots")
        .select("*")
        .order("day_of_week, period_number");

      if (slotsData) {
        setPeriodSlots(slotsData);
      }

      // Build timetable structure
      const timetableMap: Record<string, Record<string, TimetableCell>> = {};

      DAYS.forEach(day => {
        timetableMap[day] = {};
      });

      studentTimetableEntries.forEach((entry: any) => {
        const periodSlot = Array.isArray(entry.period_slots)
          ? entry.period_slots[0]
          : entry.period_slots;

        if (!periodSlot) return;

        const day = periodSlot.day_of_week;
        const periodSlotId = entry.period_slot_id;

        const subjectClass = Array.isArray(entry.subject_classes)
          ? entry.subject_classes[0]
          : entry.subject_classes;

        const subjectName = subjectClass?.subjects?.name || "";
        const subjectCode = shortCode(subjectName);

        const teacher = subjectClass?.teachers;
        const teacherName = teacher
          ? `${teacher.first_name} ${teacher.last_name}`
          : "TBA";

        if (!timetableMap[day][periodSlotId]) {
          timetableMap[day][periodSlotId] = {
            subject: subjectCode || subjectName,
            fullSubject: subjectName,
            teacher: teacherName,
            period: periodSlot,
            rows: [entry],
          };
        } else {
          timetableMap[day][periodSlotId].rows.push(entry);
        }
      });

      setTimetable(timetableMap);
    } catch (error) {
      console.error("Error loading timetable:", error);
      toast.error("Failed to load timetable");
    } finally {
      setLoading(false);
    }
  }

  function shortCode(name: string | undefined | null) {
    if (!name) return "";
    const cleaned = name.trim();
    if (cleaned.length <= 3) return cleaned.toUpperCase();
    return cleaned.slice(0, 3).toUpperCase();
  }

  // Group period slots by day
  const periodsByDay = useMemo(() => {
    const dayMap: Record<string, PeriodSlot[]> = {};
    DAYS.forEach(day => {
      dayMap[day] = periodSlots.filter(p => p.day_of_week === day);
    });
    return dayMap;
  }, [periodSlots]);

  // Find maximum number of periods across all days
  const maxPeriods = useMemo(() => {
    return Math.max(
      ...Object.values(periodsByDay).map((periods) => periods.length),
      0
    );
  }, [periodsByDay]);

  const displayPeriodRows = useMemo(() => {
    const rows: {
      index: number;
      label: string;
      isBreakRow: boolean;
    }[] = [];

    let periodCounter = 0;

    for (let rowIndex = 0; rowIndex < maxPeriods; rowIndex++) {
      const isBreakRow = DAYS.some((day) => {
        const period = periodsByDay[day]?.[rowIndex];
        return period?.is_break;
      });

      if (isBreakRow) {
        rows.push({
          index: rowIndex,
          label: "BREAK",
          isBreakRow: true,
        });
      } else {
        periodCounter++;
        rows.push({
          index: rowIndex,
          label: `${periodCounter}`,
          isBreakRow: false,
        });
      }
    }

    return rows;
  }, [maxPeriods, periodsByDay]);

  async function handleExportPDF() {
    const element = document.getElementById("student-timetable-area");

    if (!element) {
      toast.error("Timetable not found");
      return;
    }

    try {
      setExporting(true);
      toast.info("Generating PDF...");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = 297;
      const pdfHeight = 210;
      const margin = 10;
      const availableWidth = pdfWidth - margin * 2;
      const availableHeight = pdfHeight - margin * 2;

      const imgData = canvas.toDataURL("image/png");

      const canvasRatio = canvas.width / canvas.height;
      const availableRatio = availableWidth / availableHeight;

      let renderWidth, renderHeight;

      if (canvasRatio > availableRatio) {
        renderWidth = availableWidth;
        renderHeight = availableWidth / canvasRatio;
      } else {
        renderHeight = availableHeight;
        renderWidth = availableHeight * canvasRatio;
      }

      const x = margin + (availableWidth - renderWidth) / 2;
      const y = margin + (availableHeight - renderHeight) / 2;

      pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
      pdf.save(`${studentName.replace(/\s/g, "_")}_timetable.pdf`);

      toast.success("PDF exported successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  }

  // Calculate stats
  const stats = useMemo(() => {
    let totalPeriods = 0;
    let uniqueSubjects = new Set<string>();
    let uniqueTeachers = new Set<string>();

    Object.values(timetable).forEach((daySchedule) => {
      Object.values(daySchedule).forEach((cell) => {
        totalPeriods += 1;
        if (cell.fullSubject) uniqueSubjects.add(cell.fullSubject);
        if (cell.teacher) uniqueTeachers.add(cell.teacher);
      });
    });

    return {
      totalPeriods,
      subjectsCount: uniqueSubjects.size,
      teachersCount: uniqueTeachers.size,
    };
  }, [timetable]);

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your timetable...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Timetable</h1>
          <p className="text-gray-600 mt-1">Your weekly class schedule for {className}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Class Periods</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalPeriods}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">My Subjects</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.subjectsCount}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <BookOpen className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Teachers</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.teachersCount}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timetable */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">{studentName} - {className}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Your weekly class timetable</p>
                </div>
              </div>
              <Button
                onClick={handleExportPDF}
                disabled={exporting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto border rounded-lg" id="student-timetable-area">
              <table className="w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                    <th className="border border-gray-300 p-3 font-semibold text-gray-700 min-w-[100px] sticky left-0 bg-gray-100 z-10">
                      Period
                    </th>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="border border-gray-300 p-3 font-semibold text-gray-700 min-w-[180px]"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {day}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayPeriodRows.map((row) => (
                    <tr key={row.index} className={row.isBreakRow ? "bg-yellow-50" : ""}>
                      <td className="border border-gray-300 p-2 bg-gray-50 text-center font-medium sticky left-0 z-10">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">
                            {row.isBreakRow ? "BREAK" : `Period ${row.label}`}
                          </div>
                          {!row.isBreakRow && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {periodsByDay[DAYS[0]]?.[row.index]?.start_time || "—"} - 
                              {periodsByDay[DAYS[0]]?.[row.index]?.end_time || "—"}
                            </div>
                          )}
                        </div>
                      </td>
                      {DAYS.map((day) => {
                        const period = periodsByDay[day]?.[row.index];
                        
                        if (!period) {
                          return (
                            <td
                              key={day}
                              className="border border-gray-300 p-3 text-center text-gray-400"
                            >
                              —
                            </td>
                          );
                        }

                        if (period.is_break) {
                          return (
                            <td
                              key={day}
                              className="border border-gray-300 p-3 bg-yellow-50"
                            >
                              <div className="text-center">
                                <div className="font-semibold text-yellow-800 text-sm">BREAK TIME</div>
                              </div>
                            </td>
                          );
                        }

                        const cell = timetable[day]?.[period.id];

                        return (
                          <td
                            key={day}
                            className={`border border-gray-300 p-2 ${
                              cell 
                                ? "bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors" 
                                : "hover:bg-gray-50 transition-colors"
                            }`}
                          >
                            {cell ? (
                              <div className="space-y-1">
                                <div className="font-semibold text-gray-900 text-sm leading-tight">
                                  {cell.fullSubject}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-blue-700">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{cell.teacher}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-2">
                                <div className="text-gray-400 text-xs">Free Period</div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {period.start_time} - {period.end_time}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {stats.totalPeriods === 0 && (
              <div className="text-center py-12 mt-6">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No timetable entries found</p>
                <p className="text-gray-500 text-sm mt-1">
                  You may not be enrolled in any subjects yet. Contact your class teacher.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
      </div>
    </DashboardLayout>
  );
}
