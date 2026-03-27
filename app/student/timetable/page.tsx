"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { Calendar, Download, Loader2, User } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useSchoolContext } from "@/hooks/use-school-context";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type PeriodSlot = {
  id: string;
  day_of_week: string;
  period_number: number | null;
  start_time: string;
  end_time: string;
  is_break: boolean;
};

type TimetableEntry = {
  id: string;
  class_id: string;
  period_slot_id: string;
  day_of_week: string;
  subject_classes?: {
    id: string;
    subject_code: string;
    subjects?: { name: string };
    teachers?: { first_name: string; last_name: string };
  };
  period_slots?: PeriodSlot;
};

function compareSlotTime(a: PeriodSlot, b: PeriodSlot) {
  const byTime = (a.start_time || "").localeCompare(b.start_time || "");
  if (byTime !== 0) return byTime;
  return (a.period_number ?? Number.MAX_SAFE_INTEGER) - (b.period_number ?? Number.MAX_SAFE_INTEGER);
}

function shortCode(name: string | undefined | null) {
  if (!name) return "";
  const cleaned = name.trim();
  if (cleaned.length <= 3) return cleaned.toUpperCase();
  return cleaned.slice(0, 3).toUpperCase();
}

export default function StudentTimetablePage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadTimetable();
    }
  }, [schoolId, schoolLoading]);

  async function loadTimetable() {
    if (!schoolId) return;
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
            name
          )
        `)
        .eq("user_id", user.id)
        .eq("school_id", schoolId)
        .single();

      if (studentError || !student) {
        toast.error("Student profile not found");
        return;
      }

      setStudentName(`${student.first_name} ${student.last_name}`);
      const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
      setClassName(classData?.name || "");

      // Fetch all timetable entries for the student's class
      const { data: entries, error: timetableError } = await supabase
        .from("timetable_entries")
        .select(`
          *,
          period_slots(id, day_of_week, period_number, start_time, end_time, is_break),
          subject_classes (
            id,
            subject_code,
            subjects!subject_classes_subject_id_fkey ( name ),
            teachers ( first_name, last_name )
          )
        `)
        .eq("class_id", student.class_id)
        .eq("school_id", schoolId);

      if (timetableError) {
        console.error("Error fetching timetable:", timetableError);
        toast.error("Failed to load timetable");
        return;
      }

      if (!entries || entries.length === 0) {
        toast.info("No timetable entries found for your class");
        setLoading(false);
        return;
      }

      // Get student's enrolled subject_class_ids
      const { data: studentSubjects, error: studentSubjectsError } = await supabase
        .from("student_subjects")
        .select("subject_class_id")
        .eq("student_id", student.id)
        .eq("school_id", schoolId);

      if (studentSubjectsError) {
        console.error("Error fetching student subjects:", studentSubjectsError);
      }

      const enrolledSubjectClassIds = studentSubjects?.map((ss: { subject_class_id: any; }) => ss.subject_class_id) || [];

      // Debug: log enrolled vs available subjects
      console.log("Enrolled subject IDs:", enrolledSubjectClassIds);
      console.log("Available subject class IDs:", entries.map((e: any) => {
        const sc = Array.isArray(e.subject_classes) ? e.subject_classes[0] : e.subject_classes;
        return sc?.id;
      }));

      // Filter entries - if enrolled subjects exist, only show those; otherwise show all
      let filteredEntries = entries;
      if (enrolledSubjectClassIds.length > 0) {
        filteredEntries = entries.filter((entry: any) => {
          const subjectClass = Array.isArray(entry.subject_classes)
            ? entry.subject_classes[0]
            : entry.subject_classes;
          return subjectClass && enrolledSubjectClassIds.includes(subjectClass.id);
        });

        // Fallback: if filtering results in empty array, show all entries
        // This handles cases where enrolled subjects data might be inconsistent
        if (filteredEntries.length === 0) {
          console.warn("No matching enrolled subjects found. Showing all timetable entries.");
          filteredEntries = entries;
        }
      }

      // Extract unique period slots from entries (same as ClassTimetable)
      const slots: PeriodSlot[] = [];
      const slotMap = new Map();
      filteredEntries.forEach((entry: any) => {
        if (entry.period_slots && !slotMap.has(entry.period_slots.id)) {
          slotMap.set(entry.period_slots.id, entry.period_slots);
        }
      });
      slotMap.forEach((v) => slots.push(v));
      slots.sort((a, b) => {
        if (a.day_of_week === b.day_of_week) return compareSlotTime(a, b);
        return DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week);
      });

      setTimetableEntries(filteredEntries);
      setPeriodSlots(slots);
    } catch (error) {
      console.error("Error loading timetable:", error);
      toast.error("Failed to load timetable");
    } finally {
      setLoading(false);
    }
  }

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

  // Group period slots by day
  const periodsByDay = useMemo(() => {
    const dayMap: Record<string, PeriodSlot[]> = {};
    DAYS.forEach(day => {
      dayMap[day] = periodSlots.filter(p => p.day_of_week === day);
    });
    return dayMap;
  }, [periodSlots]);

  // Group entries by period slot to handle multiple subjects
  const groupedEntries = useMemo(() => {
    const map: Record<string, any[]> = {};
    timetableEntries.forEach((entry) => {
      const key = `${entry.period_slot_id}`;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(entry);
    });
    return map;
  }, [timetableEntries]);

  const maxPeriods = useMemo(() => {
    return Math.max(
      ...Object.values(periodsByDay).map(periods => periods.length),
      0
    );
  }, [periodsByDay]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalPeriods = 0;
    let uniqueSubjects = new Set<string>();
    let uniqueTeachers = new Set<string>();

    Object.values(groupedEntries).forEach((entries) => {
      if (entries.length > 0) {
        totalPeriods += 1;
        entries.forEach((entry) => {
          const subjectClass = Array.isArray(entry.subject_classes)
            ? entry.subject_classes[0]
            : entry.subject_classes;
          const subject = subjectClass?.subjects?.name;
          if (subject) uniqueSubjects.add(subject);
          
          const teacher = subjectClass?.teachers;
          if (teacher) {
            uniqueTeachers.add(`${teacher.first_name} ${teacher.last_name}`);
          }
        });
      }
    });

    return {
      totalPeriods,
      subjectsCount: uniqueSubjects.size,
      teachersCount: uniqueTeachers.size,
    };
  }, [groupedEntries]);

  if (loading || schoolLoading) {
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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Timetable</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Your weekly class schedule for {className}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Class Periods</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalPeriods}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">My Subjects</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.subjectsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Teachers</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.teachersCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Day View */}
        <div className="md:hidden space-y-4">
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b pb-3">
              <CardTitle className="text-base">{studentName} - {className}</CardTitle>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 flex-1"
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
            <CardContent className="p-4">
              {/* Day Selector */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {DAYS.map((day) => (
                  <Button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    variant={selectedDay === day ? "default" : "outline"}
                    size="sm"
                    className="flex-shrink-0 whitespace-nowrap"
                  >
                    {day.slice(0, 3)}
                  </Button>
                ))}
              </div>

              {/* Day's Schedule */}
              <div className="space-y-3">
                {periodSlots
                  .filter((p) => p.day_of_week === selectedDay)
                  .map((period, idx) => {
                    const entries = groupedEntries[period.id] || [];

                    // Only use abbreviated codes if multiple subjects, otherwise full name
                    let subjectDisplay = "";
                    if (entries.length > 1) {
                      subjectDisplay = Array.from(new Set(
                        entries
                          .filter(e => e.subject_classes?.subjects?.name)
                          .map(e => shortCode(e.subject_classes?.subjects?.name))
                      )).join("/");
                    } else if (entries.length === 1 && entries[0].subject_classes?.subjects?.name) {
                      subjectDisplay = entries[0].subject_classes.subjects.name;
                    }

                    const teachers = entries
                      .filter(e => e.subject_classes?.teachers)
                      .map(e => `${e.subject_classes.teachers.first_name} ${e.subject_classes.teachers.last_name}`);
                    const uniqueTeachers = Array.from(new Set(teachers)).join(", ");

                    if (period.is_break) {
                      return (
                        <div
                          key={period.id}
                          className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center"
                        >
                          <div className="font-semibold text-yellow-800">BREAK TIME</div>
                          <div className="text-sm text-yellow-700 mt-1">
                            {period.start_time} - {period.end_time}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={period.id}
                        className={`p-4 border rounded-lg transition-colors ${
                          entries.length > 0
                            ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-semibold text-gray-600">
                            Period {idx + 1} • {period.start_time} - {period.end_time}
                          </div>
                          {entries.length > 0 ? (
                            <div className="space-y-2">
                              <div className="text-lg font-bold text-gray-900">
                                {subjectDisplay}
                              </div>
                              <div className="flex items-center gap-2 text-blue-700">
                                <User className="h-4 w-4" />
                                <span className="text-sm">{uniqueTeachers}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 italic">Free Period</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {stats.totalPeriods === 0 && (
                <div className="text-center py-8">
                  <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 font-medium">No timetable entries found</p>
                  <p className="text-gray-500 text-sm mt-1">
                    You may not be enrolled in any subjects yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Desktop Table View */}
        <Card className="hidden md:block">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-xl truncate">{studentName} - {className}</CardTitle>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Your weekly class timetable</p>
                </div>
              </div>
              <Button
                onClick={handleExportPDF}
                disabled={exporting}
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto flex-shrink-0"
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
          <CardContent className="p-3 sm:p-6">
            <div className="overflow-x-auto border rounded-lg" id="student-timetable-area">
              <table className="w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                    <th className="border border-gray-300 p-2 sm:p-3 font-semibold text-gray-700 text-xs sm:text-sm min-w-[80px] sm:min-w-[100px] sticky left-0 bg-gray-100 z-10">
                      Period
                    </th>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="border border-gray-300 p-2 sm:p-3 font-semibold text-gray-700 text-xs sm:text-sm min-w-[140px] sm:min-w-[180px]"
                      >
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">{day}</span>
                          <span className="sm:hidden">{day.slice(0, 3)}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxPeriods }, (_, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-gray-300 hover:bg-gray-50">
                      <td className="border border-gray-300 p-1.5 sm:p-2 bg-gray-50 text-center font-medium sticky left-0 z-10">
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-gray-800">
                            <span className="hidden sm:inline">Period {rowIndex + 1}</span>
                            <span className="sm:hidden">P{rowIndex + 1}</span>
                          </div>
                          {periodsByDay[DAYS[0]]?.[rowIndex] && (
                            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                              {periodsByDay[DAYS[0]][rowIndex]?.start_time || "—"} - {periodsByDay[DAYS[0]][rowIndex]?.end_time || "—"}
                            </div>
                          )}
                        </div>
                      </td>
                      {DAYS.map((day) => {
                        const period = periodsByDay[day]?.[rowIndex];

                        if (!period) {
                          return (
                            <td
                              key={day}
                              className="border border-gray-300 p-2 sm:p-3 text-center text-gray-400 text-xs sm:text-sm"
                            >
                              —
                            </td>
                          );
                        }

                        if (period.is_break) {
                          return (
                            <td
                              key={day}
                              className="border border-gray-300 p-2 sm:p-3 bg-yellow-50"
                            >
                              <div className="text-center">
                                <div className="font-semibold text-yellow-800 text-xs sm:text-sm">BREAK TIME</div>
                                <div className="text-[10px] sm:text-xs text-yellow-700 mt-0.5">
                                  {period.start_time} - {period.end_time}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        const entries = groupedEntries[period.id] || [];

                        // Only use abbreviated codes if multiple subjects, otherwise full name
                        let subjectDisplay = "";
                        if (entries.length > 1) {
                          subjectDisplay = Array.from(new Set(
                            entries
                              .filter(e => e.subject_classes?.subjects?.name)
                              .map(e => shortCode(e.subject_classes?.subjects?.name))
                          )).join("/");
                        } else if (entries.length === 1 && entries[0].subject_classes?.subjects?.name) {
                          subjectDisplay = entries[0].subject_classes.subjects.name;
                        }

                        const teachers = entries
                          .filter(e => e.subject_classes?.teachers)
                          .map(e => `${e.subject_classes.teachers.first_name} ${e.subject_classes.teachers.last_name}`);
                        const uniqueTeachers = Array.from(new Set(teachers)).join(", ");

                        return (
                          <td
                            key={day}
                            className={`border border-gray-300 p-1.5 sm:p-2 ${
                              entries.length > 0
                                ? "bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                                : "hover:bg-gray-50 transition-colors"
                            }`}
                          >
                            {entries.length > 0 ? (
                              <div className="space-y-0.5 sm:space-y-1">
                                <div className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight">
                                  {subjectDisplay}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-blue-700">
                                  <User className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{uniqueTeachers}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-1 sm:py-2">
                                <div className="text-gray-400 text-[10px] sm:text-xs">Free Period</div>
                                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
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
