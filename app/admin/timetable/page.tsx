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
  const [subjectClasses, setSubjectClasses] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);

  const [formDay, setFormDay] = useState("");
  const [formPeriod, setFormPeriod] = useState<number | "">("");
  const [formClassId, setFormClassId] = useState<string>("");
  const [departmentalMode, setDepartmentalMode] = useState(false);
  const [formSubjectClassId, setFormSubjectClassId] = useState<string>("");
  const [formScienceSubjectClassId, setFormScienceSubjectClassId] = useState<string>("");
  const [formArtsSubjectClassId, setFormArtsSubjectClassId] = useState<string>("");
  const [formCommercialSubjectClassId, setFormCommercialSubjectClassId] = useState<string>("");

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classTimetable, setClassTimetable] = useState<Record<number | string, Record<string, any>>>({});
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [timetableRes, classRes, subjectClassRes] = await Promise.all([
      supabase
        .from("timetable_entries")
        .select(`
          *,
          classes(name, level),
          subject_classes (
            id,
            subject_code,
            subjects ( name, department ),
            teachers ( first_name, last_name )
          )
        `)
        .order("period_number", { ascending: true }),
      supabase.from("classes").select("*").order("name"),
      supabase.from("subject_classes").select(`
        *,
        subjects ( name, department ),
        teachers ( first_name, last_name ),
        classes ( name, level )
      `).order("subject_code"),
    ]);

    if (timetableRes.data) setEntries(timetableRes.data);
    if (classRes.data) setClasses(classRes.data);
    if (subjectClassRes.data) setSubjectClasses(subjectClassRes.data);
  }

  function openAddDialog() {
    setEditingEntry(null);
    setFormDay("");
    setFormPeriod("");
    setFormClassId("");
    setDepartmentalMode(false);
    setFormSubjectClassId("");
    setFormScienceSubjectClassId("");
    setFormArtsSubjectClassId("");
    setFormCommercialSubjectClassId("");
    setIsDialogOpen(true);
  }

  function openEdit(entryRow: any) {
    if (!entryRow) return;
    setEditingEntry(entryRow);
    setFormDay(entryRow.day_of_week || "");
    setFormPeriod(entryRow.period_number || "");
    setFormClassId(entryRow.class_id || "");
    setDepartmentalMode(false);
    setFormSubjectClassId(entryRow.subject_class_id || "");
    setFormScienceSubjectClassId("");
    setFormArtsSubjectClassId("");
    setFormCommercialSubjectClassId("");
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setEditingEntry(null);
    setIsDialogOpen(false);
  }

  function openAdd(day: string, period: number, selectedClass: string | null) {
    setEditingEntry(null);
    setFormDay(day);
    setFormPeriod(period);
    if (selectedClass) {
      setFormClassId(selectedClass);
    } else {
      setFormClassId("");
    }
    setDepartmentalMode(false);
    setFormSubjectClassId("");
    setFormScienceSubjectClassId("");
    setFormArtsSubjectClassId("");
    setFormCommercialSubjectClassId("");
    setIsDialogOpen(true);
  }

  function subjectClassesByDepartment(dept?: string) {
    return subjectClasses.filter((sc) => {
      if (sc.class_id !== formClassId) return false;
      if (!dept) return !sc.subjects?.department;
      return sc.subjects?.department === dept;
    });
  }

  function shortCode(name: string | undefined | null) {
    if (!name) return "";
    const cleaned = name.trim();
    if (cleaned.length <= 3) return cleaned.toUpperCase();
    return cleaned.slice(0, 3).toUpperCase();
  }

  function teacherForSubjectClass(subjectClass: any) {
    if (!subjectClass?.teachers) return "";
    const t = subjectClass.teachers;
    return t ? `${t.first_name} ${t.last_name}` : "";
  }

  function formatSubjectClassDisplay(sc: any) {
    const subjectName = sc.subjects?.name || "";
    const className = sc.classes?.name || "";
    const teacherName = teacherForSubjectClass(sc);
    return `${subjectName} (${className}) — ${teacherName}`;
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
        subject_classes (
          id,
          teacher_id,
          subjects ( name ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("day_of_week", day)
      .eq("period_number", period);

    if (error || !data) return null;

    for (const row of data) {
      if (ignoreId && row.id === ignoreId) continue;

      const subjectClassObj = Array.isArray(row.subject_classes)
        ? row.subject_classes[0]
        : row.subject_classes;

      if (!subjectClassObj) continue;

      const teacherId = subjectClassObj.teacher_id;

      if (teacherId && teacherIds.includes(teacherId)) {
        const teacher = Array.isArray(subjectClassObj.teachers)
          ? subjectClassObj.teachers[0]
          : subjectClassObj.teachers;
        const subject = Array.isArray(subjectClassObj.subjects)
          ? subjectClassObj.subjects[0]
          : subjectClassObj.subjects;

        return {
          className: classes.find((c) => c.id === row.class_id)?.name,
          subjectName: subject?.name,
          teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : "",
        };
      }
    }

    return null;
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!formDay || !formPeriod || !formClassId) {
      toast.error("Please select day, period and class");
      return;
    }

    if (editingEntry) {
      if (departmentalMode) {
        await supabase.from("timetable_entries").delete().eq("id", editingEntry.id);

        const inserts: any[] = [];
        if (formScienceSubjectClassId)
          inserts.push({
            day_of_week: formDay,
            period_number: Number(formPeriod),
            class_id: formClassId,
            subject_class_id: formScienceSubjectClassId,
            department: "Science",
          });

        if (formArtsSubjectClassId)
          inserts.push({
            day_of_week: formDay,
            period_number: Number(formPeriod),
            class_id: formClassId,
            subject_class_id: formArtsSubjectClassId,
            department: "Arts",
          });

        if (formCommercialSubjectClassId)
          inserts.push({
            day_of_week: formDay,
            period_number: Number(formPeriod),
            class_id: formClassId,
            subject_class_id: formCommercialSubjectClassId,
            department: "Commercial",
          });

        if (inserts.length === 0) {
          toast.error("Pick at least one departmental subject");
          return;
        }

        const { error } = await supabase.from("timetable_entries").insert(inserts);

        if (error) toast.error(error.message || "Failed to update entry");
        else {
          toast.success("Entry updated");
          closeDialog();
          await fetchAll();
          if (formClassId) await showTimetable(formClassId);
        }

        return;
      }

      const selectedSubjectClass = subjectClasses.find((sc) => sc.id === formSubjectClassId);
      const teacherId = selectedSubjectClass?.teacher_id || null;

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

      const payload: any = {
        day_of_week: formDay,
        period_number: Number(formPeriod),
        class_id: formClassId,
        subject_class_id: formSubjectClassId || null,
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

    if (!departmentalMode) {
      const payload: any = {
        day_of_week: formDay,
        period_number: Number(formPeriod),
        class_id: formClassId,
        subject_class_id: formSubjectClassId || null,
        department: null,
      };

      const selectedSubjectClass = subjectClasses.find((sc) => sc.id === formSubjectClassId);
      const teacherId = selectedSubjectClass?.teacher_id || null;
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

    const teacherIds: string[] = [];

    if (formScienceSubjectClassId) {
      const sc = subjectClasses.find((x) => x.id === formScienceSubjectClassId);
      if (sc?.teacher_id) teacherIds.push(sc.teacher_id);
    }
    if (formArtsSubjectClassId) {
      const sc = subjectClasses.find((x) => x.id === formArtsSubjectClassId);
      if (sc?.teacher_id) teacherIds.push(sc.teacher_id);
    }
    if (formCommercialSubjectClassId) {
      const sc = subjectClasses.find((x) => x.id === formCommercialSubjectClassId);
      if (sc?.teacher_id) teacherIds.push(sc.teacher_id);
    }

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

    const inserts: any[] = [];
    if (formScienceSubjectClassId)
      inserts.push({
        day_of_week: formDay,
        period_number: Number(formPeriod),
        class_id: formClassId,
        subject_class_id: formScienceSubjectClassId,
        department: "Science",
      });
    if (formArtsSubjectClassId)
      inserts.push({
        day_of_week: formDay,
        period_number: Number(formPeriod),
        class_id: formClassId,
        subject_class_id: formArtsSubjectClassId,
        department: "Arts",
      });
    if (formCommercialSubjectClassId)
      inserts.push({
        day_of_week: formDay,
        period_number: Number(formPeriod),
        class_id: formClassId,
        subject_class_id: formCommercialSubjectClassId,
        department: "Commercial",
      });

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

  const groupedEntries = useMemo(() => {
    const map: Record<string, any> = {};
    entries.forEach((en) => {
      const key = `${en.class_id}||${en.day_of_week}||${en.period_number}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          class_id: en.class_id,
          class_name: en.classes?.name,
          day_of_week: en.day_of_week,
          period_number: en.period_number,
          raw: [],
        };
      }
      map[key].raw.push(en);
    });

    const order = ["Science", "Arts", "Commercial"];

    const results = Object.values(map).map((g) => {
      const deptMap: Record<string, string> = {};
      const teacherMap: Record<string, string> = {};

      g.raw.forEach((r: any) => {
        const subjName = r.subject_classes?.subjects?.name || "";
        const subjDept = r.subject_classes?.subjects?.department || r.department || "";
        const code = shortCode(subjName);

        if (subjDept) {
          deptMap[subjDept] = code;
          const subjTeacherName = teacherForSubjectClass(r.subject_classes);
          if (subjTeacherName) teacherMap[subjDept] = subjTeacherName;
        } else {
          deptMap["_single"] = subjName;
          const subjTeacherName = teacherForSubjectClass(r.subject_classes);
          if (subjTeacherName) teacherMap["_single"] = subjTeacherName;
        }
      });

      let combined = "";
      if (deptMap["_single"]) combined = deptMap["_single"];
      else combined = order.map((d) => deptMap[d]).filter(Boolean).join(" / ");

      let teachersCombined = "";
      if (teacherMap["_single"]) teachersCombined = teacherMap["_single"];
      else teachersCombined = order.map((d) => teacherMap[d]).filter(Boolean).join(" / ");

      return {
        ...g,
        subject_display: combined,
        teacher_display: teachersCombined,
        rows: g.raw,
      };
    });

    results.sort((a: any, b: any) => {
      if (a.day_of_week === b.day_of_week) return a.period_number - b.period_number;
      return DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week);
    });

    return results;
  }, [entries]);

  async function showTimetable(classId: string) {
    setSelectedClass(classId);

    const { data } = await supabase
      .from("timetable_entries")
      .select(`
        *,
        subject_classes (
          id,
          subject_code,
          subjects ( name, department ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("class_id", classId);

    if (!data) return;

    const map: Record<number | string, Record<string, any>> = {};
    TIMETABLE_PERIODS.forEach((p) => {
      if (!p.break) map[p.id] = { mon: null, tue: null, wed: null, thu: null, fri: null };
    });

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
        const sname = r.subject_classes?.subjects?.name || "";
        const sdept = r.subject_classes?.subjects?.department || r.department || "";
        const code = shortCode(sname);
        if (sdept) {
          deptMap[sdept] = code;
          teacherMap[sdept] = teacherForSubjectClass(r.subject_classes);
        } else {
          deptMap["_single"] = sname;
          teacherMap["_single"] = teacherForSubjectClass(r.subject_classes);
        }
      });

      let display = "";
      if (deptMap["_single"]) display = deptMap["_single"];
      else display = order.map((d) => deptMap[d]).filter(Boolean).join(" / ");

      let teacherDisplay = "";
      if (teacherMap["_single"]) teacherDisplay = teacherMap["_single"];
      else teacherDisplay = order.map((d) => teacherMap[d]).filter(Boolean).join(" / ");

      if (!map[periodId]) map[periodId] = {};
      map[periodId][dayKey] = { subject: display, teacher: teacherDisplay, rows };
    });

    setClassTimetable(map);
    setIsTableModalOpen(true);
  }

  const filtered = groupedEntries.filter((g) =>
    `${g.class_name || ""} ${g.subject_display || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const selectedClassLevel = classes.find((c) => c.id === formClassId)?.level || "";
  const isSelectedClassSSS = selectedClassLevel.startsWith("SSS");

  function handlePrint() {
    window.print();
  }

  function applyExportStyles() {
    document.body.classList.add("export-mode");
  }

  function removeExportStyles() {
    document.body.classList.remove("export-mode");
  }

  async function handleExportPDF() {
    const element = document.getElementById("timetable-area");
    if (!element) {
      toast.error("Timetable not found");
      return;
    }

    try {
      applyExportStyles();
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      removeExportStyles();

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 280;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

      const className = classes.find((c) => c.id === selectedClass)?.name || "Timetable";
      pdf.save(`${className}_timetable.pdf`);

      toast.success("PDF exported successfully");
    } catch (error) {
      removeExportStyles();
      toast.error("Failed to export PDF");
      console.error(error);
    }
  }

  async function handleExportExcel() {
    if (!selectedClass) {
      toast.error("No class selected");
      return;
    }

    try {
      const className = classes.find((c) => c.id === selectedClass)?.name || "Class";
      const ws_data: any[][] = [];

      ws_data.push([`${className} - Weekly Timetable`]);
      ws_data.push([]);

      const headerRow = ["Time", ...DAYS];
      ws_data.push(headerRow);

      TIMETABLE_PERIODS.forEach((period) => {
        if (period.break) {
          ws_data.push([
            `${period.start} - ${period.end}`,
            "BREAK",
            "BREAK",
            "BREAK",
            "BREAK",
            "BREAK",
          ]);
        } else {
          const row = [`${period.start} - ${period.end}`];
          DAYS_SHORT.forEach((day) => {
            const cell = classTimetable[period.id]?.[day];
            if (cell) {
              row.push(`${cell.subject}\n${cell.teacher}`);
            } else {
              row.push("");
            }
          });
          ws_data.push(row);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(ws_data);

      ws["!cols"] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Timetable");

      XLSX.writeFile(wb, `${className}_timetable.xlsx`);
      toast.success("Excel file exported successfully");
    } catch (error) {
      toast.error("Failed to export Excel file");
      console.error(error);
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Timetable Management</h1>
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by class or subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Class</th>
                    <th className="text-left p-2">Day</th>
                    <th className="text-left p-2">Period</th>
                    <th className="text-left p-2">Subject(s)</th>
                    <th className="text-left p-2">Teacher(s)</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{entry.class_name}</td>
                      <td className="p-2">{entry.day_of_week}</td>
                      <td className="p-2">{entry.period_number}</td>
                      <td className="p-2">{entry.subject_display}</td>
                      <td className="p-2 text-sm text-gray-600">{entry.teacher_display}</td>
                      <td className="p-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(entry.rows[0])}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteEntry(entry.rows[0].id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View Class Timetables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {classes.map((cls) => (
                <Button
                  key={cls.id}
                  variant="outline"
                  onClick={() => showTimetable(cls.id)}
                  className="h-auto py-4"
                >
                  {cls.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "Add Entry"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Day</Label>
                <select
                  className="w-full border rounded p-2"
                  value={formDay}
                  onChange={(e) => setFormDay(e.target.value)}
                >
                  <option value="">Select Day</option>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Period</Label>
                <select
                  className="w-full border rounded p-2"
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(Number(e.target.value))}
                >
                  <option value="">Select Period</option>
                  {PERIODS.map((p) => (
                    <option key={p} value={p}>
                      Period {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <Label>Class</Label>
                <select
                  className="w-full border rounded p-2"
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {isSelectedClassSSS && (
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={departmentalMode}
                    onChange={(e) => setDepartmentalMode(e.target.checked)}
                  />
                  <Label>Departmental Mode (SSS)</Label>
                </div>
              )}

              {!departmentalMode && (
                <div className="col-span-2">
                  <Label>Subject</Label>
                  <select
                    className="w-full border rounded p-2"
                    value={formSubjectClassId}
                    onChange={(e) => setFormSubjectClassId(e.target.value)}
                  >
                    <option value="">Select Subject</option>
                    {subjectClasses
                      .filter((sc) => sc.class_id === formClassId)
                      .map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {formatSubjectClassDisplay(sc)}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {departmentalMode && (
                <>
                  <div className="col-span-2">
                    <Label>Science Subject</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={formScienceSubjectClassId}
                      onChange={(e) => setFormScienceSubjectClassId(e.target.value)}
                    >
                      <option value="">None</option>
                      {subjectClassesByDepartment("Science").map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {formatSubjectClassDisplay(sc)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <Label>Arts Subject</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={formArtsSubjectClassId}
                      onChange={(e) => setFormArtsSubjectClassId(e.target.value)}
                    >
                      <option value="">None</option>
                      {subjectClassesByDepartment("Arts").map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {formatSubjectClassDisplay(sc)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <Label>Commercial Subject</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={formCommercialSubjectClassId}
                      onChange={(e) => setFormCommercialSubjectClassId(e.target.value)}
                    >
                      <option value="">None</option>
                      {subjectClassesByDepartment("Commercial").map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {formatSubjectClassDisplay(sc)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEntry ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Timetable Modal */}
      <Dialog open={isTableModalOpen} onOpenChange={setIsTableModalOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Class Timetable</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-2" /> Export PDF
            </Button>
            <Button onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" /> Export Excel
            </Button>
          </div>

          <div id="timetable-area" className="overflow-auto">
            <table className="w-full border">
              <thead>
                <tr>
                  <th className="border p-2">Time</th>
                  {DAYS.map((d) => (
                    <th key={d} className="border p-2">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIMETABLE_PERIODS.map((period) => (
                  <tr key={period.id}>
                    <td className="border p-2 font-medium">
                      {period.start} - {period.end}
                    </td>

                    {period.break ? (
                      <td colSpan={5} className="border p-2 text-center font-bold bg-gray-100">
                        BREAK
                      </td>
                    ) : (
                      DAYS_SHORT.map((day) => {
                        const cell = classTimetable[period.id]?.[day];
                        return (
                          <td
                            key={day}
                            className="border p-2 text-sm text-center cursor-pointer hover:bg-blue-50"
                            onClick={() => {
                              if (!selectedClass) return;

                              const cell = classTimetable[period.id]?.[day];

                              if (cell?.rows?.length > 0) {
                                openEdit(cell.rows[0]);
                              } else {
                                const dayFull =
                                  day === "mon" ? "Monday" :
                                    day === "tue" ? "Tuesday" :
                                      day === "wed" ? "Wednesday" :
                                        day === "thu" ? "Thursday" :
                                          "Friday";

                                openAdd(dayFull, Number(period.id), selectedClass);
                              }
                            }}
                          >
                            {cell ? (
                              <>
                                <div className="font-semibold">{cell.subject}</div>
                                <div className="text-xs text-gray-600">{cell.teacher}</div>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">+ Add</span>
                            )}
                          </td>

                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

