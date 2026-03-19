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
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Class Timetable</h3>
            {className && <p className="text-sm text-slate-600 mt-1">{className}</p>}
          </div>
          {showExportButtons && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handleExportPDF}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                size="sm"
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          )}
        </div>
      </div>
      <Card className="border-slate-200">
      <CardContent className="p-4 md:p-6">
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
                className={`flex-shrink-0 whitespace-nowrap ${
                  selectedDay === day 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
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
                      className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg text-center hover:bg-orange-100 transition-colors"
                    >
                      <div className="font-semibold text-orange-900">☕ BREAK</div>
                      <div className="text-xs text-orange-700 mt-1 font-medium">
                        {period.start_time} - {period.end_time}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={period.id}
                    className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
                      entries.length > 0
                        ? "bg-blue-50 border-blue-300 hover:bg-blue-100 hover:border-blue-400"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                    onClick={() => onEntryClick?.(entries[0] || null, period.id, selectedDay)}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-tight">
                        Period {idx + 1} • {period.start_time}–{period.end_time}
                      </div>
                      {entries.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="text-base font-bold text-slate-900">
                            {subjectDisplay || "—"}
                          </div>
                          <div className="text-sm text-blue-700 font-medium">
                            {uniqueTeachers || "No teacher"}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-sm flex items-center gap-2">
                          <Plus className="w-4 h-4 opacity-40" />
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
        <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden" id={`class-timetable-${classId}`}>
          <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-white border-b-2 border-slate-200">
                <th className="px-4 py-3 font-semibold text-slate-700 text-left text-sm w-24">
                  Period
                </th>
                {DAYS.map((day) => (
                  <th key={day} className="px-4 py-3 font-semibold text-slate-700 text-center text-sm border-l border-slate-200">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxPeriods }, (_, i) => (
                <tr key={i} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 bg-slate-50 text-center font-semibold text-slate-700 text-sm w-24 border-r border-slate-200">
                    P{i + 1}
                  </td>
                  {DAYS.map((day) => {
                    const period = periodsByDay[day]?.[i];
                    if (!period) {
                      return (
                        <td key={day} className="px-4 py-3 text-center text-slate-400 border-l border-slate-200">
                          —
                        </td>
                      );
                    }

                    if (period.is_break) {
                      return (
                        <td key={day} className="px-4 py-3 bg-orange-50 border-l border-slate-200">
                          <div className="text-center">
                            <div className="font-semibold text-orange-900 text-sm">☕ BREAK</div>
                            <div className="text-xs text-orange-700 mt-1">
                              {period.start_time}–{period.end_time}
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
                        <div className="text-xs text-slate-500 text-center font-medium">
                          {period.start_time}–{period.end_time}
                        </div>
                        <div className="font-semibold text-slate-900 text-center text-sm mt-1">
                          {subjectDisplay || "—"}
                        </div>
                        <div className="text-xs text-blue-700 text-center mt-1 font-medium">
                          {uniqueTeachers || "No teacher"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-slate-500 text-center font-medium">
                          {period.start_time}–{period.end_time}
                        </div>
                        <div className="text-slate-400 text-center py-1">
                          {onEntryClick && (
                            <Plus className="w-3.5 h-3.5 mx-auto mb-0.5 opacity-40" />
                          )}
                          <span className="text-xs">
                            {onEntryClick ? "Add" : "Free"}
                          </span>
                        </div>
                      </>
                    );

                    return (
                      <td
                        key={day}
                        className={`px-4 py-3 border-l border-slate-200 ${
                          onEntryClick ? "cursor-pointer hover:bg-blue-50 transition-colors" : ""
                        } ${entries.length > 0 ? "bg-blue-50" : "bg-white"}`}
                        onClick={() => onEntryClick?.(entries[0] || null, period.id, day)}
                      >
                        <div className="space-y-0.5">{cellContent}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {periodSlots.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No timetable configured yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
