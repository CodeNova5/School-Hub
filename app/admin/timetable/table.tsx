"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const periods = [
  { id: 1, label: "1st Period", start: "08:00", end: "08:40" },
  { id: 2, label: "2nd Period", start: "08:40", end: "09:20" },
  { id: 3, label: "3rd Period", start: "09:20", end: "10:00" },
  { id: 4, label: "4th Period", start: "10:00", end: "10:40" },
  { id: 5, label: "5th Period", start: "10:40", end: "11:20" },
  { id: "break1", label: "BREAK", start: "11:20", end: "12:00", break: true },
  { id: 6, label: "6th Period", start: "12:00", end: "12:40" },
  { id: 7, label: "7th Period", start: "12:40", end: "13:20" },
  { id: 8, label: "8th Period", start: "13:20", end: "14:00" },
  { id: "break2", label: "BREAK", start: "14:00", end: "14:15", break: true },
  { id: 9, label: "9th Period", start: "14:15", end: "14:50" },
  { id: 10, label: "10th Period", start: "14:50", end: "15:25" },
  { id: 11, label: "11th Period", start: "15:25", end: "16:00" },
];

export default function TimetablePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [timetableEntries, setTimetableEntries] = useState<any[]>([]);
  const [classTimetable, setClassTimetable] = useState<Record<number | string, Record<string, any>>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase.from("classes").select("*").order("level");
    if (data) setClasses(data);
  }

  async function showTimetable(classId: string) {
    setSelectedClass(classId);

    const { data } = await supabase
      .from("timetable_entries")
      .select("*, subjects(name), teachers(first_name,last_name)")
      .eq("class_id", classId);

    if (!data) return;

    // Map entries: { period_id: { mon: ..., tue: ..., ... } }
    const map: Record<number | string, Record<string, any>> = {};
    periods.forEach((p) => {
      if (!p.break) map[p.id] = { mon: null, tue: null, wed: null, thu: null, fri: null };
    });

    data.forEach((entry) => {
      const dayKey = entry.day_of_week.toLowerCase().slice(0, 3); // mon, tue, ...
      if (!map[entry.period_number]) map[entry.period_number] = {};
      map[entry.period_number][dayKey] = {
        subject: entry.subjects?.name,
        teacher: entry.teachers ? `${entry.teachers.first_name} ${entry.teachers.last_name}` : null,
      };
    });

    setClassTimetable(map);
    setIsModalOpen(true);
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Timetable</h1>
        <p className="text-gray-600">Select a class to view its timetable</p>

        {/* CLASS SELECT + VIEW BUTTON */}
        <div className="flex gap-2 items-center">
          <select
            className="border rounded-md h-10 px-2"
            value={selectedClass || ""}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">Select a class</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          <Button
            onClick={() => selectedClass && showTimetable(selectedClass)}
            disabled={!selectedClass}
          >
            View Timetable
          </Button>
        </div>

        {/* TIMETABLE MODAL */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                Timetable for {classes.find((c) => c.id === selectedClass)?.name}
              </DialogTitle>
            </DialogHeader>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">Period</th>
                  {DAYS.map((d) => (
                    <th key={d} className="border px-2 py-1">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) =>
                  period.break ? (
                    <tr key={period.id} className="bg-gray-200 text-center">
                      <td colSpan={6} className="py-1">
                        {period.label} ({period.start}–{period.end})
                      </td>
                    </tr>
                  ) : (
                    <tr key={period.id}>
                      <td className="border px-2 py-1">
                        <div>{period.label}</div>
                        <div className="text-gray-500 text-xs">{period.start}-{period.end}</div>
                      </td>
                      {["mon","tue","wed","thu","fri"].map((day) => (
                        <td key={day} className="border px-2 py-1 text-center">
                          {classTimetable[period.id]?.[day]?.subject ?? ""}
                        </td>
                      ))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
