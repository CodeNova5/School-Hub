"use client";
import React, { useEffect, useMemo, useState } from "react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx-js-style";
import { Printer, Download } from "lucide-react";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_SHORT = ["mon", "tue", "wed", "thu", "fri"];
const PERIODS = Array.from({ length: 10 }, (_, i) => i + 1);

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

  // form state (controlled) — so we can hide/show fields dynamically
  const [formDay, setFormDay] = useState("");
  const [formPeriod, setFormPeriod] = useState<number | "">("");
  const [formClassId, setFormClassId] = useState<string>("");
  const [departmentalMode, setDepartmentalMode] = useState(false);
  const [formSubjectId, setFormSubjectId] = useState<string>("");
  const [formScienceSubjectId, setFormScienceSubjectId] = useState<string>("");
  const [formArtsSubjectId, setFormArtsSubjectId] = useState<string>("");
  const [formCommercialSubjectId, setFormCommercialSubjectId] = useState<string>("");

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classTimetable, setClassTimetable] = useState<Record<number | string, Record<string, any>>>({});
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  // ...existing code...

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [timetableRes, classRes, subjectRes, teacherRes] = await Promise.all([
      supabase
        .from("timetable_entries")
        .select("*, classes(name, level), subjects(name, department, teacher_id)")
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

  // open add dialog (reset form)
  function openAddDialog() {
    setEditingEntry(null);
    setFormDay("");
    setFormPeriod("");
    setFormClassId("");
    setDepartmentalMode(false);
    setFormSubjectId("");
    setFormScienceSubjectId("");
    setFormArtsSubjectId("");
    setFormCommercialSubjectId("");
    setIsDialogOpen(true);
  }

  // open edit for a single underlying row (editingEntry should be a specific row)
  function openEdit(entryRow: any) {
    if (!entryRow) return;
    setEditingEntry(entryRow);
    setFormDay(entryRow.day_of_week || "");
    setFormPeriod(entryRow.period_number || "");
    setFormClassId(entryRow.class_id || "");
    setDepartmentalMode(false); // editing one row -> single subject
    setFormSubjectId(entryRow.subject_id || "");
    setFormScienceSubjectId("");
    setFormArtsSubjectId("");
    setFormCommercialSubjectId("");
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setEditingEntry(null);
    setIsDialogOpen(false);
  }

  // add: openAdd pre-fills the add form for clicked empty cell and opens the dialog
  function openAdd(day: string, period: number, selectedClass: string | null) {
    // ensure we're creating a new entry (not editing)
    setEditingEntry(null);

    // prefill form values
    setFormDay(day);
    setFormPeriod(period);

    // if the user has already selected a class in the UI, prefill it
    if (selectedClass) {
      setFormClassId(selectedClass);
    } else {
      setFormClassId("");
    }

    // reset subject fields / departmental mode
    setDepartmentalMode(false);
    setFormSubjectId("");
    setFormScienceSubjectId("");
    setFormArtsSubjectId("");
    setFormCommercialSubjectId("");

    // open dialog
    setIsDialogOpen(true);
  }

  function subjectsByDepartment(dept?: string) {
    return subjects.filter((s) => {
      if (!dept) return !s.department;
      return s.department === dept;
    });
  }

  function shortCode(name: string | undefined | null) {
    if (!name) return "";
    const cleaned = name.trim();
    if (cleaned.length <= 3) return cleaned.toUpperCase();
    return cleaned.slice(0, 3).toUpperCase();
  }

  function teacherForSubject(subject: any) {
    if (!subject?.teacher_id) return "";
    const t = teachers.find((x) => x.id === subject.teacher_id);
    return t ? `${t.first_name} ${t.last_name}` : "";
  }
  async function teacherHasClashDetailed(
    teacherIds: string[],
    day: string,
    period: number,
    classId: string,
    ignoreId?: string
  ) {
    if (teacherIds.length === 0) return null;

    const { data, error } = await supabase
      .from("timetable_entries")
      .select(`
      id,
      class_id,
      subjects (
        name,
        teacher_id,
        teacher:teacher_id (
          first_name,
          last_name
        )
      )
    `)
      .eq("day_of_week", day)
      .eq("period_number", period);

    if (error || !data) return null;

    for (const row of data) {
      if (ignoreId && row.id === ignoreId) continue;

      // subjects is returned as an array, so take the first element
      const subjectObj = Array.isArray(row.subjects)
        ? row.subjects[0]
        : row.subjects;

      if (!subjectObj) continue;

      const teacherId = subjectObj.teacher_id;

      if (teacherId && teacherIds.includes(teacherId)) {
        const teacherArr = subjectObj.teacher ?? [];
        const teacherObj = teacherArr[0] || {};

        return {
          className: classes.find((c) => c.id === row.class_id)?.name,
          subjectName: subjectObj.name,
          teacherName: `${teacherObj.first_name || ""} ${teacherObj.last_name || ""}`.trim(),
        };
      }
    }

    return null;
  }



  // Submit handler uses controlled form state
  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!formDay || !formPeriod || !formClassId) {
      toast.error("Please select day, period and class");
      return;
    }

    // EDITING MODE
    if (editingEntry) {
      // If switching to departmental mode:
      if (departmentalMode) {
        // 1️⃣ Delete the original single entry
        await supabase
          .from("timetable_entries")
          .delete()
          .eq("id", editingEntry.id);

        // 2️⃣ Build new departmental rows
        const inserts: any[] = [];
        if (formScienceSubjectId)
          inserts.push({
            day_of_week: formDay,
            period_number: Number(formPeriod),
            class_id: formClassId,
            subject_id: formScienceSubjectId,
            department: "Science",
          });

        if (formArtsSubjectId)
          inserts.push({
            day_of_week: formDay,
            period_number: Number(formPeriod),
            class_id: formClassId,
            subject_id: formArtsSubjectId,
            department: "Arts",
          });

        if (formCommercialSubjectId)
          inserts.push({
            day_of_week: formDay,
            period_number: Number(formPeriod),
            class_id: formClassId,
            subject_id: formCommercialSubjectId,
            department: "Commercial",
          });

        if (inserts.length === 0) {
          toast.error("Pick at least one departmental subject");
          return;
        }

        // 3️⃣ Insert the new departmental rows
        const { error } = await supabase
          .from("timetable_entries")
          .insert(inserts);

        if (error) toast.error(error.message || "Failed to update entry");
        else {
          toast.success("Entry updated");
          closeDialog();
          await fetchAll();
          if (formClassId) await showTimetable(formClassId);
        }

        return; // EXIT — do not run the rest
      }

      // Find teacher for chosen subject
      const selectedSubject = subjects.find((s) => s.id === formSubjectId);
      const teacherId = selectedSubject?.teacher_id || null;

      if (teacherId) {
        const clash = await teacherHasClashDetailed(
          [teacherId],
          formDay,
          Number(formPeriod),
          formClassId,
          editingEntry?.id || undefined
        );

        if (clash) {
          toast.error(
            `Clash detected!\n\n` +
            `${clash.teacherName} is already teaching:\n` +
            `• Subject: ${clash.subjectName}\n` +
            `• Class: ${clash.className}\n` +
            `• Period: ${formPeriod} on ${formDay}`
          );
          return;
        }

      }


      // Normal single update (regular → regular)
      const payload: any = {
        day_of_week: formDay,
        period_number: Number(formPeriod),
        class_id: formClassId,
        subject_id: formSubjectId || null,
        department: null,
      };

      const { error } = await supabase
        .from("timetable_entries")
        .update(payload)
        .eq("id", editingEntry.id);

      if (error) toast.error("Failed to update entry");
      else {
        toast.success("Entry updated");
        closeDialog();
        await fetchAll();
        if (formClassId) await showTimetable(formClassId);
      }

      return;
    }


    // CREATE
    if (!departmentalMode) {
      const payload: any = {
        day_of_week: formDay,
        period_number: Number(formPeriod),
        class_id: formClassId,
        subject_id: formSubjectId || null,
        department: null,
      };

      // Find teacher for chosen subject
      const selectedSubject = subjects.find((s) => s.id === formSubjectId);
      const teacherId = selectedSubject?.teacher_id || null;
      if (teacherId) {
        const clash = await teacherHasClashDetailed(
          [teacherId],
          formDay,
          Number(formPeriod),
          formClassId
        );
        if (clash) {
          toast.error(
            `Clash detected!\n\n` +
            `${clash.teacherName} is already teaching:\n` +
            `• Subject: ${clash.subjectName}\n` +
            `• Class: ${clash.className}\n` +
            `• Period: ${formPeriod} on ${formDay}`
          );
          return;
        }
      }

      const { error } = await supabase.from("timetable_entries").insert(payload);
      if (error) toast.error(error.message || "Failed to create entry");
      else {
        toast.success("Entry added");
        closeDialog();
        await fetchAll();
        if (formClassId) await showTimetable(formClassId);
      }

      return;
    }

    // Collect teacher IDs for all selected departmental subjects
    const teacherIds: string[] = [];


    if (formScienceSubjectId) {
      const s = subjects.find((x) => x.id === formScienceSubjectId);
      if (s?.teacher_id) teacherIds.push(s.teacher_id);
    }
    if (formArtsSubjectId) {
      const s = subjects.find((x) => x.id === formArtsSubjectId);
      if (s?.teacher_id) teacherIds.push(s.teacher_id);
    }
    if (formCommercialSubjectId) {
      const s = subjects.find((x) => x.id === formCommercialSubjectId);
      if (s?.teacher_id) teacherIds.push(s.teacher_id);
    }

    // Check clash for any teacher in the set
    if (teacherIds.length > 0) {
      const clash = await teacherHasClashDetailed(
        teacherIds,
        formDay,
        Number(formPeriod),
        formClassId,
        editingEntry?.id || undefined
      );

      if (clash) {
        toast.error(
          `Clash detected!\n\n` +
          `${clash.teacherName} is already teaching:\n` +
          `• Subject: ${clash.subjectName}\n` +
          `• Class: ${clash.className}\n` +
          `• Period: ${formPeriod} on ${formDay}`
        );
        return;
      }

    }

    // Departmental mode — create up to 3 rows with department set
    const inserts: any[] = [];
    if (formScienceSubjectId) inserts.push({ day_of_week: formDay, period_number: Number(formPeriod), class_id: formClassId, subject_id: formScienceSubjectId, department: "Science" });
    if (formArtsSubjectId) inserts.push({ day_of_week: formDay, period_number: Number(formPeriod), class_id: formClassId, subject_id: formArtsSubjectId, department: "Arts" });
    if (formCommercialSubjectId) inserts.push({ day_of_week: formDay, period_number: Number(formPeriod), class_id: formClassId, subject_id: formCommercialSubjectId, department: "Commercial" });

    if (inserts.length === 0) {
      toast.error("Choose at least one department subject to add");
      return;
    }

    const { error } = await supabase.from("timetable_entries").insert(inserts);
    if (error) toast.error(error.message || "Failed to create departmental entries");
    else {
      toast.success("Departmental entries added");
      closeDialog();
      await fetchAll();
      if (formClassId) await showTimetable(formClassId);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Entry deleted");
      await fetchAll();
      if (selectedClass) await showTimetable(selectedClass);
    }
  }

  // groupedEntries to combine departmental rows into single cell display
  const groupedEntries = useMemo(() => {
    const map: Record<string, any> = {};
    entries.forEach((en) => {
      const key = `${en.class_id}||${en.day_of_week}||${en.period_number}`;
      if (!map[key]) {
        map[key] = { id: key, class_id: en.class_id, class_name: en.classes?.name, day_of_week: en.day_of_week, period_number: en.period_number, raw: [] };
      }
      map[key].raw.push(en);
    });

    const order = ["Science", "Arts", "Commercial"];

    const results = Object.values(map).map((g) => {
      const deptMap: Record<string, string> = {};
      const teacherMap: Record<string, string> = {};

      g.raw.forEach((r: any) => {
        const subjName = r.subjects?.name || "";
        const subjDept = r.subjects?.department || r.department || "";
        const code = shortCode(subjName);

        if (subjDept) {
          deptMap[subjDept] = code;
          const subjTeacherName = teacherForSubject(r.subjects);
          if (subjTeacherName) teacherMap[subjDept] = subjTeacherName;
        } else {
          deptMap["_single"] = subjName;
          const subjTeacherName = teacherForSubject(r.subjects);
          if (subjTeacherName) teacherMap["_single"] = subjTeacherName;
        }
      });

      let combined = "";
      if (deptMap["_single"]) combined = deptMap["_single"];
      else combined = order.map((d) => deptMap[d]).filter(Boolean).join(" / ");

      let teachersCombined = "";
      if (teacherMap["_single"]) teachersCombined = teacherMap["_single"]; else teachersCombined = order.map((d) => teacherMap[d]).filter(Boolean).join(" / ");

      return { ...g, subject_display: combined, teacher_display: teachersCombined, rows: g.raw };
    });

    results.sort((a: any, b: any) => {
      if (a.day_of_week === b.day_of_week) return a.period_number - b.period_number;
      return DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week);
    });

    return results;
  }, [entries, teachers]);

  async function showTimetable(classId: string) {
    setSelectedClass(classId);

    const { data } = await supabase
      .from("timetable_entries")
      .select("*, subjects(name, department, teacher_id)")
      .eq("class_id", classId);

    if (!data) return;

    const map: Record<number | string, Record<string, any>> = {};
    TIMETABLE_PERIODS.forEach((p) => { if (!p.break) map[p.id] = { mon: null, tue: null, wed: null, thu: null, fri: null }; });

    const tempGroup: Record<string, any[]> = {};
    data.forEach((entry) => {
      const dow = (entry.day_of_week || "").toString();
      const dayKey = dow.toLowerCase().slice(0, 3);
      const key = `${entry.period_number}||${dayKey}`;
      tempGroup[key] = tempGroup[key] || [];
      tempGroup[key].push(entry);
    });

    Object.entries(tempGroup).forEach(([k, rows]) => {
      const [periodIdStr, dayKey] = k.split("||");
      const periodId = isNaN(Number(periodIdStr)) ? periodIdStr : Number(periodIdStr);
      const order = ["Science", "Arts", "Commercial"];
      const deptMap: Record<string, string> = {};
      const teacherMap: Record<string, string> = {};

      rows.forEach((r: any) => {
        const sname = r.subjects?.name || "";
        const sdept = r.subjects?.department || r.department || "";
        const code = shortCode(sname);
        if (sdept) {
          deptMap[sdept] = code;
          teacherMap[sdept] = teacherForSubject(r.subjects);
        } else {
          deptMap["_single"] = sname;
          teacherMap["_single"] = teacherForSubject(r.subjects);
        }
      });

      let display = "";
      if (deptMap["_single"]) display = deptMap["_single"]; else display = order.map((d) => deptMap[d]).filter(Boolean).join(" / ");

      let teacherDisplay = "";
      if (teacherMap["_single"]) teacherDisplay = teacherMap["_single"]; else teacherDisplay = order.map((d) => teacherMap[d]).filter(Boolean).join(" / ");

      if (!map[periodId]) map[periodId] = {};
      map[periodId][dayKey] = { subject: display, teacher: teacherDisplay, rows };
    });

    setClassTimetable(map);
    setIsTableModalOpen(true);
  }

  const filtered = groupedEntries.filter((g) => `${g.class_name || ""} ${g.subject_display || ""}`.toLowerCase().includes(search.toLowerCase()));

  // helper: determine if selected class (in the add dialog) is SSS so we can enable departmental mode checkbox
  const selectedClassLevel = classes.find((c) => c.id === formClassId)?.level || "";
  const isSelectedClassSSS = selectedClassLevel.startsWith("SSS");


  function handlePrint() {
    const printContents = document.getElementById("timetable-area")?.innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents || "";
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  }

  async function exportPDF() {
    const element = document.getElementById("timetable-area");
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    // ✅ Add class name HERE
    const className =
      classes.find((c) => c.id === selectedClass)?.name || "timetable";

    pdf.save(`${className}-timetable.pdf`);
  }
  function exportExcel() {
    const table = document.querySelector("#timetable-area table");
    const workbook = XLSX.utils.table_to_book(table);

    // ✅ Add class name HERE
    const className =
      classes.find((c) => c.id === selectedClass)?.name || "timetable";

    XLSX.writeFile(workbook, `${className}-timetable.xlsx`);
  }


  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">Timetable</h1>
            <p className="text-gray-600">Manage school timetable entries (departmental periods supported)</p>
          </div>

          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2 items-center">
              <select className="border rounded-md h-10 px-2" value={selectedClass || ""} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">Select a class</option>
                {classes.map((cls) => (<option key={cls.id} value={cls.id}>{cls.name}</option>))}
              </select>

              <Button onClick={() => selectedClass && showTimetable(selectedClass)} disabled={!selectedClass}>View Timetable</Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={openAddDialog}><Plus className="mr-2" />Add Entry</Button>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEntry ? "Edit Entry" : "Add Timetable Entry"}
                    </DialogTitle>
                  </DialogHeader>


                  <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                    <div>
                      <Label>Day of Week</Label>
                      <select value={formDay} onChange={(e) => setFormDay(e.target.value)} className="w-full border rounded-md h-10 px-2" required>
                        <option value="">Select day</option>
                        {DAYS.map((d) => (<option key={d} value={d}>{d}</option>))}
                      </select>
                    </div>

                    <div>
                      <Label>Period</Label>
                      <select value={formPeriod} onChange={(e) => setFormPeriod(Number(e.target.value))} className="w-full border rounded-md h-10 px-2" required>
                        <option value="">Select period</option>
                        {PERIODS.map((p) => (<option key={p} value={p}>Period {p}</option>))}
                      </select>
                    </div>

                    <div>
                      <Label>Class</Label>
                      <select value={formClassId} onChange={(e) => { setFormClassId(e.target.value); /* reset departmental choice when class changes */ setDepartmentalMode(false); }} className="w-full border rounded-md h-10 px-2" required>
                        <option value="">Select class</option>
                        {classes.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <input id="departmental" name="departmental" type="checkbox" className="h-4 w-4" checked={departmentalMode} onChange={(e) => setDepartmentalMode(e.target.checked)} disabled={!isSelectedClassSSS} />
                      <Label htmlFor="departmental">Departmental Period (Science / Arts / Commercial)</Label>
                      {!isSelectedClassSSS && <div className="text-xs text-gray-500 ml-2">(Available only for SSS classes)</div>}
                    </div>

                    {!departmentalMode && (
                      <>
                        <div>
                          <Label>Subjects</Label>
                          <select value={formSubjectId} onChange={(e) => setFormSubjectId(e.target.value)} className="w-full border rounded-md h-10 px-2">
                            <option value="">Select subject</option>
                            {subjectsByDepartment().map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                          </select>
                        </div>
                      </>
                    )}

                    {/* Departmental pickers (visible when departmentalMode true) */}
                    {departmentalMode && (
                      <div className="border p-3 rounded">
                        <div className="mb-2 font-semibold">Departmental Subjects (choose any)</div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label>Science Subject</Label>
                            <select value={formScienceSubjectId} onChange={(e) => setFormScienceSubjectId(e.target.value)} className="w-full border rounded-md h-10 px-2">
                              <option value="">No Science Subject</option>
                              {subjectsByDepartment("Science").map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                            </select>
                          </div>

                          <div>
                            <Label>Arts Subject</Label>
                            <select value={formArtsSubjectId} onChange={(e) => setFormArtsSubjectId(e.target.value)} className="w-full border rounded-md h-10 px-2">
                              <option value="">No Arts Subject</option>
                              {subjectsByDepartment("Arts").map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                            </select>
                          </div>

                          <div>
                            <Label>Commercial Subject</Label>
                            <select value={formCommercialSubjectId} onChange={(e) => setFormCommercialSubjectId(e.target.value)} className="w-full border rounded-md h-10 px-2">
                              <option value="">No Commercial Subject</option>
                              {subjectsByDepartment("Commercial").map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {editingEntry ? (
                        <>
                          <Button className="flex-1" type="button" onClick={() => handleSubmit()}>
                            Update
                          </Button>

                          <Button
                            variant="destructive"
                            type="button"
                            onClick={() => {
                              deleteEntry(editingEntry.id);
                              closeDialog();
                            }}
                          >
                            Delete
                          </Button>

                          <Button variant="outline" type="button" onClick={closeDialog}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button className="flex-1" type="button" onClick={() => handleSubmit()}>
                            Create
                          </Button>
                          <Button variant="outline" type="button" onClick={closeDialog}>
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>

                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by class or subject..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="space-y-4">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardHeader className="pb-2 flex justify-between items-center">
                <CardTitle>{cls.name}</CardTitle>
                <Button onClick={() => showTimetable(cls.id)}>View Timetable</Button>
              </CardHeader>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-gray-500">No timetable entries found</CardContent>
          </Card>
        )}

        <Dialog open={isTableModalOpen} onOpenChange={setIsTableModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Timetable for {classes.find((c) => c.id === selectedClass)?.name}</DialogTitle>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={handlePrint}>
                   <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button className="background-black text-white" onClick={exportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as PDF</Button>
                <Button className="background-black text-white" onClick={exportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as Excel</Button>
              </div>
            </DialogHeader>

            <div id="timetable-area">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1">Period</th>
                    {DAYS_SHORT.map((d, i) => (<th key={d} className="border px-2 py-1">{DAYS[i].slice(0, 3)}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {TIMETABLE_PERIODS.map((period) => period.break ? (
                    <tr key={String(period.id)} className="bg-gray-200 text-center">
                      <td colSpan={6} className="py-1">{period.label} ({period.start}–{period.end})</td>
                    </tr>
                  ) : (
                    <tr key={String(period.id)}>
                      <td className="border px-2 py-1">
                        <div>{period.label}</div>
                        <div className="text-gray-500 text-xs">{period.start}-{period.end}</div>
                      </td>
                      {DAYS_SHORT.map((day, idx) => (
                        <td
                          key={day}
                          className="border px-2 py-1 text-center cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            const cell = classTimetable[period.id]?.[day] || null;

                            if (cell && cell.rows && cell.rows.length > 0) {
                              // If the cell contains multiple rows (departmental), edit the first one or show choose-modal  
                              openEdit(cell.rows[0]);
                            } else {
                              openAdd(DAYS[idx], Number(period.id), selectedClass);
                            }
                          }}

                        >
                          <div>{classTimetable[period.id]?.[day]?.subject ?? ""}</div>
                          <div className="text-xs text-gray-600">{classTimetable[period.id]?.[day]?.teacher ?? ""}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout >
  );
}
