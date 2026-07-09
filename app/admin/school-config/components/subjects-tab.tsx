"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkCreateSubjectsDialog } from "@/components/bulk-create-subjects-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  GraduationCap,
  Sparkles,
  Loader2,
} from "lucide-react";
import type {
  EducationLevel, Department, Religion, Subject,
  Teacher, Class as SchoolClass, EducationLevelSubjectPreset,
} from "@/lib/types";
import { getSubjectsForLevel } from "@/lib/nigerian-subjects";
import { generateUniqueSubjectCode } from "@/lib/subject-code-generator";

const blankSubjectPreset = () => ({
  name: "", is_optional: false, department_id: "", religion_id: "",
  order_sequence: 1, is_active: true,
});
const blankOperationalSubject = () => ({
  name: "", education_level_id: "", department_id: "", religion_id: "",
  is_optional: false, is_active: true,
});

export default function SubjectsTab({ schoolId }: { schoolId: string }) {
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [religions, setReligions] = useState<Religion[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classLevels, setClassLevels] = useState<any[]>([]);

  const [operationalSubjects, setOperationalSubjects] = useState<Subject[]>([]);
  const [opSubjectsLoading, setOpSubjectsLoading] = useState(false);
  const [opSubjectsSearch, setOpSubjectsSearch] = useState("");
  const [opEducationLevelFilter, setOpEducationLevelFilter] = useState("all");
  const [opDepartmentFilter, setOpDepartmentFilter] = useState("all");
  const [opStatusFilter, setOpStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingOperationalSubject, setEditingOperationalSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState(blankOperationalSubject());
  const [subjectSaving, setSubjectSaving] = useState(false);

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyTargetSubject, setApplyTargetSubject] = useState<Subject | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [teacherByClassId, setTeacherByClassId] = useState<Record<string, string>>({});
  const [assignmentsByClassId, setAssignmentsByClassId] = useState<Record<string, string>>({});
  const [applyingSubject, setApplyingSubject] = useState(false);

  const [subjectPresets, setSubjectPresets] = useState<EducationLevelSubjectPreset[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [selectedPresetLevelId, setSelectedPresetLevelId] = useState("");
  const [spDialogOpen, setSpDialogOpen] = useState(false);
  const [editingSp, setEditingSp] = useState<EducationLevelSubjectPreset | null>(null);
  const [deleteSpId, setDeleteSpId] = useState<string | null>(null);
  const [spForm, setSpForm] = useState(blankSubjectPreset());
  const [spSaving, setSpSaving] = useState(false);
  const [loadDefaultsConfirmOpen, setLoadDefaultsConfirmOpen] = useState(false);
  const [subjectTabValue, setSubjectTabValue] = useState("operational");

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      supabase.from("school_education_levels").select("*").eq("school_id", schoolId).order("order_sequence", { ascending: true }),
      supabase.from("school_departments").select("*").eq("school_id", schoolId).order("name", { ascending: true }),
      supabase.from("school_religions").select("*").eq("school_id", schoolId).order("name", { ascending: true }),
      supabase.from("school_class_levels").select("*").eq("school_id", schoolId),
    ]).then(([elRes, dpRes, rlRes, clRes]) => {
      if (!elRes.error) setEducationLevels(elRes.data ?? []);
      if (!dpRes.error) setDepartments(dpRes.data ?? []);
      if (!rlRes.error) setReligions(rlRes.data ?? []);
      if (!clRes.error) setClassLevels(clRes.data ?? []);
    });
  }, [schoolId]);

  const fetchTeachers = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("teachers")
      .select("id, staff_id, first_name, last_name, email, phone, address, qualification, specialization, hire_date, photo_url, bio, status, created_at, school_id")
      .eq("school_id", schoolId).order("first_name", { ascending: true });
    if (!error) setTeachers((data ?? []) as Teacher[]);
  }, [schoolId]);

  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("classes")
      .select("id, school_id, name, class_level_id, stream_id, department_id, room_number, class_teacher_id, session_id, academic_year, created_at, updated_at")
      .eq("school_id", schoolId).order("name", { ascending: true });
    if (!error) setClasses((data ?? []) as SchoolClass[]);
  }, [schoolId]);

  useEffect(() => {
    if (schoolId) { fetchTeachers(); fetchClasses(); }
  }, [schoolId, fetchTeachers, fetchClasses]);

  const fetchOperationalSubjects = useCallback(async () => {
    if (!schoolId) return;
    setOpSubjectsLoading(true);
    const { data, error } = await supabase
      .from("subjects").select("*").eq("school_id", schoolId).order("name", { ascending: true });
    if (error) toast.error(error.message || "Failed to load subject catalog");
    else setOperationalSubjects((data ?? []) as Subject[]);
    setOpSubjectsLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchOperationalSubjects(); }, [fetchOperationalSubjects]);

  const fetchSubjectPresets = useCallback(async (levelId?: string) => {
    if (!schoolId) return;
    const targetId = levelId ?? selectedPresetLevelId;
    if (!targetId) { setSubjectPresets([]); return; }
    setSpLoading(true);
    const { data, error } = await supabase
      .from("school_level_subject_presets").select("*")
      .eq("school_id", schoolId).eq("education_level_id", targetId)
      .order("order_sequence", { ascending: true }).order("name", { ascending: true });
    if (error) toast.error(error.message || "Failed to load level subjects");
    else setSubjectPresets((data ?? []) as EducationLevelSubjectPreset[]);
    setSpLoading(false);
  }, [schoolId, selectedPresetLevelId]);

  useEffect(() => {
    if (educationLevels.length === 0) {
      if (selectedPresetLevelId) setSelectedPresetLevelId("");
      return;
    }
    const stillExists = educationLevels.some((el) => el.id === selectedPresetLevelId);
    if (!stillExists) setSelectedPresetLevelId(educationLevels[0].id);
  }, [educationLevels, selectedPresetLevelId]);

  useEffect(() => {
    if (schoolId && selectedPresetLevelId) fetchSubjectPresets(selectedPresetLevelId);
  }, [schoolId, selectedPresetLevelId, fetchSubjectPresets]);

  async function saveOperationalSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    const payload = {
      school_id: schoolId, name: subjectForm.name.trim(),
      education_level_id: subjectForm.education_level_id || null,
      department_id: subjectForm.department_id || null,
      religion_id: subjectForm.religion_id || null,
      is_optional: subjectForm.is_optional, is_active: subjectForm.is_active,
    };
    if (!payload.name) { toast.error("Subject name is required"); return; }
    if (!payload.education_level_id) { toast.error("Education level is required"); return; }
    setSubjectSaving(true);
    try {
      if (editingOperationalSubject) {
        const { error: updateError } = await supabase
          .from("subjects").update(payload).eq("id", editingOperationalSubject.id).eq("school_id", schoolId);
        if (updateError) throw updateError;
        const { error: propagateError } = await supabase
          .from("subject_classes").update({ department_id: payload.department_id, religion_id: payload.religion_id, is_optional: payload.is_optional })
          .eq("school_id", schoolId).eq("subject_id", editingOperationalSubject.id);
        if (propagateError) throw propagateError;
        toast.success("Subject updated and class assignments synchronized");
      } else {
        const { error: insertError } = await supabase.from("subjects").insert(payload);
        if (insertError) throw insertError;
        toast.success("Subject created");
      }
      setSubjectDialogOpen(false); setEditingOperationalSubject(null);
      setSubjectForm(blankOperationalSubject()); fetchOperationalSubjects();
    } catch (err: any) { toast.error(err?.message || "Failed to save subject"); }
    finally { setSubjectSaving(false); }
  }

  async function openApplyDialog(subject: Subject) {
    if (!schoolId) return;
    setApplyTargetSubject(subject); setSelectedClassIds([]);
    setTeacherByClassId({}); setAssignmentsByClassId({}); setApplyDialogOpen(true);
    const { data, error } = await supabase
      .from("subject_classes").select("class_id, teacher_id")
      .eq("school_id", schoolId).eq("subject_id", subject.id);
    if (error) { toast.error(error.message || "Failed to load existing assignments"); return; }
    const map: Record<string, string> = {}; const teacherMap: Record<string, string> = {};
    for (const row of data ?? []) { map[row.class_id] = row.class_id; teacherMap[row.class_id] = row.teacher_id || ""; }
    setAssignmentsByClassId(map); setTeacherByClassId(teacherMap);
  }

  async function applySubjectToClasses() {
    if (!schoolId || !applyTargetSubject) return;
    if (selectedClassIds.length === 0) { toast.error("Select at least one class"); return; }
    setApplyingSubject(true);
    try {
      const selectedClasses = classes.filter((item) => selectedClassIds.includes(item.id));
      const { data: existingSubjectClasses, error: fetchError } = await supabase
        .from("subject_classes").select("class_id, subject_code")
        .eq("school_id", schoolId).in("class_id", selectedClasses.map((c) => c.id));
      if (fetchError) throw fetchError;
      const codesByClass: Record<string, string[]> = {};
      for (const classItem of selectedClasses) {
        codesByClass[classItem.id] = (existingSubjectClasses || [])
          .filter((sc: any) => sc.class_id === classItem.id).map((sc: any) => sc.subject_code);
      }
      const payload = selectedClasses.map((classItem) => ({
        school_id: schoolId, subject_id: applyTargetSubject.id, class_id: classItem.id,
        teacher_id: teacherByClassId[classItem.id] || null,
        subject_code: generateUniqueSubjectCode(applyTargetSubject.name, classItem.name, codesByClass[classItem.id] || []),
        department_id: applyTargetSubject.department_id || null,
        religion_id: applyTargetSubject.religion_id || null,
        is_optional: applyTargetSubject.is_optional, is_active: true,
      }));
      const { error } = await supabase.from("subject_classes").upsert(payload, {
        onConflict: "school_id,subject_id,class_id", ignoreDuplicates: false,
      });
      if (error) throw error;
      toast.success(`Applied subject to ${selectedClassIds.length} class(es)`);
      setApplyDialogOpen(false); setApplyTargetSubject(null);
      setSelectedClassIds([]); setTeacherByClassId({}); setAssignmentsByClassId({});
    } catch (err: any) { toast.error(err?.message || "Failed to apply subject"); }
    finally { setApplyingSubject(false); }
  }

  async function saveSubjectPreset(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !selectedPresetLevelId) return;
    setSpSaving(true);
    try {
      const payload = {
        school_id: schoolId, education_level_id: selectedPresetLevelId,
        name: spForm.name.trim(), is_optional: spForm.is_optional,
        department_id: spForm.department_id || null, religion_id: spForm.religion_id || null,
        order_sequence: Number(spForm.order_sequence), is_active: spForm.is_active,
      };
      if (!payload.name) { toast.error("Subject name is required"); return; }
      if (!Number.isFinite(payload.order_sequence) || payload.order_sequence < 1) {
        toast.error("Order sequence must be at least 1"); return;
      }
      if (editingSp) {
        const { error } = await supabase.from("school_level_subject_presets").update(payload).eq("id", editingSp.id);
        if (error) throw error; toast.success("Level subject updated");
      } else {
        const { error } = await supabase.from("school_level_subject_presets").insert(payload);
        if (error) throw error; toast.success("Level subject added");
      }
      setSpDialogOpen(false); setEditingSp(null); setSpForm(blankSubjectPreset());
      fetchSubjectPresets(selectedPresetLevelId);
    } catch (err: any) { toast.error(err?.message || "Failed to save level subject"); }
    finally { setSpSaving(false); }
  }

  async function deleteSubjectPreset() {
    if (!deleteSpId) return;
    const { error } = await supabase.from("school_level_subject_presets").delete().eq("id", deleteSpId);
    if (error) toast.error(error.message || "Failed to delete");
    else { toast.success("Level subject deleted"); fetchSubjectPresets(selectedPresetLevelId); }
    setDeleteSpId(null);
  }

  async function toggleSubjectPresetActive(item: EducationLevelSubjectPreset) {
    const { error } = await supabase.from("school_level_subject_presets").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) toast.error(error.message || "Failed to update status");
    else setSubjectPresets((prev) => prev.map((row) => row.id === item.id ? { ...row, is_active: !item.is_active } : row));
  }

  function loadDefaultSubjectsForPresetLevel() {
    if (!schoolId || !selectedPresetLevelId) { toast.error("Select an education level first"); return; }
    if (subjectPresets.length > 0) { setLoadDefaultsConfirmOpen(true); return; }
    proceedWithLoadingDefaults();
  }

  async function proceedWithLoadingDefaults() {
    if (!schoolId || !selectedPresetLevelId) { toast.error("Select an education level first"); return; }
    const selectedLevel = educationLevels.find((level) => level.id === selectedPresetLevelId);
    if (!selectedLevel) { toast.error("Selected education level was not found"); return; }
    const defaults = getSubjectsForLevel(selectedLevel.name);
    if (defaults.length === 0) { toast.error(`No default subjects found for ${selectedLevel.name}`); return; }
    const rows = defaults.map((subject, index) => ({
      school_id: schoolId, education_level_id: selectedPresetLevelId,
      name: subject.name, is_optional: Boolean(subject.isOptional),
      order_sequence: index + 1, is_active: true,
    }));
    const { error } = await supabase.from("school_level_subject_presets").upsert(rows, {
      onConflict: "school_id,education_level_id,name", ignoreDuplicates: false,
    });
    if (error) { toast.error(error.message || "Failed to load default subjects"); return; }
    toast.success(`Loaded ${rows.length} default subjects for ${selectedLevel.name}`);
    setLoadDefaultsConfirmOpen(false);
    fetchSubjectPresets(selectedPresetLevelId);
  }

  function LoadingRow() {
    return (
      <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
    );
  }

  const filteredOpSubjects = operationalSubjects.filter((s) => {
    if (opSubjectsSearch && !s.name.toLowerCase().includes(opSubjectsSearch.toLowerCase())) return false;
    if (opEducationLevelFilter !== "all" && s.education_level_id !== opEducationLevelFilter) return false;
    if (opDepartmentFilter !== "all" && s.department_id !== opDepartmentFilter) return false;
    if (opStatusFilter === "active" && !s.is_active) return false;
    if (opStatusFilter === "inactive" && s.is_active) return false;
    return true;
  });

  const applyClassesForTarget = (() => {
    if (!applyTargetSubject?.education_level_id) return [] as SchoolClass[];
    const levelClassLevelIds = new Set(
      classLevels.filter((cl) => cl.education_level_id === applyTargetSubject.education_level_id).map((cl) => cl.id)
    );
    return classes.filter((c) => levelClassLevelIds.has(c.class_level_id));
  })();

  return (
    <>
      <Tabs value={subjectTabValue} onValueChange={setSubjectTabValue} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="operational" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Operational Subjects
            <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">{operationalSubjects.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="presets" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Subject Presets
            <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">{subjectPresets.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ─── OPERATIONAL SUBJECTS ─── */}
        <TabsContent value="operational" className="space-y-4">
          <div className="space-y-4">
            <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/20 overflow-hidden">
              <div className="px-6 py-5">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Subject Catalog
                </h3>
                <p className="text-sm text-muted-foreground">Create and manage subjects across all education levels.</p>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Total Subjects</p>
                    <p className="text-3xl font-bold mt-2 text-blue-600 dark:text-blue-400">{operationalSubjects.length}</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-blue-200 dark:text-blue-900" />
                </div>
              </div>
              <div className="rounded-lg border bg-card p-4 hover:border-green-300 dark:hover:border-green-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Active</p>
                    <p className="text-3xl font-bold mt-2 text-green-600 dark:text-green-400">
                      {operationalSubjects.filter((s) => s.is_active).length}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border bg-card p-4 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Levels</p>
                    <p className="text-3xl font-bold mt-2 text-amber-600 dark:text-amber-400">
                      {new Set(operationalSubjects.map((s) => s.education_level_id)).size}
                    </p>
                  </div>
                  <GraduationCap className="h-8 w-8 text-amber-200 dark:text-amber-900" />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => { setEditingOperationalSubject(null); setSubjectForm(blankOperationalSubject()); setSubjectDialogOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Add Subject
              </Button>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Filter Results</p>
                {(opSubjectsSearch || opEducationLevelFilter !== "all" || opDepartmentFilter !== "all" || opStatusFilter !== "all") && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    setOpSubjectsSearch(""); setOpEducationLevelFilter("all"); setOpDepartmentFilter("all"); setOpStatusFilter("all");
                  }}>Clear All</Button>
                )}
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Search</Label>
                  <Input placeholder="Subject name..." value={opSubjectsSearch} onChange={(e) => setOpSubjectsSearch(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Level</Label>
                  <Select value={opEducationLevelFilter} onValueChange={setOpEducationLevelFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      {educationLevels.map((el) => (<SelectItem key={el.id} value={el.id}>{el.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Department</Label>
                  <Select value={opDepartmentFilter} onValueChange={setOpDepartmentFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dp) => (<SelectItem key={dp.id} value={dp.id}>{dp.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={opStatusFilter} onValueChange={(val: any) => setOpStatusFilter(val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="inactive">Inactive Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {opEducationLevelFilter !== "all" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4 flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Filtered by Education Level</p>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    {educationLevels.find((el) => el.id === opEducationLevelFilter)?.name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Table - Desktop */}
          <div className="rounded-lg border bg-card overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground font-medium">
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Level</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Dept</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {opSubjectsLoading ? <LoadingRow /> : filteredOpSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8">
                        <div className="flex flex-col items-center justify-center">
                          <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">No subjects match your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOpSubjects.map((subject) => {
                    const level = educationLevels.find((el) => el.id === subject.education_level_id);
                    const department = departments.find((dp) => dp.id === subject.department_id);
                    return (
                      <tr key={subject.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-sm">{subject.name}</p>
                          {subject.religion_id && <p className="text-xs text-muted-foreground mt-0.5">Religious subject</p>}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{level?.name || "—"}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {department?.name ? <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200">{department.name}</Badge> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {subject.is_optional ? <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200">Optional</Badge> : <Badge className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200">Core</Badge>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={subject.is_active ? "default" : "outline"} className={`text-xs ${subject.is_active ? 'bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-200' : 'bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200'}`}>
                            {subject.is_active ? "✓ Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void openApplyDialog(subject); }}>Apply</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                              setEditingOperationalSubject(subject);
                              setSubjectForm({
                                name: subject.name, education_level_id: subject.education_level_id || "",
                                department_id: subject.department_id || "", religion_id: subject.religion_id || "",
                                is_optional: subject.is_optional, is_active: subject.is_active,
                              });
                              setSubjectDialogOpen(true);
                            }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredOpSubjects.length > 50 && (
              <div className="px-4 py-3 text-xs text-muted-foreground border-t bg-muted/30">
                Showing {filteredOpSubjects.length} subjects. Use filters to narrow down the list.
              </div>
            )}
          </div>

          {/* Card View - Mobile */}
          <div className="grid gap-3 grid-cols-1 sm:hidden">
            {opSubjectsLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                  <div className="space-y-2"><div className="h-3 bg-muted rounded w-1/2"></div><div className="h-3 bg-muted rounded w-2/3"></div></div>
                </div>
              ))}</div>
            ) : filteredOpSubjects.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No subjects match your filters</p>
              </div>
            ) : filteredOpSubjects.map((subject) => {
              const level = educationLevels.find((el) => el.id === subject.education_level_id);
              const department = departments.find((dp) => dp.id === subject.department_id);
              return (
                <div key={subject.id} className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1"><h4 className="font-semibold text-sm">{subject.name}</h4><p className="text-xs text-muted-foreground mt-1">{level?.name || "No Level"}</p></div>
                    <Badge className={`text-xs whitespace-nowrap ${subject.is_active ? 'bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-200' : 'bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200'}`}>
                      {subject.is_active ? "✓ Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {subject.is_optional ? <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200">Optional</Badge> : <Badge className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200">Core</Badge>}
                    {department && <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200">{department.name}</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="default" size="sm" className="flex-1 h-7 text-xs" onClick={() => { void openApplyDialog(subject); }}>Apply</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                      setEditingOperationalSubject(subject);
                      setSubjectForm({ name: subject.name, education_level_id: subject.education_level_id || "", department_id: subject.department_id || "", religion_id: subject.religion_id || "", is_optional: subject.is_optional, is_active: subject.is_active });
                      setSubjectDialogOpen(true);
                    }}><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── SUBJECT PRESETS ─── */}
        <TabsContent value="presets" className="space-y-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-950/20 dark:to-amber-950/10 px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">Subject Preset Templates</h3>
              <p className="text-sm text-muted-foreground">Manage reusable subject templates by education level for future onboarding.</p>
            </div>

            <div className="px-6 py-4 border-b bg-muted/20 space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Select Education Level</Label>
                <Select value={selectedPresetLevelId} onValueChange={setSelectedPresetLevelId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose education level" /></SelectTrigger>
                  <SelectContent>
                    {educationLevels.map((el) => (<SelectItem key={el.id} value={el.id}>{el.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPresetLevelId && (
                <div className="rounded-lg bg-gradient-to-r from-amber-100/80 to-amber-50/80 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-200 dark:bg-amber-800/60 flex items-center justify-center">
                        <GraduationCap className="h-4 w-4 text-amber-800 dark:text-amber-200" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Working with</p>
                        <p className="font-semibold text-foreground">{educationLevels.find((el) => el.id === selectedPresetLevelId)?.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{subjectPresets.length}</p>
                      <p className="text-xs text-muted-foreground">Templates</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-b bg-muted/30 flex flex-col sm:flex-row gap-2">
              {subjectPresets.length === 0 && selectedPresetLevelId && (
                <Button size="sm" variant="outline" onClick={loadDefaultSubjectsForPresetLevel} className="gap-2">
                  <Sparkles className="h-4 w-4" /> Load Defaults
                </Button>
              )}
              {schoolId && (
                <BulkCreateSubjectsDialog
                  schoolId={schoolId}
                  onSuccess={() => { fetchOperationalSubjects(); }}
                  educationLevels={educationLevels}
                  departments={departments}
                  religions={religions}
                  teachers={teachers}
                />
              )}
              <Button size="sm" onClick={() => {
                setEditingSp(null); setSpForm({ ...blankSubjectPreset(), order_sequence: subjectPresets.length + 1 }); setSpDialogOpen(true);
              }} disabled={!selectedPresetLevelId} className="gap-2">
                <Plus className="h-4 w-4" /> Add Template
              </Button>
            </div>

            <div className="px-6 py-4 border-t">
              {!selectedPresetLevelId ? (
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center">
                  <p className="text-sm text-muted-foreground">Select an education level to view and manage its preset templates.</p>
                </div>
              ) : spLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => (<div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />))}</div>
              ) : subjectPresets.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-foreground">No templates yet</p>
                  <p className="text-xs text-muted-foreground">Load defaults or add templates manually.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20 text-xs text-muted-foreground font-medium">
                        <th className="px-4 py-3 text-left">Subject Name</th>
                        <th className="px-4 py-3 text-center">Type</th>
                        <th className="px-4 py-3 text-left hidden sm:table-cell">Department</th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">Religion</th>
                        <th className="px-4 py-3 text-center">Active</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {subjectPresets.map((preset) => {
                        const department = departments.find((d) => d.id === preset.department_id);
                        const religion = religions.find((r) => r.id === preset.religion_id);
                        return (
                          <tr key={preset.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{preset.name}</td>
                            <td className="px-4 py-3 text-center">
                              {preset.is_optional ? <Badge variant="secondary" className="text-xs">Optional</Badge> : <Badge className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-300">Core</Badge>}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                              {department ? <span className="inline-block px-2 py-1 rounded bg-muted/50">{department.name}</span> : <span className="text-muted-foreground/50">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                              {religion ? <span className="inline-block px-2 py-1 rounded bg-muted/50">{religion.name}</span> : <span className="text-muted-foreground/50">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Switch checked={preset.is_active} onCheckedChange={() => toggleSubjectPresetActive(preset)} className="scale-90" />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                  setEditingSp(preset);
                                  setSpForm({ name: preset.name, is_optional: preset.is_optional, department_id: preset.department_id ?? "", religion_id: preset.religion_id ?? "", order_sequence: preset.order_sequence, is_active: preset.is_active });
                                  setSpDialogOpen(true);
                                }}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setDeleteSpId(preset.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Operational Subject Dialog ─── */}
      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingOperationalSubject ? "Edit Subject" : "Add Subject"}</DialogTitle></DialogHeader>
          <form onSubmit={saveOperationalSubject} className="space-y-4">
            <div>
              <Label className="text-sm font-medium block mb-1">Subject Name *</Label>
              <Input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="e.g. Mathematics" required />
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Education Level *</Label>
              <Select value={subjectForm.education_level_id} onValueChange={(v) => setSubjectForm({ ...subjectForm, education_level_id: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {educationLevels.map((el) => (<SelectItem key={el.id} value={el.id}>{el.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Department</Label>
              <Select value={subjectForm.department_id} onValueChange={(v) => setSubjectForm({ ...subjectForm, department_id: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((dp) => (<SelectItem key={dp.id} value={dp.id}>{dp.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Religion</Label>
              <Select value={subjectForm.religion_id} onValueChange={(v) => setSubjectForm({ ...subjectForm, religion_id: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {religions.map((rl) => (<SelectItem key={rl.id} value={rl.id}>{rl.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={subjectForm.is_optional} onCheckedChange={(v) => setSubjectForm({ ...subjectForm, is_optional: v })} />
              <Label className="text-sm">Optional (not required for all students)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubjectDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={subjectSaving}>{subjectSaving ? "Saving..." : editingOperationalSubject ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Subject Preset Dialog ─── */}
      <Dialog open={spDialogOpen} onOpenChange={setSpDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSp ? "Edit Template" : "Add Template"}</DialogTitle></DialogHeader>
          <form onSubmit={saveSubjectPreset} className="space-y-4">
            <div>
              <Label className="text-sm font-medium block mb-1">Subject Name *</Label>
              <Input value={spForm.name} onChange={(e) => setSpForm({ ...spForm, name: e.target.value })} placeholder="e.g. English Language" required />
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Order</Label>
              <Input type="number" min={1} value={spForm.order_sequence} onChange={(e) => setSpForm({ ...spForm, order_sequence: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Department</Label>
              <Select value={spForm.department_id} onValueChange={(v) => setSpForm({ ...spForm, department_id: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((dp) => (<SelectItem key={dp.id} value={dp.id}>{dp.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Religion</Label>
              <Select value={spForm.religion_id} onValueChange={(v) => setSpForm({ ...spForm, religion_id: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {religions.map((rl) => (<SelectItem key={rl.id} value={rl.id}>{rl.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={spForm.is_optional} onCheckedChange={(v) => setSpForm({ ...spForm, is_optional: v })} />
              <Label className="text-sm">Optional (not required for all students)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSpDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={spSaving}>{spSaving ? "Saving..." : editingSp ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Apply Subject to Classes Dialog ─── */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply &quot;{applyTargetSubject?.name}&quot; to Classes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {applyClassesForTarget.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes available for this subject&apos;s education level.</p>
            ) : (
              <div className="grid gap-2">
                {applyClassesForTarget.map((cls) => {
                  const isSelected = selectedClassIds.includes(cls.id);
                  return (
                    <div key={cls.id} className={`rounded-lg border p-3 cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                      onClick={() => {
                        setSelectedClassIds((prev) => prev.includes(cls.id) ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]);
                      }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded" />
                          <p className="font-medium text-sm">{cls.name}</p>
                        </div>
                        <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Select value={teacherByClassId[cls.id] || ""} onValueChange={(v) => setTeacherByClassId((prev) => ({ ...prev, [cls.id]: v }))}>
                            <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Assign teacher" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No teacher</SelectItem>
                              {teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>Cancel</Button>
            <Button onClick={applySubjectToClasses} disabled={applyingSubject || selectedClassIds.length === 0}>
              {applyingSubject ? "Applying..." : `Apply to ${selectedClassIds.length} class(es)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Load Defaults Confirm ─── */}
      <AlertDialog open={loadDefaultsConfirmOpen} onOpenChange={setLoadDefaultsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing templates?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add defaults alongside existing templates. Subjects with the same name will be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLoadDefaultsConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setLoadDefaultsConfirmOpen(false); proceedWithLoadingDefaults(); }}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}