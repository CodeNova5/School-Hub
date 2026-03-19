"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileDown, Download, Plus } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx-js-style";

type PeriodSlot = {
  id: string;
  day_of_week: string;
  period_number: number | null;
  start_time: string;
  end_time: string;
  is_break: boolean;
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

type TimetableEntry = {
  id: string;
  class_id: string;
  period_slot_id: string;
  day_of_week: string;
  classes?: { name: string };
  period_slots?: PeriodSlot;
  subject_classes?: {
    id: string;
    subject_code: string;
    subjects?: { name: string };
    teachers?: { first_name: string; last_name: string };
  };
};

interface ClassTimetableProps {
  classId: string;
  className?: string;
  showExportButtons?: boolean;
  onEntryClick?: (entry: TimetableEntry | null, periodSlotId: string, day: string) => void;
  schoolId?: string | null;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function ClassTimetable({
  classId,
  className,
  showExportButtons = true,
  onEntryClick,
  schoolId,
}: ClassTimetableProps) {
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(DAYS[0]); // For mobile view

  useEffect(() => {
    if (classId) {
      fetchTimetable();
    }
  }, [classId]);

  async function fetchTimetable() {
    setLoading(true);
    let query = supabase
      .from("timetable_entries")
      .select(`
        *,
        classes(name),
        period_slots(id, day_of_week, period_number, start_time, end_time, is_break),
        subject_classes (
          id,
          subject_code,
          subjects!subject_classes_subject_id_fkey ( name ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("class_id", classId);

    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }

    const { data: entries } = await query;
      
    // Extract unique period slots from entries
    const slots: PeriodSlot[] = [];
    const slotMap = new Map();
    (entries || []).forEach((entry: any) => {
      if (entry.period_slots && !slotMap.has(entry.period_slots.id)) {
        slotMap.set(entry.period_slots.id, entry.period_slots);
      }
    });
    slotMap.forEach((v) => slots.push(v));
    slots.sort((a, b) => {
      if (a.day_of_week === b.day_of_week) return compareSlotTime(a, b);
      return DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week);
    });

    setTimetableEntries(entries || []);
    setPeriodSlots(slots);
    setLoading(false);
  }

  const periodsByDay = useMemo(() => {
    const dayMap: Record<string, PeriodSlot[]> = {};
    DAYS.forEach(day => {
      dayMap[day] = periodSlots.filter(p => p.day_of_week === day);
    });
    return dayMap;
  }, [periodSlots]);

  // Group entries by period slot to handle multiple subjects (departmental/religious)
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
    return Math.max(...Object.values(periodsByDay).map(p => p.length), 0);
  }, [periodsByDay]);

  async function handleExportPDF() {
    const element = document.getElementById(`class-timetable-${classId}`);
    if (!element) return;

    const canvas = await html2canvas(element, { scale: 2 });
    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF("l", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(img, "PNG", 0, 0, width, height);
    pdf.save(`${className || "class"}-timetable.pdf`);
    toast.success("Timetable exported as PDF");
  }

  function handleExportExcel() {
    const exportData: any[] = [];

    for (let i = 0; i < maxPeriods; i++) {
      const row: any = { Period: `Period ${i + 1}` };
      
      DAYS.forEach(day => {
        const period = periodsByDay[day]?.[i];
        if (!period) {
          row[day] = "";
          return;
        }

        if (period.is_break) {
          row[day] = `BREAK (${period.start_time}-${period.end_time})`;
          return;
        }

        const entries = groupedEntries[period.id] || [];
        if (entries.length === 0) {
          row[day] = "Free Period";
          return;
        }

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

        row[day] = `${subjectDisplay} - ${uniqueTeachers}`;
      });

      exportData.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, `${className || "class"}-timetable.xlsx`);
    toast.success("Timetable exported as Excel");
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-gray-500">Loading timetable...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="overflow-x-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Class Timetable</CardTitle>
          {showExportButtons && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportPDF}
              >
                <FileDown className="h-4 w-4 mr-1" />
                Export PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportExcel}
              >
                <Download className="h-4 w-4 mr-1" />
                Export Excel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Mobile Day View */}
        <div className="md:hidden space-y-4">
          {/* Day Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
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
                    className={`p-4 border rounded-lg transition-colors cursor-pointer ${
                      entries.length > 0
                        ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                    onClick={() => onEntryClick?.(entries[0] || null, period.id, selectedDay)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-semibold text-gray-600">
                        Period {idx + 1} • {period.start_time} - {period.end_time}
                      </div>
                      {entries.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-lg font-bold text-gray-900">
                            {subjectDisplay || "—"}
                          </div>
                          <div className="text-sm text-blue-700">
                            {uniqueTeachers || "No teacher"}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 italic flex items-center gap-2">
                          <Plus className="w-4 h-4 opacity-50" />
                          <span>{onEntryClick ? "Add Subject" : "Free Period"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {periodSlots.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No timetable configured yet.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block border rounded-lg overflow-x-auto" id={`class-timetable-${classId}`}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-3 font-semibold text-gray-700 min-w-[100px]">
                  Period
                </th>
                {DAYS.map((day) => (
                  <th key={day} className="border border-gray-300 p-3 font-semibold text-gray-700 min-w-[180px]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxPeriods }, (_, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 p-3 bg-gray-50 text-center font-medium">
                    Period {i + 1}
                  </td>
                  {DAYS.map((day) => {
                    const period = periodsByDay[day]?.[i];
                    if (!period) {
                      return (
                        <td key={day} className="border border-gray-300 p-3 text-center text-gray-400">
                          —
                        </td>
                      );
                    }

                    if (period.is_break) {
                      return (
                        <td key={day} className="border border-gray-300 p-3 bg-yellow-50">
                          <div className="text-center">
                            <div className="font-semibold text-yellow-800">BREAK</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {period.start_time} - {period.end_time}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // Find entries for this period slot
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

                    const cellContent = entries.length > 0 ? (
                      <>
                        <div className="text-xs text-gray-600 text-center">
                          {period.start_time} - {period.end_time}
                        </div>
                        <div className="font-semibold text-gray-800 text-center">
                          {subjectDisplay || "—"}
                        </div>
                        <div className="text-xs text-gray-600 text-center">
                          {uniqueTeachers || "No teacher"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-gray-600 text-center">
                          {period.start_time} - {period.end_time}
                        </div>
                        <div className="text-gray-400 text-center py-2">
                          {onEntryClick && (
                            <Plus className="w-4 h-4 mx-auto mb-1 opacity-50" />
                          )}
                          <span className="text-xs">
                            {onEntryClick ? "Add Subject" : "Free Period"}
                          </span>
                        </div>
                      </>
                    );

                    return (
                      <td
                        key={day}
                        className={`border border-gray-300 p-3 ${
                          onEntryClick ? "cursor-pointer hover:bg-blue-50 transition-colors" : ""
                        }`}
                        onClick={() => onEntryClick?.(entries[0] || null, period.id, day)}
                      >
                        <div className="space-y-1">{cellContent}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {periodSlots.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No timetable configured yet. Please set up period slots and entries in the Timetable Management page.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
