"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_SHORT = ["mon", "tue", "wed", "thu", "fri"];
const PERIODS = Array.from({ length: 10 }, (_, i) => i + 1);

// Detailed timetable periods (includes breaks) copied from table.tsx
const TIMETABLE_PERIODS = [
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
  // ...existing code...
  const [entries, setEntries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);

  // New state for class timetable modal
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classTimetable, setClassTimetable] = useState<Record<number | string, Record<string, any>>>({});
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [timetableRes, classRes, subjectRes, teacherRes] = await Promise.all([
      supabase.from("timetable_entries").select("*, classes(name), subjects(name), teachers(first_name, last_name)").order("period_number"),
      supabase.from("classes").select("*").order("name"),
      supabase.from("subjects").select("*").order("name"),
      supabase.from("teachers").select("*").order("first_name"),
    ]);

    if (timetableRes.data) setEntries(timetableRes.data);
    if (classRes.data) setClasses(classRes.data);
    if (subjectRes.data) setSubjects(subjectRes.data);
    if (teacherRes.data) setTeachers(teacherRes.data);
  }

  function openEdit(entry: any) {
    setEditingEntry(entry);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setEditingEntry(null);
    setIsDialogOpen(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    const payload = {
      day_of_week: data.get("day_of_week") as string,
      period_number: Number(data.get("period_number")),
      class_id: data.get("class_id") as string,
      subject_id: data.get("subject_id") as string,
      teacher_id: data.get("teacher_id") as string,
    };

    if (editingEntry) {
      const { error } = await supabase
        .from("timetable_entries")
        .update(payload)
        .eq("id", editingEntry.id);

      if (error) toast.error("Failed to update entry");
      else {
        toast.success("Entry updated");
        closeDialog();
        fetchAll();
      }
    } else {
      const { error } = await supabase.from("timetable_entries").insert(payload);

      if (error) toast.error(error.message);
      else {
        toast.success("Entry added");
        closeDialog();
        fetchAll();
      }
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;

    const { error } = await supabase.from("timetable_entries").delete().eq("id", id);

    if (error) toast.error("Failed to delete");
    else {
      toast.success("Entry deleted");
      fetchAll();
    }
  }

  // New: show timetable modal for a specific class
  async function showTimetable(classId: string) {
    setSelectedClass(classId);

    const { data } = await supabase
      .from("timetable_entries")
      .select("*, subjects(name), teachers(first_name,last_name)")
      .eq("class_id", classId);

    if (!data) return;

    // build map keyed by period id with day keys
    const map: Record<number | string, Record<string, any>> = {};
    TIMETABLE_PERIODS.forEach((p) => {
      if (!p.break) map[p.id] = { mon: null, tue: null, wed: null, thu: null, fri: null };
    });

    data.forEach((entry) => {
      const dow = (entry.day_of_week || "").toString();
      const dayKey = dow.toLowerCase().slice(0, 3); // mon, tue, ...
      if (!map[entry.period_number]) map[entry.period_number] = {};
      map[entry.period_number][dayKey] = {
        subject: entry.subjects?.name,
        teacher: entry.teachers ? `${entry.teachers.first_name} ${entry.teachers.last_name}` : null,
      };
    });

    setClassTimetable(map);
    setIsTableModalOpen(true);
  }

  const filtered = entries.filter((e) =>
    `${e.classes?.name} ${e.subjects?.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">Timetable</h1>
            <p className="text-gray-600">Manage school timetable entries</p>
          </div>

          <div className="flex flex-col gap-2 items-end">
            {/* CLASS SELECT + VIEW TIMETABLE */}
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

            <div className="flex gap-2">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingEntry(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEntry ? "Edit Entry" : "Add Timetable Entry"}
                    </DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Day */}
                    <div>
                      <Label>Day of Week</Label>
                      <select
                        name="day_of_week"
                        className="w-full border rounded-md h-10 px-2"
                        defaultValue={editingEntry?.day_of_week || ""}
                        required
                      >
                        <option value="">Select day</option>
                        {DAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Period */}
                    <div>
                      <Label>Period</Label>
                      <select
                        name="period_number"
                        className="w-full border rounded-md h-10 px-2"
                        defaultValue={editingEntry?.period_number || ""}
                        required
                      >
                        <option value="">Select period</option>
                        {PERIODS.map((p) => (
                          <option key={p} value={p}>
                            Period {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Class */}
                    <div>
                      <Label>Class</Label>
                      <select
                        name="class_id"
                        className="w-full border rounded-md h-10 px-2"
                        defaultValue={editingEntry?.class_id || ""}
                        required
                      >
                        <option value="">Select class</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subject */}
                    <div>
                      <Label>Subject</Label>
                      <select
                        name="subject_id"
                        className="w-full border rounded-md h-10 px-2"
                        defaultValue={editingEntry?.subject_id || ""}
                        required
                      >
                        <option value="">Select subject</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Teacher */}
                    <div>
                      <Label>Teacher</Label>
                      <select
                        name="teacher_id"
                        className="w-full border rounded-md h-10 px-2"
                        defaultValue={editingEntry?.teacher_id || ""}
                        required
                      >
                        <option value="">Select teacher</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.first_name} {t.last_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                      <Button className="flex-1" type="submit">
                        {editingEntry ? "Update" : "Create"}
                      </Button>
                      <Button variant="outline" type="button" onClick={closeDialog}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by class or subject..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* TIMETABLE GRID (cards) */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-2">
                <CardTitle>
                  {entry.day_of_week} — Period {entry.period_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-600">Class:</span>{" "}
                  <strong>{entry.classes?.name}</strong>
                </p>
                <p>
                  <span className="text-gray-600">Subject:</span>{" "}
                  <strong>{entry.subjects?.name}</strong>
                </p>
                <p>
                  <span className="text-gray-600">Teacher:</span>{" "}
                  <strong>
                    {entry.teachers?.first_name} {entry.teachers?.last_name}
                  </strong>
                </p>
                <p className="text-gray-600 text-xs">
                  {entry.start_time} - {entry.end_time}
                </p>

                <div className="flex gap-1 pt-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteEntry(entry.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-gray-500">
              No timetable entries found
            </CardContent>
          </Card>
        )}

        {/* TIMETABLE MODAL (class view) */}
        <Dialog open={isTableModalOpen} onOpenChange={setIsTableModalOpen}>
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
                  {DAYS_SHORT.map((d, i) => (
                    <th key={d} className="border px-2 py-1">{DAYS[i].slice(0,3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIMETABLE_PERIODS.map((period) =>
                  period.break ? (
                    <tr key={String(period.id)} className="bg-gray-200 text-center">
                      <td colSpan={6} className="py-1">
                        {period.label} ({period.start}–{period.end})
                      </td>
                    </tr>
                  ) : (
                    <tr key={String(period.id)}>
                      <td className="border px-2 py-1">
                        <div>{period.label}</div>
                        <div className="text-gray-500 text-xs">{period.start}-{period.end}</div>
                      </td>
                      {DAYS_SHORT.map((day) => (
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