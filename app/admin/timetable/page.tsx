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
import { AutoTimetableWizard } from "@/components/auto-timetable-wizard";
import { Sparkles } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_SHORT = ["mon", "tue", "wed", "thu", "fri"];

export default function TimetablePage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjectClasses, setSubjectClasses] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [periodSlots, setPeriodSlots] = useState<any[]>([]);
  const [isAutoGenerateOpen, setIsAutoGenerateOpen] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);

  const [formDay, setFormDay] = useState("");
  const [formPeriodSlotId, setFormPeriodSlotId] = useState<string>("");
  const [formClassId, setFormClassId] = useState<string>("");
  const [departmentalMode, setDepartmentalMode] = useState(false);
  const [religionMode, setReligionMode] = useState(false);
  const [formSubjectClassId, setFormSubjectClassId] = useState<string>("");
  const [formScienceSubjectClassId, setFormScienceSubjectClassId] = useState<string>("");
  const [formArtsSubjectClassId, setFormArtsSubjectClassId] = useState<string>("");
  const [formCommercialSubjectClassId, setFormCommercialSubjectClassId] = useState<string>("");
  const [formChristianSubjectClassId, setFormChristianSubjectClassId] = useState<string>("");
  const [formMuslimSubjectClassId, setFormMuslimSubjectClassId] = useState<string>("");

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classTimetable, setClassTimetable] = useState<any>({});
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingPeriodSlot, setEditingPeriodSlot] = useState<any | null>(null);
  const [periodStartTime, setPeriodStartTime] = useState("");
  const [periodEndTime, setPeriodEndTime] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function updatePeriodSlot(id: number, start: string, end: string) {
    const { error } = await supabase
      .from("period_slots")
      .update({ start_time: start, end_time: end })
      .eq("id", id);

    if (error) toast.error("Failed to update period slot");
    else {
      toast.success("Period time updated");
      await fetchAll();
      if (selectedClass) await showTimetable(selectedClass);
    }
  }

  async function fetchAll() {
    const [timetableRes, classRes, subjectClassRes] = await Promise.all([
      supabase
        .from("timetable_entries")
        .select(`
          *,
          classes(name, level),
          period_slots(id, day_of_week, period_number, start_time, end_time, is_break),
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

    const { data: periodSlots } = await supabase
      .from("period_slots")
      .select("*")
      .order("day_of_week, period_number");

    if (periodSlots) setPeriodSlots(periodSlots);
    if (timetableRes.data) setEntries(timetableRes.data);
    if (classRes.data) setClasses(classRes.data);
    if (subjectClassRes.data) setSubjectClasses(subjectClassRes.data);
  }

  // Group period slots by day
  const periodsByDay = useMemo(() => {
    const dayMap: Record<string, any[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    };

    periodSlots.forEach((slot) => {
      const dayName = slot.day_of_week;
      if (dayMap[dayName]) {
        dayMap[dayName].push(slot);
      }
    });

    // Sort each day's periods
    Object.keys(dayMap).forEach((day) => {
      dayMap[day].sort((a, b) => a.period_number - b.period_number);
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

  function openEditPeriodTime(periodSlot: any) {
    setEditingPeriodSlot(periodSlot);
    setPeriodStartTime(periodSlot.start_time || "");
    setPeriodEndTime(periodSlot.end_time || "");
  }

  function openAddDialog() {
    setEditingEntry(null);
    setFormDay("");
    setFormPeriodSlotId("");
    setFormClassId("");
    setDepartmentalMode(false);
    setReligionMode(false);
    setFormSubjectClassId("");
    setFormScienceSubjectClassId("");
    setFormArtsSubjectClassId("");
    setFormCommercialSubjectClassId("");
    setFormChristianSubjectClassId("");
    setFormMuslimSubjectClassId("");
    setIsDialogOpen(true);
  }

  function openEdit(entryRow: any) {
    if (!entryRow) return;
    setEditingEntry(entryRow);
    setFormDay(entryRow.period_slots?.day_of_week || "");
    setFormPeriodSlotId(entryRow.period_slot_id || "");
    setFormClassId(entryRow.class_id || "");

    // Reset departmental mode and religion mode and fields
    setDepartmentalMode(false);
    setReligionMode(false);
    setFormSubjectClassId("");
    setFormScienceSubjectClassId("");
    setFormArtsSubjectClassId("");
    setFormCommercialSubjectClassId("");
    setFormChristianSubjectClassId("");
    setFormMuslimSubjectClassId("");


    // Check if the entry is departmental
    if (entryRow.department) {
      setDepartmentalMode(true);

      // Append departmental subjects accurately
      if (entryRow.department === "Science") {
        setFormScienceSubjectClassId(entryRow.subject_class_id || "");
      } else if (entryRow.department === "Arts") {
        setFormArtsSubjectClassId(entryRow.subject_class_id || "");
      } else if (entryRow.department === "Commercial") {
        setFormCommercialSubjectClassId(entryRow.subject_class_id || "");
      }
    } else if (entryRow.religion) {
      // Check if the entry is religious
      setReligionMode(true);

      // Append religious subjects accurately
      if (entryRow.religion === "Christian") {
        setFormChristianSubjectClassId(entryRow.subject_class_id || "");
      } else if (entryRow.religion === "Muslim") {
        setFormMuslimSubjectClassId(entryRow.subject_class_id || "");
      }
    } else {
      setFormSubjectClassId(entryRow.subject_class_id || "");
    }


    setIsDialogOpen(true);
  }

  function closeDialog() {
    setEditingEntry(null);
    setIsDialogOpen(false);
  }

  function openAdd(day: string, periodSlotId: string, selectedClass: string | null) {
    setEditingEntry(null);
    setFormDay(day);
    setFormPeriodSlotId(periodSlotId);
    if (selectedClass) {
      setFormClassId(selectedClass);
    } else {
      setFormClassId("");
    }
    setDepartmentalMode(false);
    setReligionMode(false);
    setFormSubjectClassId("");
    setFormScienceSubjectClassId("");
    setFormArtsSubjectClassId("");
    setFormCommercialSubjectClassId("");
    setFormChristianSubjectClassId("");
    setFormMuslimSubjectClassId("");
    setIsDialogOpen(true);
  }

  function subjectClassesByDepartment(dept?: string) {
    return subjectClasses
      .filter((sc) => {
        if (sc.class_id !== formClassId) return false;
        if (!dept) return !sc.subjects?.department && !sc.subjects?.religion;
        return sc.subjects?.department === dept;
      })
      .sort((a, b) => {
        const nameA = a.subjects?.name?.toLowerCase() || "";
        const nameB = b.subjects?.name?.toLowerCase() || "";
        return nameA.localeCompare(nameB);
      });
  }

  function subjectClassesByReligion(religion?: string) {
    return subjectClasses
      .filter((sc) => {
        if (sc.class_id !== formClassId) return false;
        if (!religion) return !sc.subjects?.religion && !sc.subjects?.department;
        return sc.subjects?.religion === religion;
      })
      .sort((a, b) => {
        const nameA = a.subjects?.name?.toLowerCase() || "";
        const nameB = b.subjects?.name?.toLowerCase() || "";
        return nameA.localeCompare(nameB);
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
    periodSlotId: string,
    classId: string,
    ignoreId?: string
  ) {
    if (teacherIds.length === 0) return null;

    // Get the period slot info
    const targetSlot = periodSlots.find(s => s.id === periodSlotId);
    if (!targetSlot) return null;

    const { data, error } = await supabase
      .from("timetable_entries")
      .select(`
        id,
        class_id,
        period_slot_id,
        period_slots (
          day_of_week,
          period_number,
          start_time,
          end_time,
          is_break
        ),
        subject_classes (
          id,
          teacher_id,
          subjects ( name ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("period_slot_id", periodSlotId);

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

        const periodSlot = Array.isArray(row.period_slots)
          ? row.period_slots[0]
          : row.period_slots;

        return {
          className: classes.find((c) => c.id === row.class_id)?.name,
          subjectName: subject?.name,
          teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : "",
          dayOfWeek: periodSlot?.day_of_week,
          periodNumber: periodSlot?.period_number,
        };
      }
    }

    return null;
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!formDay || !formPeriodSlotId || !formClassId) {
      toast.error("Please select day, period and class");
      return;
    }

    if (editingEntry) {
      if (departmentalMode) {
        await supabase.from("timetable_entries").delete().eq("id", editingEntry.id);

        const inserts: any[] = [];
        if (formScienceSubjectClassId)
          inserts.push({
            period_slot_id: formPeriodSlotId,
            class_id: formClassId,
            subject_class_id: formScienceSubjectClassId,
            department: "Science",
          });

        if (formArtsSubjectClassId)
          inserts.push({
            period_slot_id: formPeriodSlotId,
            class_id: formClassId,
            subject_class_id: formArtsSubjectClassId,
            department: "Arts",
          });

        if (formCommercialSubjectClassId)
          inserts.push({
            period_slot_id: formPeriodSlotId,
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

      if (religionMode) {
        const teacherIds: string[] = [];

        if (formChristianSubjectClassId) {
          const sc = subjectClasses.find((x) => x.id === formChristianSubjectClassId);
          if (sc?.teacher_id) teacherIds.push(sc.teacher_id);
        }
        if (formMuslimSubjectClassId) {
          const sc = subjectClasses.find((x) => x.id === formMuslimSubjectClassId);
          if (sc?.teacher_id) teacherIds.push(sc.teacher_id);
        }

        if (teacherIds.length > 0) {
          const clash = await teacherHasClashDetailed(
            teacherIds,
            formPeriodSlotId,
            formClassId,
            editingEntry.id
          );

          if (clash) {
            toast.error(
              `Clash detected!\n\n` +
              `${clash.teacherName} is already teaching:\n` +
              `• Subject: ${clash.subjectName}\n` +
              `• Class: ${clash.className}\n` +
              `• Period: ${clash.periodNumber} on ${clash.dayOfWeek}`
            );
            return;
          }
        }

        await supabase
          .from("timetable_entries")
          .delete()
          .eq("period_slot_id", editingEntry.period_slot_id)
          .eq("class_id", editingEntry.class_id)
          .not("religion", "is", null);

        const inserts: any[] = [];
        if (formChristianSubjectClassId)
          inserts.push({
            period_slot_id: formPeriodSlotId,
            class_id: formClassId,
            subject_class_id: formChristianSubjectClassId,
            religion: "Christian",
          });
        if (formMuslimSubjectClassId)
          inserts.push({
            period_slot_id: formPeriodSlotId,
            class_id: formClassId,
            subject_class_id: formMuslimSubjectClassId,
            religion: "Muslim",
          });

        if (inserts.length === 0) {
          toast.error("Choose at least one religious subject to update");
          return;
        }

        const { error } = await supabase.from("timetable_entries").insert(inserts);
        if (error) toast.error(error.message || "Failed to update religious entries");
        else {
          toast.success("Religious entries updated");
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
          formPeriodSlotId,
          formClassId,
          editingEntry?.id || undefined
        );

        if (clash) {
          toast.error(
            `Clash detected!\n\n` +
            `${clash.teacherName} is already teaching:\n` +
            `• Subject: ${clash.subjectName}\n` +
            `• Class: ${clash.className}\n` +
            `• Period: ${clash.periodNumber} on ${clash.dayOfWeek}`
          );
          return;
        }
      }

      const payload: any = {
        period_slot_id: formPeriodSlotId,
        class_id: formClassId,
        subject_class_id: formSubjectClassId || null,
        department: null,
        religion: null,
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

    if (!departmentalMode && !religionMode) {
      const payload: any = {
        period_slot_id: formPeriodSlotId,
        class_id: formClassId,
        subject_class_id: formSubjectClassId || null,
        department: null,
        religion: null,
      };

      const selectedSubjectClass = subjectClasses.find((sc) => sc.id === formSubjectClassId);
      const teacherId = selectedSubjectClass?.teacher_id || null;
      if (teacherId) {
        const clash = await teacherHasClashDetailed(
          [teacherId],
          formPeriodSlotId,
          formClassId
        );
        if (clash) {
          toast.error(
            `Clash detected!\n\n` +
            `${clash.teacherName} is already teaching:\n` +
            `• Subject: ${clash.subjectName}\n` +
            `• Class: ${clash.className}\n` +
            `• Period: ${clash.periodNumber} on ${clash.dayOfWeek}`
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

    if (religionMode) {
      const teacherIds: string[] = [];

      if (formChristianSubjectClassId) {
        const sc = subjectClasses.find((x) => x.id === formChristianSubjectClassId);
        if (sc?.teacher_id) teacherIds.push(sc.teacher_id);
      }
      if (formMuslimSubjectClassId) {
        const sc = subjectClasses.find((x) => x.id === formMuslimSubjectClassId);
        if (sc?.teacher_id) teacherIds.push(sc.teacher_id);
      }

      if (teacherIds.length > 0) {
        const clash = await teacherHasClashDetailed(
          teacherIds,
          formPeriodSlotId,
          formClassId,
          editingEntry?.id || undefined
        );

        if (clash) {
          toast.error(
            `Clash detected!\n\n` +
            `${clash.teacherName} is already teaching:\n` +
            `• Subject: ${clash.subjectName}\n` +
            `• Class: ${clash.className}\n` +
            `• Period: ${clash.periodNumber} on ${clash.dayOfWeek}`
          );
          return;
        }
      }

      const inserts: any[] = [];
      if (formChristianSubjectClassId)
        inserts.push({
          period_slot_id: formPeriodSlotId,
          class_id: formClassId,
          subject_class_id: formChristianSubjectClassId,
          religion: "Christian",
        });
      if (formMuslimSubjectClassId)
        inserts.push({
          period_slot_id: formPeriodSlotId,
          class_id: formClassId,
          subject_class_id: formMuslimSubjectClassId,
          religion: "Muslim",
        });

      if (inserts.length === 0) {
        toast.error("Choose at least one religious subject to add");
        return;
      }

      const { error } = await supabase.from("timetable_entries").insert(inserts);
      if (error) toast.error(error.message || "Failed to create religious entries");
      else {
        toast.success("Religious entries added");
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
        formPeriodSlotId,
        formClassId,
        editingEntry?.id || undefined
      );

      if (clash) {
        toast.error(
          `Clash detected!\n\n` +
          `${clash.teacherName} is already teaching:\n` +
          `• Subject: ${clash.subjectName}\n` +
          `• Class: ${clash.className}\n` +
          `• Period: ${clash.periodNumber} on ${clash.dayOfWeek}`
        );
        return;
      }
    }

    const inserts: any[] = [];
    if (formScienceSubjectClassId)
      inserts.push({
        period_slot_id: formPeriodSlotId,
        class_id: formClassId,
        subject_class_id: formScienceSubjectClassId,
        department: "Science",
      });
    if (formArtsSubjectClassId)
      inserts.push({
        period_slot_id: formPeriodSlotId,
        class_id: formClassId,
        subject_class_id: formArtsSubjectClassId,
        department: "Arts",
      });
    if (formCommercialSubjectClassId)
      inserts.push({
        period_slot_id: formPeriodSlotId,
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

  async function handleDeleteAllSubjects() {
    if (!editingEntry) return;

    if (!confirm("Are you sure you want to delete all subjects in this slot?")) return;

    const { error } = await supabase
      .from("timetable_entries")
      .delete()
      .eq("period_slot_id", editingEntry.period_slot_id)
      .eq("class_id", editingEntry.class_id);

    if (error) {
      toast.error("Failed to delete all subjects in the slot");
    } else {
      toast.success("All subjects in the slot deleted successfully");
      closeDialog();
      await fetchAll();
      if (formClassId) await showTimetable(formClassId);
    }
  }

  const groupedEntries = useMemo(() => {
    const map: Record<string, any> = {};
    entries.forEach((en) => {
      const key = `${en.class_id}||${en.period_slot_id}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          class_id: en.class_id,
          class_name: en.classes?.name,
          day_of_week: en.period_slots?.day_of_week,
          period_number: en.period_slots?.period_number,
          period_slot_id: en.period_slot_id,
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
        period_slots(id, day_of_week, period_number, start_time, end_time, is_break),
        subject_classes (
          id,
          subject_code,
          subjects ( name, department ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("class_id", classId);

    if (!data) return;

    // Build timetable structure: timetable[day][periodSlotId] = { subject, teacher, rows }
    const timetable: any = {};

    DAYS.forEach(day => {
      timetable[day] = {};
    });

    const tempGroup: Record<string, any[]> = {};
    data.forEach((entry) => {
      const periodSlot = Array.isArray(entry.period_slots)
        ? entry.period_slots[0]
        : entry.period_slots;

      if (!periodSlot) return;

      const key = `${periodSlot.day_of_week}||${entry.period_slot_id}`;
      tempGroup[key] = tempGroup[key] || [];
      tempGroup[key].push(entry);
    });

    Object.entries(tempGroup).forEach(([k, rows]) => {
      const [day, periodSlotId] = k.split("||");
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

      if (!timetable[day]) timetable[day] = {};
      timetable[day][periodSlotId] = { subject: display, teacher: teacherDisplay, rows };
    });

    setClassTimetable(timetable);
    setIsTableModalOpen(true);
  }

  const filtered = groupedEntries.filter((g) =>
    `${g.class_name || ""} ${g.subject_display || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const selectedClassLevel = classes.find((c) => c.id === formClassId)?.level || "";
  const isSelectedClassSSS = selectedClassLevel.startsWith("SSS");

  // Get available periods for the selected day
  const availablePeriodsForDay = useMemo(() => {
    if (!formDay) return [];
    return periodsByDay[formDay] || [];
  }, [formDay, periodsByDay]);

  const displayPeriodRows = useMemo(() => {
    // Build rows based on maximum actual rows (including breaks)
    const rows: {
      index: number;          // visual row index
      label: string;          // "1", "2", "BREAK", etc
      isBreakRow: boolean;
    }[] = [];

    let periodCounter = 0;

    for (let rowIndex = 0; rowIndex < maxPeriods; rowIndex++) {
      // Check if ANY day has a break at this row index
      const isBreakRow = DAYS.some((day) => {
        const dayPeriods = periodsByDay[day] || [];
        const p = dayPeriods[rowIndex];
        return p?.is_break;
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
          label: String(periodCounter),
          isBreakRow: false,
        });
      }
    }

    return rows;
  }, [maxPeriods, periodsByDay]);



  function applyExportStyles() {
    document.body.classList.add("export-mode");
  }

  function removeExportStyles() {
    document.body.classList.remove("export-mode");
  }

  async function handleExportPDF() {
    const wrapper = document.getElementById("timetable-scroll-wrapper");
    const element = document.getElementById("timetable-area");

    if (!wrapper || !element) {
      toast.error("Timetable not found");
      return;
    }

    try {
      toast.info("Generating PDF...");

      // Save original styles
      const originalHeight = wrapper.style.height;
      const originalOverflow = wrapper.style.overflow;

      wrapper.style.height = "auto";
      wrapper.style.overflow = "visible";

      applyExportStyles();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const fullCanvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      // Restore styles
      wrapper.style.height = originalHeight;
      wrapper.style.overflow = originalOverflow;

      removeExportStyles();

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = 297;
      const pdfHeight = 210;
      const margin = 10;
      const availableWidth = pdfWidth - margin * 2;
      const availableHeight = pdfHeight - margin * 2;

      const imgData = fullCanvas.toDataURL("image/png");

      // Calculate dimensions to fit the entire timetable on one page
      const canvasRatio = fullCanvas.width / fullCanvas.height;
      const availableRatio = availableWidth / availableHeight;

      let renderWidth, renderHeight;

      if (canvasRatio > availableRatio) {
        // Canvas is wider - fit to width
        renderWidth = availableWidth;
        renderHeight = availableWidth / canvasRatio;
      } else {
        // Canvas is taller - fit to height
        renderHeight = availableHeight;
        renderWidth = availableHeight * canvasRatio;
      }

      const x = margin + (availableWidth - renderWidth) / 2;
      const y = margin + (availableHeight - renderHeight) / 2;

      pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);

      const className =
        classes.find((c) => c.id === selectedClass)?.name || "Timetable";

      pdf.save(`${className}_timetable.pdf`);

      toast.success("PDF exported successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export PDF");
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Timetable Management</h1>
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsAutoGenerateOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Auto-Generate Timetable
            </Button>
            <Button onClick={openAddDialog} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </div>
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
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Subject(s)</th>
                    <th className="text-left p-2">Teacher(s)</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => {
                    const periodSlot = periodSlots.find(p => p.id === entry.period_slot_id);
                    return (
                      <tr key={entry.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{entry.class_name}</td>
                        <td className="p-2">{entry.day_of_week}</td>
                        <td className="p-2">{entry.period_number}</td>
                        <td className="p-2 text-sm">
                          {periodSlot ? `${periodSlot.start_time} - ${periodSlot.end_time}` : "—"}
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-gray-800">View Class Timetables</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Select a class to view its weekly schedule</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {classes.map((cls) => (
                <Button
                  key={cls.id}
                  variant="outline"
                  onClick={() => showTimetable(cls.id)}
                  className="h-auto py-6 px-4 flex flex-col items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-5 transition-opacity duration-200" />
                  <div className="bg-blue-100 group-hover:bg-blue-200 p-2 rounded-lg transition-colors duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors duration-200">
                    {cls.name}
                  </span>
                  <span className="text-xs text-gray-500 group-hover:text-blue-600 transition-colors duration-200">
                    View Schedule
                  </span>
                </Button>
              ))}
            </div>
            {classes.length === 0 && (
              <div className="text-center py-12">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No classes available</p>
                <p className="text-sm text-gray-400 mt-1">Classes will appear here once they are created</p>
              </div>
            )}
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
                  onChange={(e) => {
                    setFormDay(e.target.value);
                    setFormPeriodSlotId(""); // Reset period when day changes
                  }}
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
                  value={formPeriodSlotId}
                  onChange={(e) => setFormPeriodSlotId(e.target.value)}
                  disabled={!formDay}
                >
                  <option value="">Select Period</option>
                  {availablePeriodsForDay.map((p) => (
                    <option key={p.id} value={p.id}>
                      Period {p.period_number} ({p.start_time} - {p.end_time})
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
                    onChange={(e) => {
                      setDepartmentalMode(e.target.checked);
                      if (e.target.checked) setReligionMode(false);
                    }}
                  />
                  <Label>Departmental Mode (SSS)</Label>
                </div>
              )}

              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={religionMode}
                  onChange={(e) => {
                    setReligionMode(e.target.checked);
                    if (e.target.checked) setDepartmentalMode(false);
                  }}
                />
                <Label>Religion Mode (CRS/IRS)</Label>
              </div>

              {!departmentalMode && !religionMode && (
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
                      .sort((a, b) => {
                        const nameA = a.subjects?.name?.toLowerCase() || "";
                        const nameB = b.subjects?.name?.toLowerCase() || "";
                        return nameA.localeCompare(nameB);
                      })
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

              {religionMode && (
                <>
                  <div className="col-span-2">
                    <Label>Christian Religious Studies (CRS)</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={formChristianSubjectClassId}
                      onChange={(e) => setFormChristianSubjectClassId(e.target.value)}
                    >
                      <option value="">None</option>
                      {subjectClassesByReligion("Christian").map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {formatSubjectClassDisplay(sc)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <Label>Islamic Religious Studies (IRS)</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={formMuslimSubjectClassId}
                      onChange={(e) => setFormMuslimSubjectClassId(e.target.value)}
                    >
                      <option value="">None</option>
                      {subjectClassesByReligion("Muslim").map((sc) => (
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
              <Button type="button" variant="destructive" onClick={handleDeleteAllSubjects}>
                Delete All Subjects
              </Button>
              <Button type="button" variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" variant="default">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Timetable Modal */}
      <Dialog open={isTableModalOpen} onOpenChange={setIsTableModalOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {classes.find((c) => c.id === selectedClass)?.name || "Class"} - Weekly Timetable
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4">

            <Button onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>

          <div id="timetable-scroll-wrapper" className="h-[70vh] overflow-auto border rounded-lg">
            <div id="timetable-area" className="p-2 bg-white">
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
                  {displayPeriodRows.map((row) => (
                    <tr key={row.index}>
                      <td className="border border-gray-300 p-3 bg-gray-50 text-center font-medium">
                        {row.isBreakRow ? "" : row.label}
                      </td>


                      {DAYS.map((day) => {
                        const dayPeriods = periodsByDay[day] || [];
                        const period = dayPeriods[row.index];

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
                                <div className="text-xs text-gray-600 flex items-center justify-center gap-2 mt-1">
                                  <span>{period.start_time} - {period.end_time}</span>
                                  <button
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Edit time"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditPeriodTime(period);
                                    }}
                                  >
                                    ✎
                                  </button>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        const cell = classTimetable[day]?.[period.id];

                        return (
                          <td
                            key={day}
                            className="border border-gray-300 p-3 cursor-pointer hover:bg-blue-50 transition-colors"
                            onClick={() => {
                              if (!selectedClass) return;

                              if (cell?.rows?.length > 0) {
                                openEdit(cell.rows[0]);
                              } else {
                                openAdd(day, period.id, selectedClass);
                              }
                            }}
                          >
                            <div className="space-y-1">
                              <div className="text-xs text-gray-600 flex items-center justify-center gap-2">
                                <span>{period.start_time} - {period.end_time}</span>
                                <button
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit time"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditPeriodTime(period);
                                  }}
                                >
                                  ✎
                                </button>
                              </div>

                              {cell ? (
                                <>
                                  <div className="font-semibold text-gray-800 text-center">{cell.subject}</div>
                                  <div className="text-xs text-gray-600 text-center">{cell.teacher}</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-gray-400 text-center py-2 export-hide">
                                    <Plus className="w-4 h-4 mx-auto mb-1 opacity-50" />
                                    <span className="text-xs">Add Subject</span>
                                  </div>
                                  <div className="text-gray-600 text-center py-2 export-show" style={{ display: 'none' }}>
                                    <div className="font-semibold">Free Period</div>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Period Slot Edit Modal */}
      <Dialog open={!!editingPeriodSlot} onOpenChange={() => setEditingPeriodSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Period Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {editingPeriodSlot?.day_of_week} - Period {editingPeriodSlot?.period_number}
            </div>
            <div>
              <Label>Start Time</Label>
              <Input
                type="time"
                value={periodStartTime}
                onChange={(e) => setPeriodStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>End Time</Label>
              <Input
                type="time"
                value={periodEndTime}
                onChange={(e) => setPeriodEndTime(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingPeriodSlot(null)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!editingPeriodSlot) return;
                  await updatePeriodSlot(editingPeriodSlot.id, periodStartTime, periodEndTime);
                  setEditingPeriodSlot(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto-Generate Wizard */}
      <AutoTimetableWizard
        isOpen={isAutoGenerateOpen}
        onClose={() => setIsAutoGenerateOpen(false)}
        classes={classes}
        subjectClasses={subjectClasses}
        periodSlots={periodSlots}
        onGenerated={async () => {
          await fetchAll();
          if (selectedClass) await showTimetable(selectedClass);
        }}
      />

    </DashboardLayout>
  );
}