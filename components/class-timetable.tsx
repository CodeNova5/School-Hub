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
  period_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
};

type TimetableEntry = {
  id: string;
  class_id: string;
  period_slot_id: string;
  day_of_week: string;
  classes?: { name: string; level: string };
  period_slots?: PeriodSlot;
  subject_classes?: {
    id: string;
    subject_code: string;
    subjects?: { name: string; department?: string; religion?: string };
    teachers?: { first_name: string; last_name: string };
  };
};

interface ClassTimetableProps {
  classId: string;
  className?: string;
  showExportButtons?: boolean;
  onEntryClick?: (entry: TimetableEntry | null, periodSlotId: string, day: string) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function ClassTimetable({
  classId,
  className,
  showExportButtons = true,
  onEntryClick,
}: ClassTimetableProps) {
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (classId) {
      fetchTimetable();
    }
  }, [classId]);

  async function fetchTimetable() {
    setLoading(true);
    const { data: entries } = await supabase
      .from("timetable_entries")
      .select(`
        *,
        classes(name, level),
        period_slots(id, day_of_week, period_number, start_time, end_time, is_break),
        subject_classes (
          id,
          subject_code,
          subjects ( name, department, religion ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("class_id", classId)
      
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
      if (a.day_of_week === b.day_of_week) return a.period_number - b.period_number;
      return a.day_of_week.localeCompare(b.day_of_week);
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

        const entry = timetableEntries.find(
          e => e.period_slot_id === period.id
        );

        if (entry && entry.subject_classes) {
          const subject = entry.subject_classes.subjects?.name || "";
          const teacher = entry.subject_classes.teachers 
            ? `${entry.subject_classes.teachers.first_name} ${entry.subject_classes.teachers.last_name}`
            : "";
          row[day] = `${subject} - ${teacher}`;
        } else {
          row[day] = "Free Period";
        }
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
        <div className="overflow-x-auto border rounded-lg" id={`class-timetable-${classId}`}>
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

                    // Find entry for this period slot
                    const entry = timetableEntries.find(
                      e => e.period_slot_id === period.id
                    );

                    const cellContent = entry && entry.subject_classes ? (
                      <>
                        <div className="text-xs text-gray-600 text-center">
                          {period.start_time} - {period.end_time}
                        </div>
                        <div className="font-semibold text-gray-800 text-center">
                          {entry.subject_classes.subjects?.name || "—"}
                        </div>
                        <div className="text-xs text-gray-600 text-center">
                          {entry.subject_classes.teachers
                            ? `${entry.subject_classes.teachers.first_name} ${entry.subject_classes.teachers.last_name}`
                            : "No teacher"}
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
                        onClick={() => onEntryClick?.(entry || null, period.id, day)}
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
