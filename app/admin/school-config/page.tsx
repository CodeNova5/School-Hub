"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { SchoolSetupWizard } from "@/components/school-setup-wizard";
import { BulkCreateSubjectsDialog } from "@/components/bulk-create-subjects-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  GraduationCap,
  BookOpen,
  Library,
  Building2,
  Church,
  Waves,
  Sparkles,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type {
  EducationLevel,
  ClassLevel,
  Class as SchoolClass,
  Stream,
  Department,
  Religion,
  Subject,
  Teacher,
  EducationLevelSubjectPreset,
} from "@/lib/types";
import { getSubjectsForLevel } from "@/lib/nigerian-subjects";

/* ─────────────────────────────────────────────
   Form type helpers
───────────────────────────────────────────── */
const blankEL = () => ({ name: "", code: "", description: "", order_sequence: 1 });
const blankCL = () => ({ name: "", education_level_id: "", order_sequence: 1 });
const blankSimple = () => ({ name: "", code: "", description: "" });
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
   Stat card
───────────────────────────────────────────── */
function StatBadge({ count, label }: { count: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-foreground">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function SchoolConfigPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  /* ── Wizard ── */
  const [showWizard, setShowWizard] = useState(false);

  /* ═══════════════════════════════════════
     EDUCATION LEVELS
  ═══════════════════════════════════════ */
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([]);
  const [elLoading, setElLoading] = useState(false);
  const [elDialogOpen, setElDialogOpen] = useState(false);
  const [editingEl, setEditingEl] = useState<EducationLevel | null>(null);
  const [deleteElId, setDeleteElId] = useState<string | null>(null);
  const [elForm, setElForm] = useState(blankEL());
  const [elSaving, setElSaving] = useState(false);

  const fetchEducationLevels = useCallback(async () => {
    if (!schoolId) return;
    setElLoading(true);
    const { data, error } = await supabase
      .from("school_education_levels")
      .select("*")
      .eq("school_id", schoolId)
      .order("order_sequence", { ascending: true });
    if (error) toast.error("Failed to load education levels");
    else setEducationLevels(data ?? []);
    setElLoading(false);
  }, [schoolId]);

  async function saveEL(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setElSaving(true);
    try {
      if (editingEl) {
        const { error } = await supabase
          .from("school_education_levels")
          .update({
            name: elForm.name.trim(),
            code: elForm.code.trim() || null,
            description: elForm.description.trim(),
            order_sequence: Number(elForm.order_sequence),
          })
          .eq("id", editingEl.id);
        if (error) throw error;
        toast.success("Education level updated");
      } else {
        const { error } = await supabase.from("school_education_levels").insert({
          school_id: schoolId,
          name: elForm.name.trim(),
          code: elForm.code.trim() || null,
          description: elForm.description.trim(),
          order_sequence: Number(elForm.order_sequence),
          is_active: true,
        });
        if (error) throw error;
        toast.success("Education level created");
      }
      setElDialogOpen(false);
      setEditingEl(null);
      setElForm(blankEL());
      fetchEducationLevels();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setElSaving(false);
    }
  }

  async function deleteEL() {
    if (!deleteElId) return;
    const { error } = await supabase
      .from("school_education_levels")
      .delete()
      .eq("id", deleteElId);
    if (error) toast.error(error.message);
    else {
      toast.success("Education level deleted");
      fetchEducationLevels();
      // Refresh class levels since some may depend on this
      fetchClassLevels();
    }
    setDeleteElId(null);
  }

  async function toggleELActive(item: EducationLevel) {
    const { error } = await supabase
      .from("school_education_levels")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else setEducationLevels((prev) =>
      prev.map((el) => (el.id === item.id ? { ...el, is_active: !item.is_active } : el))
    );
  }

  async function moveEL(id: string, direction: "up" | "down") {
    const idx = educationLevels.findIndex((el) => el.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === educationLevels.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const a = educationLevels[idx];
    const b = educationLevels[swapIdx];
    await Promise.all([
      supabase
        .from("school_education_levels")
        .update({ order_sequence: b.order_sequence })
        .eq("id", a.id),
      supabase
        .from("school_education_levels")
        .update({ order_sequence: a.order_sequence })
        .eq("id", b.id),
    ]);
    fetchEducationLevels();
  }

  /* ═══════════════════════════════════════
     CLASS LEVELS
  ═══════════════════════════════════════ */
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [clLoading, setClLoading] = useState(false);
  const [clDialogOpen, setClDialogOpen] = useState(false);
  const [editingCl, setEditingCl] = useState<ClassLevel | null>(null);
  const [deleteClId, setDeleteClId] = useState<string | null>(null);
  const [clForm, setClForm] = useState(blankCL());
  const [clSaving, setClSaving] = useState(false);
  const [clFilterEdu, setClFilterEdu] = useState<string>("all");

  const fetchClassLevels = useCallback(async () => {
    if (!schoolId) return;
    setClLoading(true);
    const { data, error } = await supabase
      .from("school_class_levels")
      .select("*, school_education_levels(id, name)")
      .eq("school_id", schoolId)
      .order("order_sequence", { ascending: true });
    if (error) toast.error("Failed to load class levels");
    else setClassLevels((data ?? []) as ClassLevel[]);
    setClLoading(false);
  }, [schoolId]);

  async function saveCL(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setClSaving(true);
    try {
      if (editingCl) {
        const { error } = await supabase
          .from("school_class_levels")
          .update({
            name: clForm.name.trim(),
            education_level_id: clForm.education_level_id,
            order_sequence: Number(clForm.order_sequence),
          })
          .eq("id", editingCl.id);
        if (error) throw error;
        toast.success("Class level updated");
      } else {
        const { error } = await supabase.from("school_class_levels").insert({
          school_id: schoolId,
          name: clForm.name.trim(),
          education_level_id: clForm.education_level_id,
          order_sequence: Number(clForm.order_sequence),
          is_active: true,
        });
        if (error) throw error;
        toast.success("Class level created");
      }
      setClDialogOpen(false);
      setEditingCl(null);
      setClForm(blankCL());
      fetchClassLevels();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setClSaving(false);
    }
  }

  async function deleteCL() {
    if (!deleteClId) return;
    const { error } = await supabase.from("school_class_levels").delete().eq("id", deleteClId);
    if (error) toast.error(error.message);
    else {
      toast.success("Class level deleted");
      fetchClassLevels();
    }
    setDeleteClId(null);
  }

  async function toggleCLActive(item: ClassLevel) {
    const { error } = await supabase
      .from("school_class_levels")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else setClassLevels((prev) =>
      prev.map((cl) => (cl.id === item.id ? { ...cl, is_active: !item.is_active } : cl))
    );
  }

  async function moveCL(id: string, direction: "up" | "down") {
    const filtered = classLevels.filter(
      (cl) =>
        clFilterEdu === "all" || cl.education_level_id === clFilterEdu
    );
    const idx = filtered.findIndex((cl) => cl.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === filtered.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const a = filtered[idx];
    const b = filtered[swapIdx];
    await Promise.all([
      supabase
        .from("school_class_levels")
        .update({ order_sequence: b.order_sequence })
        .eq("id", a.id),
      supabase
        .from("school_class_levels")
        .update({ order_sequence: a.order_sequence })
        .eq("id", b.id),
    ]);
    fetchClassLevels();
  }

  /* ═══════════════════════════════════════
     STREAMS
  ═══════════════════════════════════════ */
  const [streams, setStreams] = useState<Stream[]>([]);
  const [stLoading, setStLoading] = useState(false);
  const [stDialogOpen, setStDialogOpen] = useState(false);
  const [editingSt, setEditingSt] = useState<Stream | null>(null);
  const [deleteStId, setDeleteStId] = useState<string | null>(null);
  const [stForm, setStForm] = useState(blankSimple());
  const [stSaving, setStSaving] = useState(false);

  const fetchStreams = useCallback(async () => {
    if (!schoolId) return;
    setStLoading(true);
    const { data, error } = await supabase
      .from("school_streams")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load streams");
    else setStreams(data ?? []);
    setStLoading(false);
  }, [schoolId]);

  async function saveSt(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setStSaving(true);
    try {
      if (editingSt) {
        const { error } = await supabase
          .from("school_streams")
          .update({
            description: stForm.description.trim(),
          })
          .eq("id", editingSt.id);
        if (error) throw error;
        toast.success("Stream updated");
      } else {
        // Auto-generate letter-based name for new streams
        const usedLetters = streams.map((s) => s.name).filter((n) => n.length === 1);
        let nextLetter = "A";
        for (let i = 0; i < 26; i++) {
          const letter = String.fromCharCode(65 + i);
          if (!usedLetters.includes(letter)) {
            nextLetter = letter;
            break;
          }
        }

        const { error } = await supabase.from("school_streams").insert({
          school_id: schoolId,
          name: nextLetter,
          description: stForm.description.trim() || "",
          is_active: true,
        });
        if (error) throw error;
        toast.success("Stream created");
      }
      setStDialogOpen(false);
      setEditingSt(null);
      setStForm(blankSimple());
      fetchStreams();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setStSaving(false);
    }
  }

  async function deleteSt() {
    if (!deleteStId) return;
    const { error } = await supabase.from("school_streams").delete().eq("id", deleteStId);
    if (error) toast.error(error.message);
    else {
      toast.success("Stream deleted");
      fetchStreams();
    }
    setDeleteStId(null);
  }

  async function toggleStActive(item: Stream) {
    const { error } = await supabase
      .from("school_streams")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else setStreams((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, is_active: !item.is_active } : s))
    );
  }

  /* ═══════════════════════════════════════
     DEPARTMENTS
  ═══════════════════════════════════════ */
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dpLoading, setDpLoading] = useState(false);
  const [dpDialogOpen, setDpDialogOpen] = useState(false);
  const [editingDp, setEditingDp] = useState<Department | null>(null);
  const [deleteDpId, setDeleteDpId] = useState<string | null>(null);
  const [dpForm, setDpForm] = useState(blankSimple());
  const [dpSaving, setDpSaving] = useState(false);

  const fetchDepartments = useCallback(async () => {
    if (!schoolId) return;
    setDpLoading(true);
    const { data, error } = await supabase
      .from("school_departments")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load departments");
    else setDepartments(data ?? []);
    setDpLoading(false);
  }, [schoolId]);

  async function saveDp(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setDpSaving(true);
    try {
      if (editingDp) {
        const { error } = await supabase
          .from("school_departments")
          .update({
            name: dpForm.name.trim(),
            code: dpForm.code.trim() || null,
            description: dpForm.description.trim(),
          })
          .eq("id", editingDp.id);
        if (error) throw error;
        toast.success("Department updated");
      } else {
        const { error } = await supabase.from("school_departments").insert({
          school_id: schoolId,
          name: dpForm.name.trim(),
          code: dpForm.code.trim() || null,
          description: dpForm.description.trim(),
          is_active: true,
        });
        if (error) throw error;
        toast.success("Department created");
      }
      setDpDialogOpen(false);
      setEditingDp(null);
      setDpForm(blankSimple());
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setDpSaving(false);
    }
  }

  async function deleteDp() {
    if (!deleteDpId) return;
    const { error } = await supabase.from("school_departments").delete().eq("id", deleteDpId);
    if (error) toast.error(error.message);
    else {
      toast.success("Department deleted");
      fetchDepartments();
    }
    setDeleteDpId(null);
  }

  async function toggleDpActive(item: Department) {
    const { error } = await supabase
      .from("school_departments")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else setDepartments((prev) =>
      prev.map((d) => (d.id === item.id ? { ...d, is_active: !item.is_active } : d))
    );
  }

  /* ═══════════════════════════════════════
     RELIGIONS
  ═══════════════════════════════════════ */
  const [religions, setReligions] = useState<Religion[]>([]);
  const [rlLoading, setRlLoading] = useState(false);
  const [rlDialogOpen, setRlDialogOpen] = useState(false);
  const [editingRl, setEditingRl] = useState<Religion | null>(null);
  const [deleteRlId, setDeleteRlId] = useState<string | null>(null);
  const [rlForm, setRlForm] = useState(blankSimple());
  const [rlSaving, setRlSaving] = useState(false);

  const fetchReligions = useCallback(async () => {
    if (!schoolId) return;
    setRlLoading(true);
    const { data, error } = await supabase
      .from("school_religions")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load religions");
    else setReligions(data ?? []);
    setRlLoading(false);
  }, [schoolId]);

  async function saveRl(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setRlSaving(true);
    try {
      if (editingRl) {
        const { error } = await supabase
          .from("school_religions")
          .update({
            name: rlForm.name.trim(),
            code: rlForm.code.trim() || null,
            description: rlForm.description.trim(),
          })
          .eq("id", editingRl.id);
        if (error) throw error;
        toast.success("Religion updated");
      } else {
        const { error } = await supabase.from("school_religions").insert({
          school_id: schoolId,
          name: rlForm.name.trim(),
          code: rlForm.code.trim() || null,
          description: rlForm.description.trim(),
          is_active: true,
        });
        if (error) throw error;
        toast.success("Religion created");
      }
      setRlDialogOpen(false);
      setEditingRl(null);
      setRlForm(blankSimple());
      fetchReligions();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setRlSaving(false);
    }
  }

  async function deleteRl() {
    if (!deleteRlId) return;
    const { error } = await supabase.from("school_religions").delete().eq("id", deleteRlId);
    if (error) toast.error(error.message);
    else {
      toast.success("Religion deleted");
      fetchReligions();
    }
    setDeleteRlId(null);
  }

  async function toggleRlActive(item: Religion) {
    const { error } = await supabase
      .from("school_religions")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else setReligions((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, is_active: !item.is_active } : r))
    );
  }

  /* ═══════════════════════════════════════
     EDUCATION LEVEL SUBJECT PRESETS
  ═══════════════════════════════════════ */
  const [subjectPresets, setSubjectPresets] = useState<EducationLevelSubjectPreset[]>([]);
  const [operationalSubjects, setOperationalSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
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
  const [opSubjectsLoading, setOpSubjectsLoading] = useState(false);
  const [spLoading, setSpLoading] = useState(false);
  const [spDialogOpen, setSpDialogOpen] = useState(false);
  const [editingSp, setEditingSp] = useState<EducationLevelSubjectPreset | null>(null);
  const [deleteSpId, setDeleteSpId] = useState<string | null>(null);
  const [spForm, setSpForm] = useState(blankSubjectPreset());
  const [spSaving, setSpSaving] = useState(false);
  const [selectedPresetLevelId, setSelectedPresetLevelId] = useState<string>("");
  const [loadDefaultsConfirmOpen, setLoadDefaultsConfirmOpen] = useState(false);
  const [subjectTabValue, setSubjectTabValue] = useState("operational");

  /* ── Operational Subjects Filters ── */
  const [opSubjectsSearch, setOpSubjectsSearch] = useState<string>("");
  const [opEducationLevelFilter, setOpEducationLevelFilter] = useState<string>("all");
  const [opDepartmentFilter, setOpDepartmentFilter] = useState<string>("all");
  const [opStatusFilter, setOpStatusFilter] = useState<"all" | "active" | "inactive">("all");

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

  function getSubjectCodeForClass(subjectName: string, className: string) {
    const prefix = subjectName.replace(/\s+/g, "").slice(0, 3).toUpperCase();
    return `${prefix}-${className}`;
  }

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
    for (const row of data ?? []) {
      map[row.class_id] = row.class_id;
      teacherMap[row.class_id] = row.teacher_id || "";
    }

    setAssignmentsByClassId(map);
    setTeacherByClassId(teacherMap);
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
      const payload = selectedClasses.map((classItem) => ({
        school_id: schoolId,
        subject_id: applyTargetSubject.id,
        class_id: classItem.id,
        teacher_id: teacherByClassId[classItem.id] || null,
        subject_code: getSubjectCodeForClass(applyTargetSubject.name, classItem.name),
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

      if (!Number.isFinite(payload.order_sequence) || payload.order_sequence < 1) {
        toast.error("Order sequence must be at least 1");
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

    // Check if there are existing subjects
    if (subjectPresets.length > 0) {
      setLoadDefaultsConfirmOpen(true);
      return;
    }

    // No existing subjects, proceed directly
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
     Effects — fetch on schoolId ready
  ═══════════════════════════════════════ */
  useEffect(() => {
    if (schoolId) {
      fetchEducationLevels();
      fetchClassLevels();
      fetchStreams();
      fetchDepartments();
      fetchReligions();
      fetchOperationalSubjects();
      fetchTeachers();
      fetchClasses();
    }
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (educationLevels.length === 0) {
      if (selectedPresetLevelId) {
        setSelectedPresetLevelId("");
      }
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

  const isEmptySetup =
    !schoolLoading &&
    educationLevels.length === 0 &&
    classLevels.length === 0 &&
    streams.length === 0 &&
    departments.length === 0 &&
    religions.length === 0;

  /* ─────────────────────────────────────────
     Reusable table/list utilities
  ───────────────────────────────────────── */
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

  /* ─────────────────────────────────────────
     Filtered class levels list
  ───────────────────────────────────────── */
  const filteredCL =
    clFilterEdu === "all"
      ? classLevels
      : classLevels.filter((cl) => cl.education_level_id === clFilterEdu);

  const applyClassesForTarget = (() => {
    if (!applyTargetSubject?.education_level_id) {
      return [] as SchoolClass[];
    }

    const levelClassLevelIds = new Set(
      classLevels
        .filter((classLevel) => classLevel.education_level_id === applyTargetSubject.education_level_id)
        .map((classLevel) => classLevel.id)
    );

    return classes.filter((classItem) => levelClassLevelIds.has(classItem.class_level_id));
  })();

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
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
            <h1 className="text-2xl font-bold tracking-tight">School Structure</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your school&apos;s academic structure — education levels, class levels,
              streams, departments, and religions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/admin/school-config/result-settings";
              }}
              className="shrink-0"
            >
              Result Settings
            </Button>
            <Button onClick={() => setShowWizard(true)} className="shrink-0 gap-2">
              <Sparkles className="h-4 w-4" />
              Setup Wizard
            </Button>
          </div>
        </div>

        {/* ── Empty-state banner ── */}
        {isEmptySetup && (
          <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-semibold text-lg">No school structure yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Use the Setup Wizard to quickly configure your school&apos;s academic structure
              with smart presets, or add items manually using the tabs below.
            </p>
            <Button onClick={() => setShowWizard(true)} className="mt-2 gap-2">
              <Sparkles className="h-4 w-4" />
              Launch Setup Wizard
            </Button>
          </div>
        )}

        {/* ── Summary Stats ── */}
        {!isEmptySetup && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { count: educationLevels.length, label: "Education Levels", icon: <GraduationCap className="h-4 w-4" /> },
              { count: classLevels.length, label: "Class Levels", icon: <BookOpen className="h-4 w-4" /> },
              { count: streams.length, label: "Streams", icon: <Waves className="h-4 w-4" /> },
              { count: departments.length, label: "Departments", icon: <Building2 className="h-4 w-4" /> },
              { count: religions.length, label: "Religions", icon: <Church className="h-4 w-4" /> },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border bg-card p-4 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.count}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs defaultValue="education_levels">
          <TabsList className="h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="education_levels" className="gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" />
              Education Levels
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                {educationLevels.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="class_levels" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Class Levels
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                {classLevels.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="subjects" className="gap-1.5">
              <Library className="h-3.5 w-3.5" />
              Subjects
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                {operationalSubjects.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="streams" className="gap-1.5">
              <Waves className="h-3.5 w-3.5" />
              Streams
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                {streams.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Departments
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                {departments.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="religions" className="gap-1.5">
              <Church className="h-3.5 w-3.5" />
              Religions
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                {religions.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════
              TAB: EDUCATION LEVELS
          ══════════════════════════════════════ */}
          <TabsContent value="education_levels" className="mt-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div>
                  <h3 className="font-semibold text-sm">Education Levels</h3>
                  <p className="text-xs text-muted-foreground">
                    e.g. Primary, Junior Secondary, Senior Secondary
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingEl(null);
                    setElForm({ ...blankEL(), order_sequence: educationLevels.length + 1 });
                    setElDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Level
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left w-10">Order</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left hidden md:table-cell">Description</th>
                      <th className="px-4 py-2 text-left">Classes</th>
                      <th className="px-4 py-2 text-center">Active</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {elLoading ? (
                      <LoadingRow />
                    ) : educationLevels.length === 0 ? (
                      <EmptyRow message="No education levels yet. Click 'Add Level' to get started." />
                    ) : (
                      educationLevels.map((el, idx) => {
                        const classCount = classLevels.filter(
                          (cl) => cl.education_level_id === el.id
                        ).length;
                        return (
                          <tr key={el.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={() => moveEL(el.id, "up")}
                                  disabled={idx === 0}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <span className="text-xs text-center text-muted-foreground">
                                  {el.order_sequence}
                                </span>
                                <button
                                  onClick={() => moveEL(el.id, "down")}
                                  disabled={idx === educationLevels.length - 1}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium">{el.name}</td>
                            <td className="px-4 py-3">
                              {el.code ? (
                                <Badge variant="outline" className="text-xs font-mono">
                                  {el.code}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                              {el.description || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className="text-xs">
                                {classCount} class{classCount !== 1 ? "es" : ""}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Switch
                                checked={el.is_active}
                                onCheckedChange={() => toggleELActive(el)}
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
                                    setEditingEl(el);
                                    setElForm({
                                      name: el.name,
                                      code: el.code ?? "",
                                      description: el.description ?? "",
                                      order_sequence: el.order_sequence,
                                    });
                                    setElDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteElId(el.id)}
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

          {/* ══════════════════════════════════════
              TAB: CLASS LEVELS
          ══════════════════════════════════════ */}
          <TabsContent value="class_levels" className="mt-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
                <div>
                  <h3 className="font-semibold text-sm">Class Levels</h3>
                  <p className="text-xs text-muted-foreground">
                    e.g. JSS 1, JSS 2, SSS 1, Primary 3 — grouped under education levels
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={clFilterEdu} onValueChange={setClFilterEdu}>
                    <SelectTrigger className="h-8 text-xs w-44">
                      <SelectValue placeholder="Filter by level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      {educationLevels.map((el) => (
                        <SelectItem key={el.id} value={el.id}>
                          {el.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingCl(null);
                      setClForm({
                        ...blankCL(),
                        education_level_id: clFilterEdu !== "all" ? clFilterEdu : "",
                        order_sequence: filteredCL.length + 1,
                      });
                      setClDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Class
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left w-10">Order</th>
                      <th className="px-4 py-2 text-left">Class Name</th>
                      <th className="px-4 py-2 text-left">Education Level</th>
                      <th className="px-4 py-2 text-center">Active</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clLoading ? (
                      <LoadingRow />
                    ) : filteredCL.length === 0 ? (
                      <EmptyRow message="No class levels yet. Click 'Add Class' to get started." />
                    ) : (
                      filteredCL.map((cl, idx) => {
                        const eduLevel = educationLevels.find(
                          (el) => el.id === cl.education_level_id
                        );
                        return (
                          <tr key={cl.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={() => moveCL(cl.id, "up")}
                                  disabled={idx === 0}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <span className="text-xs text-center text-muted-foreground">
                                  {cl.order_sequence}
                                </span>
                                <button
                                  onClick={() => moveCL(cl.id, "down")}
                                  disabled={idx === filteredCL.length - 1}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium">{cl.name}</td>
                            <td className="px-4 py-3">
                              {eduLevel ? (
                                <Badge className="text-xs">{eduLevel.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">Unknown</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Switch
                                checked={cl.is_active}
                                onCheckedChange={() => toggleCLActive(cl)}
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
                                    setEditingCl(cl);
                                    setClForm({
                                      name: cl.name,
                                      education_level_id: cl.education_level_id,
                                      order_sequence: cl.order_sequence,
                                    });
                                    setClDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteClId(cl.id)}
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

          {/* ══════════════════════════════════════
              TAB: SUBJECTS (with nested tabs)
          ══════════════════════════════════════ */}
          <TabsContent value="subjects" className="mt-4">
            <Tabs value={subjectTabValue} onValueChange={setSubjectTabValue} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="operational" className="gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  Operational Subjects
                  <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                    {operationalSubjects.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="presets" className="gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Subject Presets
                  <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                    {subjectPresets.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* ──────────────────────────
                  NESTED TAB 1: OPERATIONAL SUBJECTS
              ────────────────────────── */}
              <TabsContent value="operational" className="space-y-4">
                {/* Header Section */}
                <div className="space-y-4">
                  <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/20 overflow-hidden">
                    <div className="px-6 py-5">
                      <div className="space-y-1.5">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          Subject Catalog
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Create and manage subjects across all education levels. Apply subjects to classes and assign instructors.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Cards - Enhanced with Icons */}
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

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => {
                        setEditingOperationalSubject(null);
                        setSubjectForm(blankOperationalSubject());
                        setSubjectDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" /> Add Subject
                    </Button>
                  </div>

                  {/* Filter Panel - Improved */}
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Filter Results</p>
                      {(opSubjectsSearch || opEducationLevelFilter !== "all" || opDepartmentFilter !== "all" || opStatusFilter !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setOpSubjectsSearch("");
                            setOpEducationLevelFilter("all");
                            setOpDepartmentFilter("all");
                            setOpStatusFilter("all");
                          }}
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                      {/* Search */}
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium">Search</Label>
                        <Input
                          placeholder="Subject name..."
                          value={opSubjectsSearch}
                          onChange={(e) => setOpSubjectsSearch(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Education Level */}
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium">Level</Label>
                        <Select value={opEducationLevelFilter} onValueChange={setOpEducationLevelFilter}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Levels</SelectItem>
                            {educationLevels.map((el) => (
                              <SelectItem key={el.id} value={el.id}>
                                {el.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Department */}
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium">Department</Label>
                        <Select value={opDepartmentFilter} onValueChange={setOpDepartmentFilter}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map((dp) => (
                              <SelectItem key={dp.id} value={dp.id}>
                                {dp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Status */}
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-medium">Status</Label>
                        <Select value={opStatusFilter} onValueChange={(val: any) => setOpStatusFilter(val)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="active">Active Only</SelectItem>
                            <SelectItem value="inactive">Inactive Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table - Desktop View */}
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
                        {opSubjectsLoading ? (
                          <LoadingRow />
                        ) : (() => {
                          const filtered = operationalSubjects.filter((s) => {
                            if (opSubjectsSearch && !s.name.toLowerCase().includes(opSubjectsSearch.toLowerCase())) return false;
                            if (opEducationLevelFilter !== "all" && s.education_level_id !== opEducationLevelFilter) return false;
                            if (opDepartmentFilter !== "all" && s.department_id !== opDepartmentFilter) return false;
                            if (opStatusFilter === "active" && !s.is_active) return false;
                            if (opStatusFilter === "inactive" && s.is_active) return false;
                            return true;
                          });

                          return filtered.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8">
                                <div className="flex flex-col items-center justify-center">
                                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-2" />
                                  <p className="text-sm text-muted-foreground">No subjects match your filters</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filtered.slice(0, 15).map((subject) => {
                              const level = educationLevels.find((el) => el.id === subject.education_level_id);
                              const department = departments.find((dp) => dp.id === subject.department_id);

                              return (
                                <tr key={subject.id} className="hover:bg-muted/50 transition-colors">
                                  <td className="px-4 py-3">
                                    <div>
                                      <p className="font-semibold text-sm">{subject.name}</p>
                                      {subject.religion_id && (
                                        <p className="text-xs text-muted-foreground mt-0.5">Religious subject</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{level?.name || "—"}</td>
                                  <td className="px-4 py-3 hidden lg:table-cell">
                                    {department?.name ? (
                                      <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200">
                                        {department.name}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {subject.is_optional ? (
                                      <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200">Optional</Badge>
                                    ) : (
                                      <Badge className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200">Core</Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Badge 
                                      variant={subject.is_active ? "default" : "outline"} 
                                      className={`text-xs ${subject.is_active ? 'bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-200' : 'bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200'}`}
                                    >
                                      {subject.is_active ? "✓ Active" : "Inactive"}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                          void openApplyDialog(subject);
                                        }}
                                      >
                                        Apply
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
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
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {operationalSubjects.length > 15 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground border-t bg-muted/30">
                      Showing first 15 subjects. Use filters to narrow down the list.
                    </div>
                  )}
                </div>

                {/* Card View - Mobile */}
                <div className="grid gap-3 grid-cols-1 sm:hidden">
                  {opSubjectsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
                          <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                          <div className="space-y-2">
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                            <div className="h-3 bg-muted rounded w-2/3"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (() => {
                    const filtered = operationalSubjects.filter((s) => {
                      if (opSubjectsSearch && !s.name.toLowerCase().includes(opSubjectsSearch.toLowerCase())) return false;
                      if (opEducationLevelFilter !== "all" && s.education_level_id !== opEducationLevelFilter) return false;
                      if (opDepartmentFilter !== "all" && s.department_id !== opDepartmentFilter) return false;
                      if (opStatusFilter === "active" && !s.is_active) return false;
                      if (opStatusFilter === "inactive" && s.is_active) return false;
                      return true;
                    });

                    return filtered.length === 0 ? (
                      <div className="rounded-lg border bg-card p-8 text-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No subjects match your filters</p>
                      </div>
                    ) : (
                      filtered.slice(0, 15).map((subject) => {
                        const level = educationLevels.find((el) => el.id === subject.education_level_id);
                        const department = departments.find((dp) => dp.id === subject.department_id);

                        return (
                          <div key={subject.id} className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm">{subject.name}</h4>
                                <p className="text-xs text-muted-foreground mt-1">{level?.name || "No Level"}</p>
                              </div>
                              <Badge 
                                className={`text-xs whitespace-nowrap ${subject.is_active ? 'bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-200' : 'bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200'}`}
                              >
                                {subject.is_active ? "✓ Active" : "Inactive"}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-4">
                              {subject.is_optional ? (
                                <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200">Optional</Badge>
                              ) : (
                                <Badge className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200">Core</Badge>
                              )}
                              {department && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200">
                                  {department.name}
                                </Badge>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => {
                                  void openApplyDialog(subject);
                                }}
                              >
                                Apply
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
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
                          </div>
                        );
                      })
                    );
                  })()}
                </div>
              </TabsContent>

              {/* ──────────────────────────
                  NESTED TAB 2: SUBJECT PRESETS
              ────────────────────────── */}
              <TabsContent value="presets" className="space-y-4">
                <div className="rounded-xl border bg-card overflow-hidden">
                  {/* Header Section */}
                  <div className="bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-950/20 dark:to-amber-950/10 px-6 py-4 border-b">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">Subject Preset Templates</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage reusable subject templates by education level for future onboarding and bulk setup.
                      </p>
                    </div>
                  </div>

                  {/* Level Selector & Selected Level Banner */}
                  <div className="px-6 py-4 border-b bg-muted/20 space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Select Education Level</Label>
                      <Select value={selectedPresetLevelId} onValueChange={setSelectedPresetLevelId}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Choose education level" />
                        </SelectTrigger>
                        <SelectContent>
                          {educationLevels.map((el) => (
                            <SelectItem key={el.id} value={el.id}>
                              {el.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Selected Level Banner */}
                    {selectedPresetLevelId && (
                      <div className="rounded-lg bg-gradient-to-r from-amber-100/80 to-amber-50/80 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-amber-200 dark:bg-amber-800/60 flex items-center justify-center">
                              <GraduationCap className="h-4 w-4 text-amber-800 dark:text-amber-200" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Working with</p>
                              <p className="font-semibold text-foreground">
                                {educationLevels.find((el) => el.id === selectedPresetLevelId)?.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                              {subjectPresets.length}
                            </p>
                            <p className="text-xs text-muted-foreground">Templates</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Conditional Display */}
                  <div className="px-6 py-4 border-b bg-muted/30 flex flex-col sm:flex-row gap-2">
                    {subjectPresets.length === 0 && selectedPresetLevelId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={loadDefaultSubjectsForPresetLevel}
                        className="gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Load Defaults
                      </Button>
                    )}
                    {schoolId && (
                      <BulkCreateSubjectsDialog
                        schoolId={schoolId}
                        onSuccess={() => {
                          fetchOperationalSubjects();
                        }}
                        educationLevels={educationLevels}
                        departments={departments}
                        religions={religions}
                        teachers={teachers}
                        subjectPresets={subjectPresets}
                      />
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingSp(null);
                        setSpForm({
                          ...blankSubjectPreset(),
                          order_sequence: subjectPresets.length + 1,
                        });
                        setSpDialogOpen(true);
                      }}
                      disabled={!selectedPresetLevelId}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" /> Add Template
                    </Button>
                  </div>

                  {/* Table */}
                  <div className="px-6 py-4 border-t">
                    {!selectedPresetLevelId ? (
                      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          Select an education level to view and manage its preset templates.
                        </p>
                      </div>
                    ) : spLoading ? (
                      <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : subjectPresets.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center space-y-2">
                        <p className="text-sm font-medium text-foreground">No templates yet</p>
                        <p className="text-xs text-muted-foreground">
                          Load defaults or add templates manually to get started.
                        </p>
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
                                    {preset.is_optional ? (
                                      <Badge variant="secondary" className="text-xs">Optional</Badge>
                                    ) : (
                                      <Badge className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100">Core</Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                                    {department ? (
                                      <span className="inline-block px-2 py-1 rounded bg-muted/50">{department.name}</span>
                                    ) : (
                                      <span className="text-muted-foreground/50">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                                    {religion ? (
                                      <span className="inline-block px-2 py-1 rounded bg-muted/50">{religion.name}</span>
                                    ) : (
                                      <span className="text-muted-foreground/50">—</span>
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
                                            department_id: preset.department_id ?? "",
                                            religion_id: preset.religion_id ?? "",
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
                                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        onClick={() => setDeleteSpId(preset.id)}
                                      >
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
          </TabsContent>

          {/* ══════════════════════════════════════
              TAB: STREAMS
          ══════════════════════════════════════ */}
          <TabsContent value="streams" className="mt-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div>
                  <h3 className="font-semibold text-sm">Streams</h3>
                  <p className="text-xs text-muted-foreground">
                    e.g. Science, Arts, Commercial
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingSt(null);
                    setStForm(blankSimple());
                    setStDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Stream
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left">Name (Letter)</th>
                      <th className="px-4 py-2 text-left hidden md:table-cell">Description</th>
                      <th className="px-4 py-2 text-center">Active</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stLoading ? (
                      <LoadingRow />
                    ) : streams.length === 0 ? (
                      <EmptyRow message="No streams configured yet." />
                    ) : (
                      streams.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                            {s.description || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Switch
                              checked={s.is_active}
                              onCheckedChange={() => toggleStActive(s)}
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
                                  setEditingSt(s);
                                  setStForm({
                                    name: s.name,
                                    code: "",
                                    description: s.description ?? "",
                                  });
                                  setStDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteStId(s.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════
              TAB: DEPARTMENTS
          ══════════════════════════════════════ */}
          <TabsContent value="departments" className="mt-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div>
                  <h3 className="font-semibold text-sm">Departments</h3>
                  <p className="text-xs text-muted-foreground">
                    e.g. Sciences, Arts & Humanities, Commercial Studies
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingDp(null);
                    setDpForm(blankSimple());
                    setDpDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Department
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left hidden md:table-cell">Description</th>
                      <th className="px-4 py-2 text-center">Active</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dpLoading ? (
                      <LoadingRow />
                    ) : departments.length === 0 ? (
                      <EmptyRow message="No departments configured yet." />
                    ) : (
                      departments.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{d.name}</td>
                          <td className="px-4 py-3">
                            {d.code ? (
                              <Badge variant="outline" className="text-xs font-mono">
                                {d.code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                            {d.description || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Switch
                              checked={d.is_active}
                              onCheckedChange={() => toggleDpActive(d)}
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
                                  setEditingDp(d);
                                  setDpForm({
                                    name: d.name,
                                    code: d.code ?? "",
                                    description: d.description ?? "",
                                  });
                                  setDpDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteDpId(d.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════
              TAB: RELIGIONS
          ══════════════════════════════════════ */}
          <TabsContent value="religions" className="mt-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div>
                  <h3 className="font-semibold text-sm">Religions</h3>
                  <p className="text-xs text-muted-foreground">
                    e.g. Christianity, Islam, Traditional Religion
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingRl(null);
                    setRlForm(blankSimple());
                    setRlDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Religion
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left hidden md:table-cell">Description</th>
                      <th className="px-4 py-2 text-center">Active</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rlLoading ? (
                      <LoadingRow />
                    ) : religions.length === 0 ? (
                      <EmptyRow message="No religions configured yet." />
                    ) : (
                      religions.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{r.name}</td>
                          <td className="px-4 py-3">
                            {r.code ? (
                              <Badge variant="outline" className="text-xs font-mono">
                                {r.code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                            {r.description || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Switch
                              checked={r.is_active}
                              onCheckedChange={() => toggleRlActive(r)}
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
                                  setEditingRl(r);
                                  setRlForm({
                                    name: r.name,
                                    code: r.code ?? "",
                                    description: r.description ?? "",
                                  });
                                  setRlDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteRlId(r.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingOperationalSubject ? "Edit Subject" : "Add Subject"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveOperationalSubject} className="space-y-4">
              <div>
                <Label>Subject Name *</Label>
                <Input
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="e.g. English Language"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Education Level *</Label>
                <Select
                  value={subjectForm.education_level_id}
                  onValueChange={(value) => setSubjectForm((current) => ({ ...current, education_level_id: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select education level" />
                  </SelectTrigger>
                  <SelectContent>
                    {educationLevels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={subjectForm.department_id || "none"}
                    onValueChange={(value) =>
                      setSubjectForm((current) => ({
                        ...current,
                        department_id: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Optional department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Religion</Label>
                  <Select
                    value={subjectForm.religion_id || "none"}
                    onValueChange={(value) =>
                      setSubjectForm((current) => ({
                        ...current,
                        religion_id: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Optional religion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {religions.map((religion) => (
                        <SelectItem key={religion.id} value={religion.id}>{religion.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Optional Subject</p>
                    <p className="text-xs text-muted-foreground">Affects all class assignments on save</p>
                  </div>
                  <Switch
                    checked={subjectForm.is_optional}
                    onCheckedChange={(checked) =>
                      setSubjectForm((current) => ({ ...current, is_optional: checked }))
                    }
                  />
                </div>

                <div className="rounded-md border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Show in operational flows</p>
                  </div>
                  <Switch
                    checked={subjectForm.is_active}
                    onCheckedChange={(checked) =>
                      setSubjectForm((current) => ({ ...current, is_active: checked }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSubjectDialogOpen(false);
                    setEditingOperationalSubject(null);
                    setSubjectForm(blankOperationalSubject());
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={subjectSaving || !subjectForm.name.trim() || !subjectForm.education_level_id}>
                  {subjectSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingOperationalSubject ? "Save Subject" : "Create Subject"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Apply Subject to Classes {applyTargetSubject ? `- ${applyTargetSubject.name}` : ""}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {applyClassesForTarget.length === 0 ? (
                <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No classes found under this subject's education level.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Select classes and assign teachers (optional per class).
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allIds = applyClassesForTarget.map((classItem) => classItem.id);
                        setSelectedClassIds(allIds);
                      }}
                    >
                      Select All
                    </Button>
                  </div>

                  <div className="max-h-80 overflow-y-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                          <th className="px-3 py-2 text-left w-14">Use</th>
                          <th className="px-3 py-2 text-left">Class</th>
                          <th className="px-3 py-2 text-left">Current Status</th>
                          <th className="px-3 py-2 text-left">Teacher</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {applyClassesForTarget.map((classItem) => {
                          const isSelected = selectedClassIds.includes(classItem.id);
                          const isAlreadyAssigned = Boolean(assignmentsByClassId[classItem.id]);

                          return (
                            <tr key={classItem.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    setSelectedClassIds((current) => {
                                      if (checked) {
                                        return Array.from(new Set([...current, classItem.id]));
                                      }
                                      return current.filter((id) => id !== classItem.id);
                                    });
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2 font-medium">{classItem.name}</td>
                              <td className="px-3 py-2">
                                {isAlreadyAssigned ? (
                                  <Badge variant="secondary" className="text-xs">Already assigned</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">New assignment</Badge>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <Select
                                  value={teacherByClassId[classItem.id] || "none"}
                                  onValueChange={(value) => {
                                    setTeacherByClassId((current) => ({
                                      ...current,
                                      [classItem.id]: value === "none" ? "" : value,
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs min-w-[180px]">
                                    <SelectValue placeholder="Unassigned" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {teachers.map((teacher) => (
                                      <SelectItem key={teacher.id} value={teacher.id}>
                                        {teacher.first_name} {teacher.last_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setApplyDialogOpen(false);
                  setApplyTargetSubject(null);
                  setSelectedClassIds([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={applySubjectToClasses}
                disabled={applyingSubject || selectedClassIds.length === 0 || !applyTargetSubject}
              >
                {applyingSubject && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Apply to Selected Classes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════
            DIALOGS — Education Level
        ═══════════════════════════════════════════════ */}
        <Dialog open={elDialogOpen} onOpenChange={setElDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingEl ? "Edit Education Level" : "Add Education Level"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={saveEL} className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={elForm.name}
                  onChange={(e) => setElForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Junior Secondary"
                  required
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Short Code</Label>
                  <Input
                    value={elForm.code}
                    onChange={(e) => setElForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="e.g. JSS"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Order Sequence</Label>
                  <Input
                    type="number"
                    min={1}
                    value={elForm.order_sequence}
                    onChange={(e) =>
                      setElForm((f) => ({ ...f, order_sequence: Number(e.target.value) }))
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={elForm.description}
                  onChange={(e) => setElForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setElDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={elSaving || !elForm.name.trim()}>
                  {elSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingEl ? "Save Changes" : "Create Level"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOGS — Class Level */}
        <Dialog open={clDialogOpen} onOpenChange={setClDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCl ? "Edit Class Level" : "Add Class Level"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveCL} className="space-y-4">
              <div>
                <Label>Education Level *</Label>
                <Select
                  value={clForm.education_level_id}
                  onValueChange={(v) => setClForm((f) => ({ ...f, education_level_id: v }))}
                  required
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select education level" />
                  </SelectTrigger>
                  <SelectContent>
                    {educationLevels.map((el) => (
                      <SelectItem key={el.id} value={el.id}>
                        {el.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class Name *</Label>
                <Input
                  value={clForm.name}
                  onChange={(e) => setClForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. JSS 1"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Order Sequence</Label>
                <Input
                  type="number"
                  min={1}
                  value={clForm.order_sequence}
                  onChange={(e) =>
                    setClForm((f) => ({ ...f, order_sequence: Number(e.target.value) }))
                  }
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setClDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={clSaving || !clForm.name.trim() || !clForm.education_level_id}
                >
                  {clSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingCl ? "Save Changes" : "Create Class"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOGS — Stream */}
        <Dialog open={stDialogOpen} onOpenChange={setStDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSt ? "Edit Stream" : "Add Stream"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveSt} className="space-y-4">
              {editingSt && (
                <div>
                  <Label>Stream Letter</Label>
                  <Input
                    value={stForm.name}
                    disabled
                    className="mt-1 bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Stream names are auto-generated as letters (A, B, C, etc.)</p>
                </div>
              )}
              <div>
                <Label>Description</Label>
                <Textarea
                  value={stForm.description}
                  onChange={(e) => setStForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={stSaving}>
                  {stSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingSt ? "Save Changes" : "Create Stream"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOGS — Department */}
        <Dialog open={dpDialogOpen} onOpenChange={setDpDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDp ? "Edit Department" : "Add Department"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveDp} className="space-y-4">
              <div>
                <Label>Department Name *</Label>
                <Input
                  value={dpForm.name}
                  onChange={(e) => setDpForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sciences"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Short Code</Label>
                <Input
                  value={dpForm.code}
                  onChange={(e) => setDpForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. SCI"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={dpForm.description}
                  onChange={(e) => setDpForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDpDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={dpSaving || !dpForm.name.trim()}>
                  {dpSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingDp ? "Save Changes" : "Create Department"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOGS — Religion */}
        <Dialog open={rlDialogOpen} onOpenChange={setRlDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRl ? "Edit Religion" : "Add Religion"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveRl} className="space-y-4">
              <div>
                <Label>Religion Name *</Label>
                <Input
                  value={rlForm.name}
                  onChange={(e) => setRlForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Christianity"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Short Code</Label>
                <Input
                  value={rlForm.code}
                  onChange={(e) => setRlForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. CHR"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={rlForm.description}
                  onChange={(e) => setRlForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRlDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={rlSaving || !rlForm.name.trim()}>
                  {rlSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingRl ? "Save Changes" : "Create Religion"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOGS — Education Level Subject Preset */}
        <Dialog open={spDialogOpen} onOpenChange={setSpDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSp ? "Edit Level Subject" : "Add Level Subject"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveSubjectPreset} className="space-y-4">
              <div>
                <Label>Subject Name *</Label>
                <Input
                  value={spForm.name}
                  onChange={(e) => setSpForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. English Language"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Order Sequence</Label>
                <Input
                  type="number"
                  min={1}
                  value={spForm.order_sequence}
                  onChange={(e) =>
                    setSpForm((f) => ({ ...f, order_sequence: Number(e.target.value) || 1 }))
                  }
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={spForm.department_id || "none"}
                    onValueChange={(value) =>
                      setSpForm((f) => ({ ...f, department_id: value === "none" ? "" : value }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Optional department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Religion</Label>
                  <Select
                    value={spForm.religion_id || "none"}
                    onValueChange={(value) =>
                      setSpForm((f) => ({ ...f, religion_id: value === "none" ? "" : value }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Optional religion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No religion</SelectItem>
                      {religions.map((religion) => (
                        <SelectItem key={religion.id} value={religion.id}>
                          {religion.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Optional Subject</p>
                    <p className="text-xs text-muted-foreground">Mark as optional in setup</p>
                  </div>
                  <Switch
                    checked={spForm.is_optional}
                    onCheckedChange={(checked) => setSpForm((f) => ({ ...f, is_optional: checked }))}
                  />
                </div>

                <div className="rounded-md border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Include in setup lists</p>
                  </div>
                  <Switch
                    checked={spForm.is_active}
                    onCheckedChange={(checked) => setSpForm((f) => ({ ...f, is_active: checked }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSpDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={spSaving || !spForm.name.trim()}>
                  {spSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingSp ? "Save Changes" : "Create Subject"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════
            DELETE CONFIRM DIALOGS
        ═══════════════════════════════════════════════ */}
        <AlertDialog open={!!deleteElId} onOpenChange={() => setDeleteElId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Education Level
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will also delete all class levels under this education level. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteEL}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteClId} onOpenChange={() => setDeleteClId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Class Level
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this class level? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteCL} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteStId} onOpenChange={() => setDeleteStId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Stream
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this stream? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteSt} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteDpId} onOpenChange={() => setDeleteDpId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Department
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this department? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteDp} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteRlId} onOpenChange={() => setDeleteRlId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Religion
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this religion? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteRl} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteSpId} onOpenChange={() => setDeleteSpId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Level Subject
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this preset subject? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteSubjectPreset} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={loadDefaultsConfirmOpen} onOpenChange={setLoadDefaultsConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Load Default Subjects
              </AlertDialogTitle>
              <AlertDialogDescription>
                This education level already has {subjectPresets.length} subject{subjectPresets.length !== 1 ? 's' : ''}. Loading defaults will add new subjects and update existing ones with matching names. Continue?
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

        {/* ── Wizard ── */}
        {showWizard && (
          <SchoolSetupWizard
            isOpen={showWizard}
            onClose={() => setShowWizard(false)}
            onComplete={() => {
              fetchEducationLevels();
              fetchClassLevels();
              fetchStreams();
              fetchDepartments();
              fetchReligions();
              fetchOperationalSubjects();
              fetchTeachers();
              fetchClasses();
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
