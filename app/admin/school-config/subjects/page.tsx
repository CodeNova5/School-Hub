"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { BulkCreateSubjectsDialog } from "@/components/bulk-create-subjects-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Library,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type {
  EducationLevel,
  ClassLevel,
  Class as SchoolClass,
  Department,
  Religion,
  Subject,
  Teacher,
  EducationLevelSubjectPreset,
} from "@/lib/types";
import { getSubjectsForLevel } from "@/lib/nigerian-subjects";
import { generateUniqueSubjectCode } from "@/lib/subject-code-generator";

/* ─────────────────────────────────────────────
   Form type helpers
───────────────────────────────────────────── */
const blankSubjectPreset = () => ({
  name: "",
  is_optional: false,
  department_id: "",
  religion_id: "",
  order_sequence: 1,
  is_active: true,
});

const blankOperationalSubject = () => ({
  name: "",
  education_level_id: "",
  department_id: "",
  religion_id: "",
  is_optional: false,
  is_active: true,
});

/* ─────────────────────────────────────────────
   Main Component Page
───────────────────────────────────────────── */
export default function SubjectManagementPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const router = useRouter();

  /* ── Structural Dependencies States ── */
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [religions, setReligions] = useState<Religion[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  /* ── Operational / Level Presets States ── */
  const [subjectPresets, setSubjectPresets] = useState<EducationLevelSubjectPreset[]>([]);
  const [operationalSubjects, setOperationalSubjects] = useState<Subject[]>([]);
  
  /* ── Loadings ── */
  const [opSubjectsLoading, setOpSubjectsLoading] = useState(false);
  const [spLoading, setSpLoading] = useState(false);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [spSaving, setSpSaving] = useState(false);
  const [applyingSubject, setApplyingSubject] = useState(false);

  /* ── Dialog and Assignment State Management ── */
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingOperationalSubject, setEditingOperationalSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState(blankOperationalSubject());
  
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyTargetSubject, setApplyTargetSubject] = useState<Subject | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [teacherByClassId, setTeacherByClassId] = useState<Record<string, string>>({});
  const [assignmentsByClassId, setAssignmentsByClassId] = useState<Record<string, string>>({});
  
  const [spDialogOpen, setSpDialogOpen] = useState(false);
  const [editingSp, setEditingSp] = useState<EducationLevelSubjectPreset | null>(null);
  const [deleteSpId, setDeleteSpId] = useState<string | null>(null);
  const [spForm, setSpForm] = useState(blankSubjectPreset());
  const [selectedPresetLevelId, setSelectedPresetLevelId] = useState<string>("");
  const [loadDefaultsConfirmOpen, setLoadDefaultsConfirmOpen] = useState(false);
  const [subjectTabValue, setSubjectTabValue] = useState("presets");

  /* ── Bulk Creation Dialog State ── */
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  /* ── Operational Subjects Filters ── */
  const [opSubjectsSearch, setOpSubjectsSearch] = useState<string>("");
  const [opEducationLevelFilter, setOpEducationLevelFilter] = useState<string>("all");
  const [opDepartmentFilter, setOpDepartmentFilter] = useState<string>("all");
  const [opStatusFilter, setOpStatusFilter] = useState<"all" | "active" | "inactive">("all");

  /* ═══════════════════════════════════════
     DATA FETCHING METHODS
  ═══════════════════════════════════════ */
  const fetchEducationLevels = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("school_education_levels")
      .select("*")
      .eq("school_id", schoolId)
      .order("order_sequence", { ascending: true });
    if (error) toast.error("Failed to load education levels");
    else setEducationLevels(data ?? []);
  }, [schoolId]);

  const fetchClassLevels = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("school_class_levels")
      .select("*, school_education_levels(id, name)")
      .eq("school_id", schoolId)
      .order("order_sequence", { ascending: true });
    if (error) toast.error("Failed to load class levels");
    else setClassLevels((data ?? []) as ClassLevel[]);
  }, [schoolId]);

  const fetchDepartments = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("school_departments")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load departments");
    else setDepartments(data ?? []);
  }, [schoolId]);

  const fetchReligions = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("school_religions")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load religions");
    else setReligions(data ?? []);
  }, [schoolId]);

  const fetchSubjectPresets = useCallback(async (levelId?: string) => {
    if (!schoolId) return;

    const targetLevelId = levelId ?? selectedPresetLevelId;
    if (!targetLevelId) {
      setSubjectPresets([]);
      return;
    }

    setSpLoading(true);
    const { data, error } = await supabase
      .from("school_level_subject_presets")
      .select("*")
      .eq("school_id", schoolId)
      .eq("education_level_id", targetLevelId)
      .order("order_sequence", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load level subjects");
    } else {
      setSubjectPresets((data ?? []) as EducationLevelSubjectPreset[]);
    }
    setSpLoading(false);
  }, [schoolId, selectedPresetLevelId]);

  const fetchOperationalSubjects = useCallback(async () => {
    if (!schoolId) return;

    setOpSubjectsLoading(true);
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load subject catalog");
    } else {
      setOperationalSubjects((data ?? []) as Subject[]);
    }
    setOpSubjectsLoading(false);
  }, [schoolId]);

  const fetchTeachers = useCallback(async () => {
    if (!schoolId) return;

    const { data, error } = await supabase
      .from("teachers")
      .select("id, staff_id, first_name, last_name, email, phone, address, qualification, specialization, hire_date, photo_url, bio, status, created_at, school_id")
      .eq("school_id", schoolId)
      .order("first_name", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load teachers");
    } else {
      setTeachers((data ?? []) as Teacher[]);
    }
  }, [schoolId]);

  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;

    const { data, error } = await supabase
      .from("classes")
      .select("id, school_id, name, class_level_id, stream_id, department_id, room_number, class_teacher_id, session_id, academic_year, created_at, updated_at")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load classes");
    } else {
      setClasses((data ?? []) as SchoolClass[]);
    }
  }, [schoolId]);

  /* ═══════════════════════════════════════
     OPERATIONAL SUBJECT ACTIONS
  ═══════════════════════════════════════ */
  async function saveOperationalSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;

    const payload = {
      school_id: schoolId,
      name: subjectForm.name.trim(),
      education_level_id: subjectForm.education_level_id || null,
      department_id: subjectForm.department_id || null,
      religion_id: subjectForm.religion_id || null,
      is_optional: subjectForm.is_optional,
      is_active: subjectForm.is_active,
    };

    if (!payload.name) {
      toast.error("Subject name is required");
      return;
    }
    if (!payload.education_level_id) {
      toast.error("Education level is required");
      return;
    }

    setSubjectSaving(true);
    try {
      if (editingOperationalSubject) {
        const { error: updateError } = await supabase
          .from("subjects")
          .update(payload)
          .eq("id", editingOperationalSubject.id)
          .eq("school_id", schoolId);

        if (updateError) throw updateError;

        const { error: propagateError } = await supabase
          .from("subject_classes")
          .update({
            department_id: payload.department_id,
            religion_id: payload.religion_id,
            is_optional: payload.is_optional,
          })
          .eq("school_id", schoolId)
          .eq("subject_id", editingOperationalSubject.id);

        if (propagateError) throw propagateError;

        toast.success("Subject updated and class assignments synchronized");
      } else {
        const { error: insertError } = await supabase
          .from("subjects")
          .insert(payload);

        if (insertError) throw insertError;
        toast.success("Subject created");
      }

      setSubjectDialogOpen(false);
      setEditingOperationalSubject(null);
      setSubjectForm(blankOperationalSubject());
      fetchOperationalSubjects();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save subject");
    } finally {
      setSubjectSaving(false);
    }
  }

  async function toggleSubjectActive(item: Subject) {
    if (!schoolId) return;
    const nextStatus = !item.is_active;

    const { error } = await supabase
      .from("subjects")
      .update({ is_active: nextStatus })
      .eq("id", item.id)
      .eq("school_id", schoolId);

    if (error) {
      toast.error(error.message || "Failed to update subject status");
    } else {
      setOperationalSubjects((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, is_active: nextStatus } : row))
      );
      toast.success(`Subject set to ${nextStatus ? "active" : "inactive"}`);
    }
  }

  /* ═══════════════════════════════════════
     CLASS TARGET ALLOCATION METHODS
  ═══════════════════════════════════════ */
  async function openApplyDialog(subject: Subject) {
    if (!schoolId) return;

    setApplyTargetSubject(subject);
    setSelectedClassIds([]);
    setTeacherByClassId({});
    setAssignmentsByClassId({});
    setApplyDialogOpen(true);

    const { data, error } = await supabase
      .from("subject_classes")
      .select("class_id, teacher_id")
      .eq("school_id", schoolId)
      .eq("subject_id", subject.id);

    if (error) {
      toast.error(error.message || "Failed to load existing assignments");
      return;
    }

    const map: Record<string, string> = {};
    const teacherMap: Record<string, string> = {};
    const selectedIds: string[] = [];

    for (const row of data ?? []) {
      map[row.class_id] = row.class_id;
      teacherMap[row.class_id] = row.teacher_id || "";
      selectedIds.push(row.class_id);
    }

    setAssignmentsByClassId(map);
    setTeacherByClassId(teacherMap);
    setSelectedClassIds(selectedIds);
  }

  async function applySubjectToClasses() {
    if (!schoolId || !applyTargetSubject) return;
    if (selectedClassIds.length === 0) {
      toast.error("Select at least one class");
      return;
    }

    setApplyingSubject(true);
    try {
      const selectedClasses = classes.filter((item) => selectedClassIds.includes(item.id));
      
      const { data: existingSubjectClasses, error: fetchError } = await supabase
        .from("subject_classes")
        .select("class_id, subject_code")
        .eq("school_id", schoolId)
        .in("class_id", selectedClasses.map(c => c.id));

      if (fetchError) throw fetchError;

      const codesByClass: Record<string, string[]> = {};
      for (const classItem of selectedClasses) {
        codesByClass[classItem.id] = (existingSubjectClasses || [])
          .filter((sc: { class_id: string }) => sc.class_id === classItem.id)
          .map((sc: { subject_code: string }) => sc.subject_code);
      }

      const payload = selectedClasses.map((classItem) => ({
        school_id: schoolId,
        subject_id: applyTargetSubject.id,
        class_id: classItem.id,
        teacher_id: teacherByClassId[classItem.id] || null,
        subject_code: generateUniqueSubjectCode(
          applyTargetSubject.name,
          classItem.name,
          codesByClass[classItem.id] || []
        ),
        department_id: applyTargetSubject.department_id || null,
        religion_id: applyTargetSubject.religion_id || null,
        is_optional: applyTargetSubject.is_optional,
        is_active: true,
      }));

      const { error } = await supabase
        .from("subject_classes")
        .upsert(payload, {
          onConflict: "school_id,subject_id,class_id",
          ignoreDuplicates: false,
        });

      if (error) throw error;

      toast.success(`Applied subject to ${selectedClassIds.length} class(es)`);
      setApplyDialogOpen(false);
      setApplyTargetSubject(null);
      setSelectedClassIds([]);
      setTeacherByClassId({});
      setAssignmentsByClassId({});
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply subject");
    } finally {
      setApplyingSubject(false);
    }
  }

  /* ═══════════════════════════════════════
     PRESET LEVEL ACTIONS
  ═══════════════════════════════════════ */
  async function saveSubjectPreset(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !selectedPresetLevelId) return;

    setSpSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        education_level_id: selectedPresetLevelId,
        name: spForm.name.trim(),
        is_optional: spForm.is_optional,
        department_id: spForm.department_id || null,
        religion_id: spForm.religion_id || null,
        order_sequence: Number(spForm.order_sequence),
        is_active: spForm.is_active,
      };

      if (!payload.name) {
        toast.error("Subject name is required");
        return;
      }

      if (editingSp) {
        const { error } = await supabase
          .from("school_level_subject_presets")
          .update(payload)
          .eq("id", editingSp.id);
        if (error) throw error;
        toast.success("Level subject updated");
      } else {
        const { error } = await supabase
          .from("school_level_subject_presets")
          .insert(payload);
        if (error) throw error;
        toast.success("Level subject added");
      }

      setSpDialogOpen(false);
      setEditingSp(null);
      setSpForm(blankSubjectPreset());
      fetchSubjectPresets(selectedPresetLevelId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save level subject");
    } finally {
      setSpSaving(false);
    }
  }

  async function deleteSubjectPreset() {
    if (!deleteSpId) return;

    const { error } = await supabase
      .from("school_level_subject_presets")
      .delete()
      .eq("id", deleteSpId);

    if (error) {
      toast.error(error.message || "Failed to delete level subject");
    } else {
      toast.success("Level subject deleted");
      fetchSubjectPresets(selectedPresetLevelId);
    }
    setDeleteSpId(null);
  }

  async function toggleSubjectPresetActive(item: EducationLevelSubjectPreset) {
    const { error } = await supabase
      .from("school_level_subject_presets")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (error) {
      toast.error(error.message || "Failed to update status");
    } else {
      setSubjectPresets((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, is_active: !item.is_active } : row))
      );
    }
  }

  function loadDefaultSubjectsForPresetLevel() {
    if (!schoolId || !selectedPresetLevelId) {
      toast.error("Select an education level first");
      return;
    }
    if (subjectPresets.length > 0) {
      setLoadDefaultsConfirmOpen(true);
      return;
    }
    proceedWithLoadingDefaults();
  }

  async function proceedWithLoadingDefaults() {
    if (!schoolId || !selectedPresetLevelId) {
      toast.error("Select an education level first");
      return;
    }

    const selectedLevel = educationLevels.find((level) => level.id === selectedPresetLevelId);
    if (!selectedLevel) {
      toast.error("Selected education level was not found");
      return;
    }

    const defaults = getSubjectsForLevel(selectedLevel.name);
    if (defaults.length === 0) {
      toast.error(`No default subjects found for ${selectedLevel.name}`);
      return;
    }

    const rows = defaults.map((subject, index) => ({
      school_id: schoolId,
      education_level_id: selectedPresetLevelId,
      name: subject.name,
      is_optional: Boolean(subject.isOptional),
      order_sequence: index + 1,
      is_active: true,
    }));

    const { error } = await supabase
      .from("school_level_subject_presets")
      .upsert(rows, { onConflict: "school_id,education_level_id,name", ignoreDuplicates: false });

    if (error) {
      toast.error(error.message || "Failed to load default subjects");
      return;
    }

    toast.success(`Loaded ${rows.length} default subjects for ${selectedLevel.name}`);
    setLoadDefaultsConfirmOpen(false);
    fetchSubjectPresets(selectedPresetLevelId);
  }

  /* ═══════════════════════════════════════
     LIFECYCLE EFFECTS
  ═══════════════════════════════════════ */
  useEffect(() => {
    if (schoolId) {
      fetchEducationLevels();
      fetchClassLevels();
      fetchDepartments();
      fetchReligions();
      fetchOperationalSubjects();
      fetchTeachers();
      fetchClasses();
    }
  }, [schoolId, fetchEducationLevels, fetchClassLevels, fetchDepartments, fetchReligions, fetchOperationalSubjects, fetchTeachers, fetchClasses]);

  useEffect(() => {
    if (educationLevels.length === 0) {
      if (selectedPresetLevelId) setSelectedPresetLevelId("");
      return;
    }
    const stillExists = educationLevels.some((level) => level.id === selectedPresetLevelId);
    if (!stillExists) {
      setSelectedPresetLevelId(educationLevels[0].id);
    }
  }, [educationLevels, selectedPresetLevelId]);

  useEffect(() => {
    if (schoolId && selectedPresetLevelId) {
      fetchSubjectPresets(selectedPresetLevelId);
    }
  }, [schoolId, selectedPresetLevelId, fetchSubjectPresets]);

  /* ── Client Side Computed Filters ── */
  const filteredOperationalSubjects = operationalSubjects.filter((subject) => {
    const matchesSearch = subject.name.toLowerCase().includes(opSubjectsSearch.toLowerCase());
    const matchesEduLevel = opEducationLevelFilter === "all" || subject.education_level_id === opEducationLevelFilter;
    const matchesDept = opDepartmentFilter === "all" || subject.department_id === opDepartmentFilter;
    const matchesStatus =
      opStatusFilter === "all" ||
      (opStatusFilter === "active" && subject.is_active) ||
      (opStatusFilter === "inactive" && !subject.is_active);

    return matchesSearch && matchesEduLevel && matchesDept && matchesStatus;
  });

  const applyClassesForTarget = (() => {
    if (!applyTargetSubject?.education_level_id) return [] as SchoolClass[];
    const levelClassLevelIds = new Set(
      classLevels
        .filter((cl) => cl.education_level_id === applyTargetSubject.education_level_id)
        .map((cl) => cl.id)
    );
    return classes.filter((classItem) => levelClassLevelIds.has(classItem.class_level_id));
  })();

  /* ── Shared Component Layout Helpers ── */
  function LoadingRow() {
    return (
      <tr>
        <td colSpan={6} className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </td>
      </tr>
    );
  }

  function EmptyRow({ message }: { message: string }) {
    return (
      <tr>
        <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
          {message}
        </td>
      </tr>
    );
  }

  if (schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subject Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure operational subject scopes, map level-based structures, and assign classes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)} className="shrink-0">
              Bulk Create
            </Button>
            <Button
              onClick={() => {
                setEditingOperationalSubject(null);
                setSubjectForm(blankOperationalSubject());
                setSubjectDialogOpen(true);
              }}
              className="shrink-0 gap-2"
            >
              <Plus className="h-4 w-4" /> Add Subject
            </Button>
          </div>
        </div>

        {/* ── Configuration Context Subtabs ── */}
        <Tabs value={subjectTabValue} onValueChange={setSubjectTabValue} className="w-full">
          {/* ── Progressive Architecture Tabs Indicator ── */}
          <div className="mb-2">
            <TabsList className="grid w-full max-w-2xl grid-cols-2 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger
                value="presets"
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  1
                </span>
                Level Presets <span className="text-xs text-muted-foreground font-normal">(Setup Blueprint)</span>
              </TabsTrigger>
              <TabsTrigger
                value="operational"
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-xs font-bold">
                  2
                </span>
                Operational Catalog <span className="text-xs text-muted-foreground font-normal">(Live Master List)</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ══════════════════════════════════════ TAB COMPONENT: OPERATIONAL CATALOG ══════════════════════════════════════ */}
          <TabsContent value="operational" className="space-y-4 mt-4">
            <div className="bg-blue-50/40 border border-blue-200/60 rounded-xl p-4 mb-4 flex gap-3 items-start">
              <Library className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900">Step 2: Deploy & Allocate Master Catalog</h4>
                <p className="text-xs text-blue-700/90 mt-0.5 leading-relaxed">
                  This is your school's live inventory of active subjects. From here, you can propagate master parameters down to actual physical classrooms by clicking <strong>"Assign Classes"</strong>, generating unique tracking codes contextually.
                </p>
              </div>
            </div>
            
            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-card p-4 rounded-xl border">
              <div className="space-y-1">
                <Label className="text-xs">Search Subjects</Label>
                <Input
                  placeholder="e.g. Mathematics"
                  value={opSubjectsSearch}
                  onChange={(e) => setOpSubjectsSearch(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Education Level</Label>
                <Select value={opEducationLevelFilter} onValueChange={setOpEducationLevelFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {educationLevels.map((lvl) => (
                      <SelectItem key={lvl.id} value={lvl.id}>{lvl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Department</Label>
                <Select value={opDepartmentFilter} onValueChange={setOpDepartmentFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={opStatusFilter}
                  onValueChange={(val: any) => setOpStatusFilter(val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table layout wrapper */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left">Subject Name</th>
                      <th className="px-4 py-3 text-left">Education Scope</th>
                      <th className="px-4 py-3 text-left">Department Variant</th>
                      <th className="px-4 py-3 text-center">Optionality</th>
                      <th className="px-4 py-3 text-center">Active</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {opSubjectsLoading ? (
                      <LoadingRow />
                    ) : filteredOperationalSubjects.length === 0 ? (
                      <EmptyRow message="No operational subjects match the criteria." />
                    ) : (
                      filteredOperationalSubjects.map((subject) => {
                        const matchedLevel = educationLevels.find((l) => l.id === subject.education_level_id);
                        const matchedDept = departments.find((d) => d.id === subject.department_id);

                        return (
                          <tr key={subject.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{subject.name}</td>
                            <td className="px-4 py-3">
                              {matchedLevel ? (
                                <Badge variant="secondary">{matchedLevel.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {matchedDept ? (
                                <span className="text-xs text-foreground font-medium">{matchedDept.name}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">General</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {subject.is_optional ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Elective</Badge>
                              ) : (
                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Compulsory</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Switch
                                checked={subject.is_active}
                                onCheckedChange={() => toggleSubjectActive(subject)}
                                className="scale-90"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                  onClick={() => router.push(`/admin/school-config/subjects/${subject.id}/allocations`)}
                                >
                                  Assign Classes
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setEditingOperationalSubject(subject);
                                    setSubjectForm({
                                      name: subject.name,
                                      education_level_id: subject.education_level_id || "",
                                      department_id: subject.department_id || "",
                                      religion_id: subject.religion_id || "",
                                      is_optional: subject.is_optional,
                                      is_active: subject.is_active,
                                    });
                                    setSubjectDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════ TAB COMPONENT: LEVEL PRESETS ══════════════════════════════════════ */}
          <TabsContent value="presets" className="mt-4">
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 mb-4 flex gap-3 items-start">
              <Sparkles className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">Step 1: Define Your Level Blueprints</h4>
                <p className="text-xs text-amber-700/90 mt-0.5 leading-relaxed">
                  Configure the required curriculum templates for each educational track. Use <strong>"Load Standards"</strong> to instantly populate standard Nigerian tracks. Presets defined here serve as structural rules when manufacturing your operational data.
                </p>
              </div>
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-sm font-medium text-muted-foreground shrink-0">Level scope:</span>
                  <Select value={selectedPresetLevelId} onValueChange={setSelectedPresetLevelId}>
                    <SelectTrigger className="w-full sm:w-[220px] h-9">
                      <SelectValue placeholder="Select level context" />
                    </SelectTrigger>
                    <SelectContent>
                      {educationLevels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button variant="outline" size="sm" onClick={loadDefaultSubjectsForPresetLevel} className="gap-1.5 h-8">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Load Standards
                  </Button>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (!selectedPresetLevelId) {
                        toast.error("Please pick a preset level first");
                        return;
                      }
                      setEditingSp(null);
                      setSpForm({ ...blankSubjectPreset(), order_sequence: subjectPresets.length + 1 });
                      setSpDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left w-12">Seq</th>
                      <th className="px-4 py-2 text-left">Preset Name</th>
                      <th className="px-4 py-2 text-left">Department Mapping</th>
                      <th className="px-4 py-2 text-center">Core Requirement</th>
                      <th className="px-4 py-2 text-center">Active</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {spLoading ? (
                      <LoadingRow />
                    ) : subjectPresets.length === 0 ? (
                      <EmptyRow message="No subject presets defined for this level yet." />
                    ) : (
                      subjectPresets.map((preset) => {
                        const matchedDept = departments.find((d) => d.id === preset.department_id);
                        return (
                          <tr key={preset.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{preset.order_sequence}</td>
                            <td className="px-4 py-3 font-medium">{preset.name}</td>
                            <td className="px-4 py-3 text-xs">
                              {matchedDept ? matchedDept.name : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {preset.is_optional ? (
                                <Badge variant="secondary" className="text-xs">Elective</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Mandatory</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Switch
                                checked={preset.is_active}
                                onCheckedChange={() => toggleSubjectPresetActive(preset)}
                                className="scale-90"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setEditingSp(preset);
                                    setSpForm({
                                      name: preset.name,
                                      is_optional: preset.is_optional,
                                      department_id: preset.department_id || "",
                                      religion_id: preset.religion_id || "",
                                      order_sequence: preset.order_sequence,
                                      is_active: preset.is_active,
                                    });
                                    setSpDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-700"
                                  onClick={() => setDeleteSpId(preset.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ══════════════════════════════════════ DIALOG: OPERATIONAL SUBJECT CREATE/EDIT ══════════════════════════════════════ */}
        <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
          <DialogContent>
            <form onSubmit={saveOperationalSubject}>
              <DialogHeader>
                <DialogTitle>{editingOperationalSubject ? "Modify Subject Context" : "Create Master Subject"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1">
                  <Label htmlFor="sub-name">Subject Title</Label>
                  <Input
                    id="sub-name"
                    required
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    placeholder="e.g. Further Mathematics"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="sub-level">Education Track</Label>
                    <Select
                      value={subjectForm.education_level_id}
                      onValueChange={(val) => setSubjectForm({ ...subjectForm, education_level_id: val })}
                    >
                      <SelectTrigger id="sub-level">
                        <SelectValue placeholder="Pick structural track" />
                      </SelectTrigger>
                      <SelectContent>
                        {educationLevels.map((el) => (
                          <SelectItem key={el.id} value={el.id}>{el.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="sub-dept">Department Variant</Label>
                    <Select
                      value={subjectForm.department_id}
                      onValueChange={(val) => setSubjectForm({ ...subjectForm, department_id: val })}
                    >
                      <SelectTrigger id="sub-dept">
                        <SelectValue placeholder="General (None)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General (None)</SelectItem>
                        {departments.map((dp) => (
                          <SelectItem key={dp.id} value={dp.id}>{dp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sub-rel">Religious Alignment</Label>
                  <Select
                    value={subjectForm.religion_id}
                    onValueChange={(val) => setSubjectForm({ ...subjectForm, religion_id: val })}
                  >
                    <SelectTrigger id="sub-rel">
                      <SelectValue placeholder="None (Secular)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Secular)</SelectItem>
                      {religions.map((rl) => (
                        <SelectItem key={rl.id} value={rl.id}>{rl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="space-y-0.5">
                    <Label>Elective Designation</Label>
                    <p className="text-xs text-muted-foreground">Is this subject optional for student pathways?</p>
                  </div>
                  <Switch
                    checked={subjectForm.is_optional}
                    onCheckedChange={(checked) => setSubjectForm({ ...subjectForm, is_optional: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setSubjectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={subjectSaving}>
                  {subjectSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════ DIALOG: TARGET ALLOCATE TO CLASS ══════════════════════════════════════ */}
        <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Subject to Classes: {applyTargetSubject?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[450px] overflow-y-auto">
              {applyClassesForTarget.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">
                  No active school classes found matching this education level track.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Select target classes to sync this subject into and optionally designate handling tutors. Unique subject system codes will build contextually.
                  </p>
                  <div className="border rounded-xl divide-y">
                    {applyClassesForTarget.map((c) => {
                      const isSelected = selectedClassIds.includes(c.id);
                      const codePreview = applyTargetSubject?.name
                        ? `${applyTargetSubject.name.substring(0, 3).toUpperCase()}-${c.name.replace(/\s+/g, "")}`
                        : "AUTO-GEN";

                      return (
                        <div
                          key={c.id}
                          className={`flex items-center justify-between p-3.5 gap-4 border rounded-xl transition-all ${isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/10"}`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`chk-${c.id}`}
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedClassIds([...selectedClassIds, c.id]);
                                } else {
                                  setSelectedClassIds(selectedClassIds.filter((id) => id !== c.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                            />
                            <div>
                              <Label htmlFor={`chk-${c.id}`} className="block cursor-pointer text-sm font-semibold">
                                {c.name}
                              </Label>
                              <span className="text-[11px] text-muted-foreground">
                                Code strategy: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{codePreview}</code>
                              </span>
                            </div>
                          </div>

                          {isSelected ? (
                            <div className="w-[240px] animate-in fade-in slide-in-from-right-1 duration-150">
                              <Select
                                value={teacherByClassId[c.id] || "unassigned"}
                                onValueChange={(val) =>
                                  setTeacherByClassId({
                                    ...teacherByClassId,
                                    [c.id]: val === "unassigned" ? "" : val,
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs border-primary/30">
                                  <SelectValue placeholder="Assign Tutor" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">No Tutor assigned</SelectItem>
                                  {teachers.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.first_name} {t.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <span className="px-2 text-xs italic text-muted-foreground">Not participating</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={applySubjectToClasses}
                disabled={applyingSubject || applyClassesForTarget.length === 0}
              >
                {applyingSubject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Mapping ({selectedClassIds.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════ DIALOG: LEVEL PRESETS ADD/EDIT ══════════════════════════════════════ */}
        <Dialog open={spDialogOpen} onOpenChange={setSpDialogOpen}>
          <DialogContent>
            <form onSubmit={saveSubjectPreset}>
              <DialogHeader>
                <DialogTitle>{editingSp ? "Edit Level Preset Entry" : "Add Level Preset Entry"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1">
                  <Label htmlFor="preset-name">Subject Name</Label>
                  <Input
                    id="preset-name"
                    required
                    value={spForm.name}
                    onChange={(e) => setSpForm({ ...spForm, name: e.target.value })}
                    placeholder="e.g. Civic Education"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="preset-dept">Department Scope</Label>
                    <Select
                      value={spForm.department_id}
                      onValueChange={(val) => setSpForm({ ...spForm, department_id: val })}
                    >
                      <SelectTrigger id="preset-dept">
                        <SelectValue placeholder="General" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General</SelectItem>
                        {departments.map((dp) => (
                          <SelectItem key={dp.id} value={dp.id}>{dp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="preset-seq">Sequence Order</Label>
                    <Input
                      id="preset-seq"
                      type="number"
                      min={1}
                      required
                      value={spForm.order_sequence}
                      onChange={(e) => setSpForm({ ...spForm, order_sequence: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="space-y-0.5">
                    <Label>Elective Configuration</Label>
                    <p className="text-xs text-muted-foreground">Is this standard level preset elective?</p>
                  </div>
                  <Switch
                    checked={spForm.is_optional}
                    onCheckedChange={(checked) => setSpForm({ ...spForm, is_optional: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setSpDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={spSaving}>
                  {spSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Preset
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════ ALERT: DELETE PRESET ENTRY CONFIRMATION ══════════════════════════════════════ */}
        <AlertDialog open={deleteSpId !== null} onOpenChange={(open) => !open && setDeleteSpId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action completely removes the subject profile preset configuration tracking parameters context from this educational level.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={deleteSubjectPreset}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ══════════════════════════════════════ ALERT: OVERWRITE STANDARDS CONFIRMATION ══════════════════════════════════════ */}
        <AlertDialog open={loadDefaultsConfirmOpen} onOpenChange={setLoadDefaultsConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Load Default Subjects
              </AlertDialogTitle>
              <AlertDialogDescription>
                This education level already has {subjectPresets.length} subject preset rules configured. Overwriting or importing will update duplicate namespaces and inject missing core requirements. Proceed with setup layout update?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={proceedWithLoadingDefaults}>
                Load Defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Bulk Management Context ── */}
        <BulkCreateSubjectsDialog
          schoolId={schoolId!}
          open={bulkDialogOpen}
          onClose={() => setBulkDialogOpen(false)}
          onComplete={() => {
            fetchOperationalSubjects();
            fetchSubjectPresets();
          }}
          educationLevels={educationLevels}
          departments={departments}
          religions={religions}
          teachers={teachers}
        />

      </div>
    </DashboardLayout>
  );
}