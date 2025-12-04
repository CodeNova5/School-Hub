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
const PERIODS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function TimetablePage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);

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

  // Open editor for a specific class/day/period (find existing entry or prepare empty)
  function openCellEditor(classId: string, day: string, period: number) {
    const found = entries.find(
      (e) =>
        (e.class_id || e.classes?.id) === classId &&
        e.day_of_week === day &&
        Number(e.period_number) === Number(period)
    );
    setEditingEntry(
      found || {
        day_of_week: day,
        period_number: period,
        class_id: classId,
        subject_id: "",
        teacher_id: "",
        start_time: "",
        end_time: "",
      }
    );
    setIsDialogOpen(true);
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

  const filtered = entries.filter((e) =>
    `${e.classes?.name} ${e.subjects?.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Timetable</h1>
            <p className="text-gray-600">Manage school timetable entries</p>
          </div>

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

        {/* TIMETABLE: each class is its own section with a table (days as columns, periods as rows) */}
        <div className="space-y-6">
          {classes.map((cls) => {
            // build a quick map for this class: day -> period -> entry
            const classEntries = entries.filter(
              (e) => (e.class_id || e.classes?.id) === (cls.id || cls.id)
            );
            const entryMap: Record<string, Record<number, any>> = {};
            classEntries.forEach((en) => {
              entryMap[en.day_of_week] = entryMap[en.day_of_week] || {};
              entryMap[en.day_of_week][Number(en.period_number)] = en;
            });

            return (
              <Card key={cls.id}>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <CardTitle>{cls.name}</CardTitle>
                    <p className="text-sm text-gray-500">{cls.level}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button size="sm" onClick={() => openCellEditor(cls.id, DAYS[0], 1)}>
                      Add / Edit
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="overflow-auto">
                  <table className="w-full table-auto border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border px-2 py-1 bg-gray-50">Period</th>
                        {DAYS.map((d) => (
                          <th key={d} className="border px-2 py-1 bg-gray-50">
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map((p) => {
                        // try to find a representative time for this period (any day)
                        const anyEntry = classEntries.find((ce) => Number(ce.period_number) === p);
                        const timeLabel = anyEntry
                          ? `${anyEntry.start_time || ""}${anyEntry.start_time && anyEntry.end_time ? " - " : ""}${anyEntry.end_time || ""}`
                          : "";

                        return (
                          <tr key={p}>
                            <td className="border px-2 py-1 font-medium w-36">
                              <div>Period {p}</div>
                              {timeLabel && <div className="text-xs text-gray-500">{timeLabel}</div>}
                            </td>
                            {DAYS.map((d) => {
                              const cellEntry = entryMap[d]?.[p];
                              return (
                                <td key={d} className="border px-2 py-1 align-top">
                                  {cellEntry ? (
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="font-medium">{cellEntry.subjects?.name || cellEntry.subject_name || "—"}</div>
                                        <div className="text-xs text-gray-500">
                                          {cellEntry.teachers?.first_name
                                            ? `${cellEntry.teachers.first_name} ${cellEntry.teachers.last_name || ""}`
                                            : cellEntry.teacher_name || ""}
                                        </div>
                                        {cellEntry.start_time || cellEntry.end_time ? (
                                          <div className="text-xs text-gray-400 mt-1">
                                            {cellEntry.start_time || ""}{cellEntry.start_time && cellEntry.end_time ? " - " : ""}{cellEntry.end_time || ""}
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="flex flex-col gap-1 ml-2">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openCellEditor(cls.id, d, p)}
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => cellEntry && deleteEntry(cellEntry.id)}
                                        >
                                          <Trash2 className="w-4 h-4 text-red-600" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-500">Empty</span>
                                      <Button
                                        size="sm"
                                        onClick={() => openCellEditor(cls.id, d, p)}
                                      >
                                        Add
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {classes.length === 0 && (
           <Card>
             <CardContent className="p-12 text-center text-gray-500">
               No timetable entries found
             </CardContent>
           </Card>
         )}
      </div>
    </DashboardLayout>
  );
}
