"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Calendar, Clock, BookOpen, User } from "lucide-react";

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

interface ParentStudentTimetableTabProps {
  studentId: string;
  classId: string | null;
}

export default function ParentStudentTimetableTab({ studentId, classId }: ParentStudentTimetableTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [timetable, setTimetable] = useState<Record<string, Record<string, TimetableCell>>>({});
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState(DAYS[0]); // For mobile view

  useEffect(() => {
    if (classId) {
      loadTimetable();
    } else {
      setIsLoading(false);
    }
  }, [studentId, classId]);

  async function loadTimetable() {
    try {
      setIsLoading(true);

      // Get student's enrolled subject_class_ids from student_subjects table
      const { data: studentSubjects, error: studentSubjectsError } = await supabase
        .from("student_subjects")
        .select("subject_class_id")
        .eq("student_id", studentId);

      if (studentSubjectsError) {
        console.error("Error fetching student subjects:", studentSubjectsError);
        toast.error("Failed to load student subjects");
        return;
      }

      const enrolledSubjectClassIds = studentSubjects?.map((ss: { subject_class_id: any; }) => ss.subject_class_id) || [];

      if (enrolledSubjectClassIds.length === 0) {
        setIsLoading(false);
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
        .eq("class_id", classId);

      if (timetableError) {
        console.error("Error fetching timetable:", timetableError);
        toast.error("Failed to load timetable");
        return;
      }

      if (!timetableData) {
        setIsLoading(false);
        return;
      }

      // Filter entries to only include subjects the student is enrolled in
      const studentTimetableEntries = timetableData.filter((entry: { subject_classes: any[] }): boolean => {
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

        const teacher = subjectClass?.teachers;
        const teacherName = teacher
          ? `${teacher.first_name} ${teacher.last_name}`
          : "TBA";

        if (!timetableMap[day][periodSlotId]) {
          timetableMap[day][periodSlotId] = {
            subject: subjectName,
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
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading timetable...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!classId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Student not assigned to a class</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
                <p className="text-sm text-gray-600">Subjects</p>
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
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Weekly Timetable</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Student's class schedule</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Mobile Day View */}
          <div className="md:hidden space-y-4">
            {/* Day Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedDay === day
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Day's Schedule */}
            <div className="space-y-3">
              {periodSlots
                .filter((p) => p.day_of_week === selectedDay)
                .map((period) => {
                  const cell = timetable[selectedDay]?.[period.id];

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
                        cell
                          ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="text-sm font-semibold text-gray-600">
                          {period.start_time} - {period.end_time}
                        </div>
                        {cell ? (
                          <div className="space-y-2">
                            <div className="text-lg font-bold text-gray-900">
                              {cell.fullSubject}
                            </div>
                            <div className="flex items-center gap-2 text-blue-700">
                              <User className="h-4 w-4" />
                              <span className="text-sm">{cell.teacher}</span>
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
                  Student may not be enrolled in any subjects yet.
                </p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto border rounded-lg">
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
                              <div className="text-xs text-gray-600 mt-0.5">
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
                              <div className="text-xs text-gray-500">
                                {period.start_time} - {period.end_time}
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
            <div className="hidden md:block text-center py-12 mt-6">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No timetable entries found</p>
              <p className="text-gray-500 text-sm mt-1">
                Student may not be enrolled in any subjects yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      {stats.totalPeriods > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded"></div>
                <span className="text-gray-700">Classes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
                <span className="text-gray-700">Break Time</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
                <span className="text-gray-700">Free Period</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}