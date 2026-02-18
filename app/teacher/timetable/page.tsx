"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { Calendar, Clock, BookOpen, GraduationCap, Download, Loader2 } from "lucide-react";
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
  class: string;
  classId: string;
  subject: string;
  fullSubject: string;
  period: PeriodSlot;
  rows: any[];
};

export default function TeacherTimetablePage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [timetable, setTimetable] = useState<Record<string, Record<string, TimetableCell>>>({});
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);

  useEffect(() => {
    loadTimetable();
  }, []);

  async function loadTimetable() {
    try {
      setLoading(true);

      // Get current user and teacher info
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        return;
      }

      const teacher = await getTeacherByUserId(user.id);
      if (!teacher) {
        toast.error("Teacher profile not found");
        return;
      }

      setTeacherName(`${teacher.first_name} ${teacher.last_name}`);

      // Fetch all timetable entries with related data
      const { data, error } = await supabase
        .from("timetable_entries")
        .select(`
          *,
          classes(id, name, level),
          period_slots(id, day_of_week, period_number, start_time, end_time, is_break),
          religion,
          subject_classes (
            id,
            subject_code,
            teacher_id,
            subjects ( name, department, religion ),
            teachers ( first_name, last_name )
          )
        `);

      if (error) {
        console.error("Error fetching timetable:", error);
        toast.error("Failed to load timetable");
        return;
      }

      if (!data) {
        toast.info("No timetable entries found");
        return;
      }

      // Filter entries where this teacher is teaching
      const teacherEntries = data.filter((entry) => {
        const subjectClass = Array.isArray(entry.subject_classes)
          ? entry.subject_classes[0]
          : entry.subject_classes;
        return subjectClass?.teacher_id === teacher.id;
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
      const timetableData: Record<string, Record<string, TimetableCell>> = {};

      DAYS.forEach(day => {
        timetableData[day] = {};
      });

      teacherEntries.forEach((entry: any) => {
        const periodSlot = Array.isArray(entry.period_slots)
          ? entry.period_slots[0]
          : entry.period_slots;

        if (!periodSlot) return;

        const day = periodSlot.day_of_week;
        const periodSlotId = entry.period_slot_id;

        const subjectClass = Array.isArray(entry.subject_classes)
          ? entry.subject_classes[0]
          : entry.subject_classes;

        const classObj = Array.isArray(entry.classes)
          ? entry.classes[0]
          : entry.classes;

        const className = classObj?.name;
        const classId = classObj?.id;

        const subjectName = subjectClass?.subjects?.name || "";
        const subjectCode = shortCode(subjectName);

        if (!timetableData[day][periodSlotId]) {
          timetableData[day][periodSlotId] = {
            class: className,
            classId: classId,
            subject: subjectCode || subjectName,
            fullSubject: subjectName,
            period: periodSlot,
            rows: [entry],
          };
        } else {
          timetableData[day][periodSlotId].rows.push(entry);
        }
      });

      setTimetable(timetableData);
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
    const element = document.getElementById("teacher-timetable-area");

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
      pdf.save(`${teacherName.replace(/\s/g, "_")}_timetable.pdf`);

      toast.success("PDF exported successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  }

  // Calculate teaching stats
  const stats = useMemo(() => {
    let totalPeriods = 0;
    let uniqueClasses = new Set<string>();
    let uniqueSubjects = new Set<string>();

    Object.values(timetable).forEach((daySchedule) => {
      Object.values(daySchedule).forEach((cell) => {
        totalPeriods += 1;
        if (cell.classId) uniqueClasses.add(cell.classId);
        if (cell.fullSubject) uniqueSubjects.add(cell.fullSubject);
      });
    });

    return {
      totalPeriods,
      classesCount: uniqueClasses.size,
      subjectsCount: uniqueSubjects.size,
    };
  }, [timetable]);

  if (loading) {
    return (
      <DashboardLayout role="teacher">
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
    <DashboardLayout role="teacher">
      <div className="space-y-8 overflow-x-hidden">

        {/* HEADER */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            My Timetable
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Your weekly teaching schedule
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Teaching Periods
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {stats.totalPeriods}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-xl">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Classes
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {stats.classesCount}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-xl">
                  <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Subjects
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {stats.subjectsCount}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-xl">
                  <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* TIMETABLE */}
        <Card className="shadow-sm">

          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>

                <div>
                  <CardTitle className="text-lg sm:text-xl">
                    {teacherName} - Weekly Schedule
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Your teaching timetable for the week
                  </p>
                </div>
              </div>

              <Button
                onClick={handleExportPDF}
                disabled={exporting}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
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

          <CardContent className="p-4 sm:p-6">

            <div
              className="overflow-x-auto rounded-xl border bg-white"
              id="teacher-timetable-area"
            >
              <table className="min-w-[800px] w-full border-collapse text-xs sm:text-sm">

                <thead>
                  <tr className="bg-gray-100">
                    <th className="sticky left-0 z-20 bg-gray-100 border p-3 text-left font-semibold min-w-[110px]">
                      Period
                    </th>

                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="border p-3 text-center font-semibold min-w-[160px]"
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

                      <td className="sticky left-0 z-10 bg-gray-50 border p-2">
                        <div className="text-center">
                          <div className="font-semibold text-gray-800">
                            {row.isBreakRow ? "BREAK" : `Period ${row.label}`}
                          </div>

                          {!row.isBreakRow && (
                            <div className="text-[11px] text-gray-500 mt-1">
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
                            <td key={day} className="border p-3 text-center text-gray-300">
                              —
                            </td>
                          );
                        }

                        if (period.is_break) {
                          return (
                            <td key={day} className="border p-3 bg-yellow-50">
                              <div className="text-center">
                                <div className="font-semibold text-yellow-800 text-xs">
                                  BREAK TIME
                                </div>
                                <div className="text-[11px] text-gray-600 mt-1">
                                  {period.start_time} - {period.end_time}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        const cell = timetable[day]?.[period.id];

                        return (
                          <td
                            key={day}
                            className={`border p-3 transition-colors ${cell
                                ? "bg-blue-50 hover:bg-blue-100 cursor-pointer"
                                : "hover:bg-gray-50"
                              }`}
                          >
                            {cell ? (
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-blue-700 truncate">
                                  {cell.class}
                                </div>
                                <div className="font-semibold text-gray-900 leading-tight">
                                  {cell.fullSubject}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {period.start_time} - {period.end_time}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-2">
                                <div className="text-gray-400 text-xs">
                                  Free Period
                                </div>
                                <div className="text-[11px] text-gray-400 mt-1">
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
              <div className="text-center py-14">
                <div className="bg-gray-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <p className="font-medium text-gray-600">
                  No timetable entries found
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Contact the administrator to schedule your classes
                </p>
              </div>
            )}

          </CardContent>
        </Card>

        {/* LEGEND */}
        {stats.totalPeriods > 0 && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm sm:text-base">
                Legend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-6 text-xs sm:text-sm">

                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded" />
                  <span>Teaching Period</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded" />
                  <span>Break Time</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border border-gray-300 rounded" />
                  <span>Free Period</span>
                </div>

              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}