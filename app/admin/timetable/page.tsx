"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
    // fetch timetable entries with joined subjects (including department) and teachers and classes
    const [timetableRes, classRes, subjectRes, teacherRes] = await Promise.all([
      supabase
        .from("timetable_entries")
        .select("*, classes(name, level), subjects(name, department), teachers(first_name, last_name)")
        .order("period_number", { ascending: true }),
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

  // Helper: get subject options by department (including subjects with null department for non-SSS)
  function subjectsByDepartment(dept?: string) {
    return subjects.filter((s) => {
      if (!dept) return !s.department; // for non-departmental, match subjects with no department
      return s.department === dept;
    });
  }

  // Helper: produce 3-letter code from subject name
  function shortCode(name: string | undefined | null) {
    if (!name) return "";
    const cleaned = name.trim();
    if (cleaned.length <= 3) return cleaned.toUpperCase();
    return cleaned.slice(0, 3).toUpperCase();
  }

  // Submit handler: supports departmental mode (inserts up to 3 rows) or single entry
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    const day_of_week = (data.get("day_of_week") as string) || "";
    const period_number = Number(data.get("period_number"));
    const class_id = data.get("class_id") as string;

    const departmentalMode = data.get("departmental") === "on";

    // If editing an individual row: update that row
    if (editingEntry) {
      const payload = {
        day_of_week,
        period_number,
        class_id,
        subject_id: data.get("subject_id") as string,
        teacher_id: data.get("teacher_id") as string,
      };

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
      return;
    }

    // CREATE
    if (!departmentalMode) {
      // Single-row insertion
      const payload = {
        day_of_week,
        period_number,
        class_id,
        subject_id: data.get("subject_id") as string,
        teacher_id: data.get("teacher_id") as string,
      };

      const { error } = await supabase.from("timetable_entries").insert(payload);

      if (error) toast.error(error.message || "Failed to create entry");
      else {
        toast.success("Entry added");
        closeDialog();
        fetchAll();
      }
    } else {
      // Departmental mode: possibly insert up to 3 rows (Science, Arts, Commercial)
      const inserts: any[] = [];
      const sciSub = data.get("science_subject_id") as string;
      const artSub = data.get("arts_subject_id") as string;
      const comSub = data.get("commercial_subject_id") as string;

      const sciTeacher = data.get("science_teacher_id") as string;
      const artTeacher = data.get("arts_teacher_id") as string;
      const comTeacher = data.get("commercial_teacher_id") as string;

      if (sciSub) inserts.push({
        day_of_week,
        period_number,
        class_id,
        subject_id: sciSub,
        teacher_id: sciTeacher || null,
      });
      if (artSub) inserts.push({
        day_of_week,
        period_number,
        class_id,
        subject_id: artSub,
        teacher_id: artTeacher || null,
      });
      if (comSub) inserts.push({
        day_of_week,
        period_number,
        class_id,
        subject_id: comSub,
        teacher_id: comTeacher || null,
      });

      if (inserts.length === 0) {
        toast.error("Choose at least one department subject to add");
        return;
      }

      // Insert all rows in one request
      const { error } = await supabase.from("timetable_entries").insert(inserts);

      if (error) toast.error(error.message || "Failed to create departmental entries");
      else {
        toast.success("Departmental entries added");
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

  // Build groupedEntries for grid: coalesce multiple rows with same class/day/period
  const groupedEntries = useMemo(() => {
    // key: `${class_id}||${day_of_week}||${period_number}`
    const map: Record<string, any> = {};

    entries.forEach((en) => {
      const key = `${en.class_id}||${en.day_of_week}||${en.period_number}`;
      if (!map[key]) {
        map[key] = {
          id: key, // synthetic id
          class_id: en.class_id,
          class_name: en.classes?.name,
          day_of_week: en.day_of_week,
          period_number: en.period_number,
          start_time: en.start_time,
          end_time: en.end_time,
          raw: [],
        };
      }
      map[key].raw.push(en);
    });

    // transform raw rows into combined subject string and combined teachers string
    const results = Object.values(map).map((g) => {
      // try to order by departments Science, Arts, Commercial
      const order = ["Science", "Arts", "Commercial"];

      // collect departmental codes
      const deptMap: Record<string, string> = {};
      const teacherMap: Record<string, string> = {};

      g.raw.forEach((r: any) => {
        const subjName = r.subjects?.name || "";
        const subjDept = r.subjects?.department || ""; // may be null for non-dept
        const code = shortCode(subjName);
        // If subject has a department, use that to place it
        if (subjDept) deptMap[subjDept] = code;
        else {
          // Non-departmental subject — place under a special key like "_single"
          deptMap["_single"] = subjName;
        }

        const teacherName = r.teachers ? `${r.teachers.first_name} ${r.teachers.last_name}` : "";
        // For departmental rows we map teacher by department if subject has one; else append to single
        if (subjDept) teacherMap[subjDept] = teacherName;
        else teacherMap["_single"] = teacherName;
      });

      // Construct combined subject display
      let combined = "";
      if (deptMap["_single"]) {
        // non-departmental single subject (normal behaviour)
        combined = deptMap["_single"];
      } else {
        // departmental combined string in order Science / Arts / Commercial, include only those present
        const parts: string[] = [];
        order.forEach((d) => {
          if (deptMap[d]) parts.push(deptMap[d]);
        });
        combined = parts.join(" / ");
      }

      // combine teacher names similarly (join with " / ")
      let teachersCombined = "";
      if (teacherMap["_single"]) {
        teachersCombined = teacherMap["_single"];
      } else {
        const tparts: string[] = [];
        order.forEach((d) => {
          if (teacherMap[d]) tparts.push(teacherMap[d]);
        });
        teachersCombined = tparts.join(" / ");
      }

      return {
        ...g,
        subject_display: combined,
        teacher_display: teachersCombined,
        rows: g.raw,
      };
    });

    // return sorted by day & period (optional)
    results.sort((a: any, b: any) => {
      if (a.day_of_week === b.day_of_week) return a.period_number - b.period_number;
      return DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week);
    });

    return results;
  }, [entries]);

  // show timetable modal for a specific class
  async function showTimetable(classId: string) {
    setSelectedClass(classId);

    const { data } = await supabase
      .from("timetable_entries")
      .select("*, subjects(name, department), teachers(first_name,last_name)")
      .eq("class_id", classId);

    if (!data) return;

    // build map keyed by period id with day keys containing combined strings
    const map: Record<number | string, Record<string, any>> = {};
    TIMETABLE_PERIODS.forEach((p) => {
      if (!p.break) map[p.id] = { mon: null, tue: null, wed: null, thu: null, fri: null };
    });

    // group entries by period and day
    const tempGroup: Record<string, any[]> = {}; // key = `${period}||${dayKey}`
    data.forEach((entry) => {
      const dow = (entry.day_of_week || "").toString();
      const dayKey = dow.toLowerCase().slice(0, 3); // mon, tue, ...
      const key = `${entry.period_number}||${dayKey}`;
      tempGroup[key] = tempGroup[key] || [];
      tempGroup[key].push(entry);
    });

    // transform groups into combined strings and set into map
    Object.entries(tempGroup).forEach(([k, rows]) => {
      const [periodIdStr, dayKey] = k.split("||");
      const periodId = isNaN(Number(periodIdStr)) ? periodIdStr : Number(periodIdStr);

      // order departments
      const order = ["Science", "Arts", "Commercial"];
      const deptMap: Record<string, string> = {};
      rows.forEach((r: any) => {
        const sname = r.subjects?.name || "";
        const sdept = r.subjects?.department || "";
        const code = shortCode(sname);
        if (sdept) deptMap[sdept] = code;
        else deptMap["_single"] = sname;
      });

      let display = "";
      if (deptMap["_single"]) {
        display = deptMap["_single"];
      } else {
        const parts: string[] = [];
        order.forEach((d) => {
          if (deptMap[d]) parts.push(deptMap[d]);
        });
        display = parts.join(" / ");
      }

      if (!map[periodId]) map[periodId] = {};
      map[periodId][dayKey] = {
        subject: display,
        rows,
      };
    });

    setClassTimetable(map);
    setIsTableModalOpen(true);
  }

  // filtered grouped entries used for the cards grid
  const filtered = groupedEntries.filter((g) =>
    `${g.class_name || ""} ${g.subject_display || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">Timetable</h1>
            <p className="text-gray-600">Manage school timetable entries (supports departmental periods for SSS)</p>
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

                    {/* Departmental toggle - show only when class is SSS */}
                    {/* We can't know the selected class on initial render; we'll show the toggle always,
                        but when the chosen class is not SSS, departmental mode will still insert single rows */}
                    <div className="flex items-center gap-3">
                      <input id="departmental" name="departmental" type="checkbox" className="h-4 w-4" />
                      <Label htmlFor="departmental">Departmental Period (Science / Arts / Commercial)</Label>
                    </div>

                    {/* Single subject picker (used when Departmental not checked OR editing single rows) */}
                    <div>
                      <Label>Subject (single)</Label>
                      <select
                        name="subject_id"
                        className="w-full border rounded-md h-10 px-2"
                        defaultValue={editingEntry?.subject_id || ""}
                        {...(editingEntry ? { required: true } : {})}
                      >
                        <option value="">Select subject</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.department ? `— ${s.department}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label>Teacher (single)</Label>
                      <select
                        name="teacher_id"
                        className="w-full border rounded-md h-10 px-2"
                        defaultValue={editingEntry?.teacher_id || ""}
                      >
                        <option value="">Select teacher</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.first_name} {t.last_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Departmental fields - Science */}
                    <div className="border p-3 rounded">
                      <div className="mb-2 font-semibold">Departmental Subjects (choose any)</div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label>Science Subject</Label>
                          <select name="science_subject_id" className="w-full border rounded-md h-10 px-2">
                            <option value="">No Science Subject</option>
                            {subjectsByDepartment("Science").map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>

                          <Label className="mt-2">Science Teacher</Label>
                          <select name="science_teacher_id" className="w-full border rounded-md h-10 px-2">
                            <option value="">No teacher</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.first_name} {t.last_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label>Arts Subject</Label>
                          <select name="arts_subject_id" className="w-full border rounded-md h-10 px-2">
                            <option value="">No Arts Subject</option>
                            {subjectsByDepartment("Arts").map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>

                          <Label className="mt-2">Arts Teacher</Label>
                          <select name="arts_teacher_id" className="w-full border rounded-md h-10 px-2">
                            <option value="">No teacher</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.first_name} {t.last_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label>Commercial Subject</Label>
                          <select name="commercial_subject_id" className="w-full border rounded-md h-10 px-2">
                            <option value="">No Commercial Subject</option>
                            {subjectsByDepartment("Commercial").map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>

                          <Label className="mt-2">Commercial Teacher</Label>
                          <select name="commercial_teacher_id" className="w-full border rounded-md h-10 px-2">
                            <option value="">No teacher</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.first_name} {t.last_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
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
                  <strong>{entry.class_name}</strong>
                </p>
                <p>
                  <span className="text-gray-600">Subject:</span>{" "}
                  <strong>{entry.subject_display || ""}</strong>
                </p>
                <p>
                  <span className="text-gray-600">Teacher:</span>{" "}
                  <strong>{entry.teacher_display || ""}</strong>
                </p>
                <p className="text-gray-600 text-xs">
                  {entry.start_time} - {entry.end_time}
                </p>

                <div className="flex gap-1 pt-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(entry.rows?.[0] || null)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  {/* When user clicks delete here we will delete all rows for that grouped entry.
                      You may want to change this to delete one by one instead. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      // delete all underlying rows in this grouped entry
                      if (!confirm("Delete all rows for this class/day/period?")) return;
                      const ids = (entry.rows || []).map((r: any) => r.id);
                      Promise.all(ids.map((id: string) => supabase.from("timetable_entries").delete().eq("id", id)))
                        .then(() => { toast.success("Deleted"); fetchAll(); })
                        .catch(() => toast.error("Failed to delete"));
                    }}
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
