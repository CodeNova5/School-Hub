"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  Loader2,
  Save,
  BookOpen,
  GraduationCap,
  Building2,
  Church,
  Sparkles,
  Pencil,
  X,
  Users,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Hash,
  Layers,
  Edit3,
  BarChart3,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type {
  Subject,
  Class as SchoolClass,
  Teacher,
  ClassLevel,
  EducationLevel,
  Department,
  Religion,
} from "@/lib/types";
import { generateUniqueSubjectCode } from "@/lib/subject-code-generator";
import { SubjectAnalyticsTab } from "@/components/subject-analytics-tab";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface SubjectClassAllocation {
  id?: string;
  class_id: string;
  teacher_id: string | null;
  subject_code: string;
  is_optional: boolean;
  is_active: boolean;
  is_modified?: boolean;
}

interface SubjectWithRelations extends Subject {
  education_level?: EducationLevel;
  department?: Department;
  religion?: Religion;
}

interface TeacherAssignment {
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  subjectCode: string;
}

/* ─────────────────────────────────────────────
   Page Component
───────────────────────────────────────────── */
export default function SubjectManagementPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectId = params.id as string;
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  /* ── Tab State ── */
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  /* ── Core Data ── */
  const [subject, setSubject] = useState<SubjectWithRelations | null>(null);
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [religions, setReligions] = useState<Religion[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [targetClasses, setTargetClasses] = useState<SchoolClass[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);

  /* ── Loading States ── */
  const [pageLoading, setPageLoading] = useState(true);
  const [savingSubject, setSavingSubject] = useState(false);

  /* ── Edit Form State ── */
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    education_level_id: "",
    department_id: "",
    religion_id: "",
    is_optional: false,
  });

  /* ── Allocations State ── */
  const [allocations, setAllocations] = useState<Record<string, SubjectClassAllocation>>({});
  const [initialAllocationsCount, setInitialAllocationsCount] = useState(0);
  const [savingAllocations, setSavingAllocations] = useState(false);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  /* ── Delete State ── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ── Stats ── */
  const [totalStudents, setTotalStudents] = useState(0);
  const [uniqueTeachers, setUniqueTeachers] = useState(0);

  /* ═══════════════════════════════════════
     DATA LOADING
  ═══════════════════════════════════════ */
  const loadSubject = useCallback(async () => {
    if (!schoolId || !subjectId) return;
    setPageLoading(true);

    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*, education_level:school_education_levels(*), department:school_departments(*), religion:school_religions(*)")
        .eq("id", subjectId)
        .eq("school_id", schoolId)
        .single();

      if (error || !data) {
        toast.error("Subject not found");
        router.push("/admin/subjects");
        return;
      }

      setSubject(data as SubjectWithRelations);
      setEditForm({
        name: data.name,
        education_level_id: data.education_level_id || "",
        department_id: data.department_id || "",
        religion_id: data.religion_id || "",
        is_optional: data.is_optional,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load subject");
    } finally {
      setPageLoading(false);
    }
  }, [schoolId, subjectId, router]);

  const loadReferenceData = useCallback(async () => {
    if (!schoolId) return;

    const [elRes, deptRes, relRes, teacherRes, clRes] = await Promise.all([
      supabase.from("school_education_levels").select("*").eq("school_id", schoolId).order("order_sequence"),
      supabase.from("school_departments").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("school_religions").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("teachers").select("id, first_name, last_name, staff_id").eq("school_id", schoolId).order("first_name"),
      supabase.from("school_class_levels").select("*").eq("school_id", schoolId).order("order_sequence"),
    ]);

    setEducationLevels((elRes.data ?? []) as EducationLevel[]);
    setDepartments((deptRes.data ?? []) as Department[]);
    setReligions((relRes.data ?? []) as Religion[]);
    setTeachers((teacherRes.data ?? []) as Teacher[]);
    setClassLevels((clRes.data ?? []) as ClassLevel[]);
  }, [schoolId]);

  const loadAllocations = useCallback(async () => {
    if (!schoolId || !subjectId || !subject) return;

    setLoadingAllocations(true);
    try {
      // Guard: subject needs an education level to find matching classes
      if (!subject.education_level_id) {
        setTargetClasses([]);
        setTotalStudents(0);
        setUniqueTeachers(0);
        setInitialAllocationsCount(0);
        setAllocations({});
        return;
      }

      // Find class levels for this subject's education level
      const { data: levelData } = await supabase
        .from("school_class_levels")
        .select("id")
        .eq("education_level_id", subject.education_level_id);

      const targetLevelIds = new Set((levelData ?? []).map((l: { id: string }) => l.id));

      // Fetch physical classes mapped to those tracks
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, class_level_id")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });

      const filteredClasses = (classData ?? []).filter(
        (c: { class_level_id: string }) => targetLevelIds.has(c.class_level_id)
      ) as SchoolClass[];
      setTargetClasses(filteredClasses);

      // Calculate total students across these classes
      const { data: studentCountData } = await supabase
        .from("students")
        .select("id, class_id")
        .eq("school_id", schoolId)
        .in("class_id", filteredClasses.map((c) => c.id));

      setTotalStudents(studentCountData?.length ?? 0);

      // Pull existing allocations
      const { data: existingAllocs } = await supabase
        .from("subject_classes")
        .select("id, class_id, teacher_id, subject_code, is_optional, is_active")
        .eq("school_id", schoolId)
        .eq("subject_id", subjectId);

      const allocationMap: Record<string, SubjectClassAllocation> = {};
      filteredClasses.forEach((classItem: SchoolClass) => {
        allocationMap[classItem.id] = {
          class_id: classItem.id,
          teacher_id: null,
          subject_code: "",
          is_optional: subject.is_optional,
          is_active: false,
        };
      });

      let counter = 0;
      const teacherIds = new Set<string>();
      if (existingAllocs && existingAllocs.length > 0) {
        existingAllocs.forEach(
          (record: {
            id?: string;
            class_id: string;
            teacher_id: string | null;
            subject_code: string;
            is_optional: boolean;
            is_active: boolean;
          }) => {
            if (allocationMap[record.class_id]) {
              allocationMap[record.class_id] = {
                id: record.id,
                class_id: record.class_id,
                teacher_id: record.teacher_id,
                subject_code: record.subject_code,
                is_optional: record.is_optional,
                is_active: true,
              };
              counter++;
              if (record.teacher_id) teacherIds.add(record.teacher_id);
            }
          }
        );
      }

      setUniqueTeachers(teacherIds.size);
      setInitialAllocationsCount(counter);
      setAllocations(allocationMap);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load class assignments");
    } finally {
      setLoadingAllocations(false);
    }
  }, [schoolId, subjectId, subject]);

  useEffect(() => {
    if (schoolId) {
      loadSubject();
      loadReferenceData();
    }
  }, [schoolId, loadSubject, loadReferenceData]);

  useEffect(() => {
    if (subject) {
      loadAllocations();
    }
  }, [subject, loadAllocations]);

  /* ═══════════════════════════════════════
     SUBJECT EDIT HANDLERS
  ═══════════════════════════════════════ */
  const handleEditFormChange = (field: string, value: any) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveSubjectChanges = async () => {
    if (!schoolId || !subject) return;

    if (!editForm.name.trim()) {
      toast.error("Subject name is required");
      return;
    }

    setSavingSubject(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        education_level_id: editForm.education_level_id || null,
        department_id: editForm.department_id || null,
        religion_id: editForm.religion_id || null,
        is_optional: editForm.is_optional,
      };

      const { error: updateError } = await supabase
        .from("subjects")
        .update(payload)
        .eq("id", subject.id)
        .eq("school_id", schoolId);

      if (updateError) throw updateError;

      // Propagate to existing class assignments
      const { error: propagateError } = await supabase
        .from("subject_classes")
        .update({
          department_id: payload.department_id,
          religion_id: payload.religion_id,
          is_optional: payload.is_optional,
        })
        .eq("school_id", schoolId)
        .eq("subject_id", subject.id);

      if (propagateError) throw propagateError;

      toast.success("Subject updated and class assignments synchronized");
      setIsEditing(false);
      await loadSubject();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update subject");
    } finally {
      setSavingSubject(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (subject) {
      setEditForm({
        name: subject.name,
        education_level_id: subject.education_level_id || "",
        department_id: subject.department_id || "",
        religion_id: subject.religion_id || "",
        is_optional: subject.is_optional,
      });
    }
  };

  /* ═══════════════════════════════════════
     ALLOCATION HANDLERS
  ═══════════════════════════════════════ */
  const handleToggleParticipation = (classId: string, checked: boolean) => {
    setAllocations((prev) => {
      const target = prev[classId];
      let trackingCode = target.subject_code;
      if (checked && !trackingCode && subject) {
        const targetClassName = targetClasses.find((c) => c.id === classId)?.name || "RM";
        trackingCode = generateUniqueSubjectCode(subject.name, targetClassName, []);
      }
      return {
        ...prev,
        [classId]: {
          ...target,
          is_active: checked,
          subject_code: trackingCode,
          is_modified: true,
        },
      };
    });
  };

  const handleValueChange = (classId: string, fields: Partial<SubjectClassAllocation>) => {
    setAllocations((prev) => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        ...fields,
        is_modified: true,
      },
    }));
  };

  const applyBulkTeacher = (teacherId: string) => {
    setAllocations((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((classId) => {
        if (updated[classId].is_active) {
          updated[classId] = {
            ...updated[classId],
            teacher_id: teacherId === "clear" ? null : teacherId,
            is_modified: true,
          };
        }
      });
      return updated;
    });
    toast.success("Teacher assigned to all active classes");
  };

  const saveAllAllocations = async () => {
    if (!schoolId || !subject) return;

    setSavingAllocations(true);
    try {
      const allocationsList = Object.values(allocations);

      const activePayloads = allocationsList
        .filter((a) => a.is_active && a.is_modified)
        .map((a) => ({
          school_id: schoolId,
          subject_id: subject.id,
          class_id: a.class_id,
          teacher_id: a.teacher_id,
          subject_code:
            a.subject_code.trim() ||
            generateUniqueSubjectCode(
              subject.name,
              targetClasses.find((tc) => tc.id === a.class_id)?.name || "RM",
              []
            ),
          department_id: subject.department_id || null,
          religion_id: subject.religion_id || null,
          is_optional: a.is_optional,
          is_active: true,
        }));

      const disabledClassIds = allocationsList
        .filter((a) => !a.is_active && a.is_modified)
        .map((a) => a.class_id);

      if (disabledClassIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("subject_classes")
          .delete()
          .eq("school_id", schoolId)
          .eq("subject_id", subject.id)
          .in("class_id", disabledClassIds);

        if (deleteError) throw deleteError;
      }

      if (activePayloads.length > 0) {
        const { error: upsertError } = await supabase
          .from("subject_classes")
          .upsert(activePayloads, {
            onConflict: "school_id,subject_id,class_id",
            ignoreDuplicates: false,
          });

        if (upsertError) throw upsertError;
      }

      toast.success("Class assignments saved successfully");
      await loadAllocations();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save assignments");
    } finally {
      setSavingAllocations(false);
    }
  };

  /* ═══════════════════════════════════════
     DELETE HANDLER
  ═══════════════════════════════════════ */
  const handleDeleteSubject = async () => {
    if (!schoolId || !subject) return;

    setDeleting(true);
    try {
      // Delete all subject_class assignments first
      const { error: scDeleteError } = await supabase
        .from("subject_classes")
        .delete()
        .eq("school_id", schoolId)
        .eq("subject_id", subject.id);

      if (scDeleteError) throw scDeleteError;

      // Delete the subject itself
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", subject.id)
        .eq("school_id", schoolId);

      if (error) throw error;

      toast.success("Subject deleted successfully");
      router.push("/admin/subjects");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete subject");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  /* ═══════════════════════════════════════
     DERIVED VALUES
  ═══════════════════════════════════════ */
  const trackingModifiedCount = Object.values(allocations).filter((a) => a.is_modified).length;
  const activeAllocations = Object.values(allocations).filter((a) => a.is_active);

  // Compute unique teachers from live allocations (including unsaved changes)
  const liveUniqueTeachers = new Set(
    activeAllocations
      .filter((a) => a.teacher_id)
      .map((a) => a.teacher_id)
  ).size;

  /* ── Loading State ── */
  if (schoolLoading || pageLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Loading subject</p>
              <p className="text-xs text-muted-foreground">Fetching subject details and class assignments</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!subject) return null;

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  return (
    <DashboardLayout role="admin">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/subjects")}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
              <p className="text-sm text-muted-foreground">
                {subject.education_level?.name || "No level"} · {subject.is_optional ? "Elective" : "Core"} Subject
              </p>
            </div>
          </div>
          <Badge
            variant={subject.is_active ? "default" : "outline"}
            className={`text-xs px-3 py-1.5 ${
              subject.is_active
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-700 border-slate-200"
            }`}
          >
            {subject.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-blue-700">{targetClasses.length}</p>
                <p className="text-xs text-muted-foreground">Classes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-700">{totalStudents}</p>
                <p className="text-xs text-muted-foreground">Students</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <UserCheck className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-700">{uniqueTeachers}</p>
                <p className="text-xs text-muted-foreground">Teachers</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-purple-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-purple-700">{initialAllocationsCount}</p>
                <p className="text-xs text-muted-foreground">Active Assignments</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="border-b bg-muted/10">
              <TabsList className="w-full flex bg-transparent p-0 h-auto rounded-none overflow-x-auto">
                <TabsTrigger
                  value="overview"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/20 py-3 text-sm font-medium transition-colors hover:bg-muted/10 flex items-center justify-center gap-2"
                >
                  <Layers className="h-4 w-4" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger
                  value="classes"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/20 py-3 text-sm font-medium transition-colors hover:bg-muted/10 flex items-center justify-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Classes</span>
                  <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                    {initialAllocationsCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="teachers"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/20 py-3 text-sm font-medium transition-colors hover:bg-muted/10 flex items-center justify-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  <span>Teachers</span>
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/20 py-3 text-sm font-medium transition-colors hover:bg-muted/10 flex items-center justify-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              {/* ════════════════════════════
                  TAB: OVERVIEW
              ════════════════════════════ */}
              <TabsContent value="overview" className="space-y-6 focus-visible:outline-none mt-0">
                {/* Subject Details Card */}
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 p-5">
                    <div>
                      <CardTitle className="text-base font-bold">Subject Details</CardTitle>
                      <CardDescription>Manage the core properties of this subject</CardDescription>
                    </div>
                    {!isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="gap-2 rounded-xl"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-6">
                    {isEditing ? (
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-muted-foreground">Subject Name *</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => handleEditFormChange("name", e.target.value)}
                            placeholder="e.g. Mathematics"
                            className="h-10 rounded-xl"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Education Level</Label>
                            <Select
                              value={editForm.education_level_id}
                              onValueChange={(value) => handleEditFormChange("education_level_id", value)}
                            >
                              <SelectTrigger className="h-10 rounded-xl">
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {educationLevels.map((el) => (
                                  <SelectItem key={el.id} value={el.id}>
                                    {el.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Department</Label>
                            <Select
                              value={editForm.department_id}
                              onValueChange={(value) => handleEditFormChange("department_id", value)}
                            >
                              <SelectTrigger className="h-10 rounded-xl">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Religious Alignment</Label>
                            <Select
                              value={editForm.religion_id}
                              onValueChange={(value) => handleEditFormChange("religion_id", value)}
                            >
                              <SelectTrigger className="h-10 rounded-xl">
                                <SelectValue placeholder="Select religion" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {religions.map((rel) => (
                                  <SelectItem key={rel.id} value={rel.id}>
                                    {rel.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Subject Type</Label>
                            <div className="flex items-center gap-3 h-10 px-3 rounded-xl border bg-background">
                              <Switch
                                checked={editForm.is_optional}
                                onCheckedChange={(checked) => handleEditFormChange("is_optional", checked)}
                              />
                              <span className="text-sm">{editForm.is_optional ? "Elective" : "Core (Compulsory)"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEdit}
                            className="rounded-xl gap-2"
                            disabled={savingSubject}
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveSubjectChanges}
                            className="rounded-xl gap-2"
                            disabled={savingSubject}
                          >
                            {savingSubject ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject Name</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{subject.name}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Education Level</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {subject.education_level?.name || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {subject.department?.name ? (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-900">
                                  {subject.department.name}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Religious Alignment</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {subject.religion?.name ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                                  {subject.religion.name}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
                            <p className="mt-1">
                              {subject.is_optional ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-900">Elective</Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-900">Core</Badge>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                            <p className="mt-1">
                              <Badge
                                variant={subject.is_active ? "default" : "outline"}
                                className={
                                  subject.is_active
                                    ? "bg-emerald-100 text-emerald-900"
                                    : "bg-red-100 text-red-900"
                                }
                              >
                                {subject.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</p>
                            <p className="mt-1 text-sm text-foreground">
                              {new Date(subject.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Class Assignment Summary */}
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="border-b bg-muted/20 p-5">
                    <CardTitle className="text-base font-bold">Class Coverage</CardTitle>
                    <CardDescription>Which classes this subject is assigned to</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {activeAllocations.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Not assigned to any classes yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Go to the Classes tab to assign this subject to classes
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {activeAllocations.map((alloc) => {
                          const classItem = targetClasses.find((c) => c.id === alloc.class_id);
                          const teacher = teachers.find((t) => t.id === alloc.teacher_id);
                          return (
                            <div
                              key={alloc.class_id}
                              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{classItem?.name || "Unknown"}</span>
                                {alloc.subject_code && (
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {alloc.subject_code}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {teacher ? (
                                  <span className="flex items-center gap-1">
                                    <UserCheck className="h-3 w-3" />
                                    {teacher.first_name} {teacher.last_name}
                                  </span>
                                ) : (
                                  <span className="italic">No teacher assigned</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-red-200 bg-red-50/30 shadow-sm">
                  <CardHeader className="border-b border-red-100 bg-red-50/50 p-5">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <CardTitle className="text-base font-bold text-red-900">Danger Zone</CardTitle>
                        <CardDescription className="text-sm text-red-800">
                          Irreversible actions for this subject record
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-white p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-red-900">Delete Subject</p>
                        <p className="text-xs text-red-700">
                          Permanently remove {subject.name} and all its class assignments. This cannot be undone.
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="rounded-xl shrink-0"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ════════════════════════════
                  TAB: CLASSES
              ════════════════════════════ */}
              <TabsContent value="classes" className="space-y-4 focus-visible:outline-none mt-0">
                {/* Macro Actions Bar */}
                <div className="bg-muted/20 border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Bulk Assign Teacher:</span>
                    <Select onValueChange={applyBulkTeacher}>
                      <SelectTrigger className="h-9 w-full sm:w-[240px] bg-background rounded-xl">
                        <SelectValue placeholder="Assign to all active classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clear">✕ Unassign All</SelectItem>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.first_name} {t.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    {trackingModifiedCount > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap"
                      >
                        ⚠️ {trackingModifiedCount} unsaved change{trackingModifiedCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Button
                      onClick={saveAllAllocations}
                      disabled={trackingModifiedCount === 0 || savingAllocations}
                      className="rounded-xl gap-2"
                    >
                      {savingAllocations ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Assignments
                    </Button>
                  </div>
                </div>

                {/* Allocations Matrix */}
                <div className="border rounded-xl bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b bg-muted/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Class Assignment Matrix</h3>
                        <p className="text-xs text-muted-foreground">
                          Toggle classes to assign this subject, select teachers, and set subject codes
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {targetClasses.length} available classes
                      </Badge>
                    </div>
                  </div>

                  {loadingAllocations ? (
                    <div className="p-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mt-2">Loading assignments...</p>
                    </div>
                  ) : targetClasses.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground text-sm space-y-2">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p>No classes match this subject&apos;s education level</p>
                      <p className="text-xs">Create classes under the matching education level in School Config</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {targetClasses.map((classItem) => {
                        const current = allocations[classItem.id];
                        if (!current) return null;

                        return (
                          <div
                            key={classItem.id}
                            className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                              current.is_active
                                ? "bg-card hover:bg-muted/5"
                                : "bg-muted/10 opacity-70"
                            }`}
                          >
                            {/* Class + Toggle */}
                            <div className="flex items-center gap-4 min-w-[200px]">
                              <Switch
                                id={`switch-${classItem.id}`}
                                checked={current.is_active}
                                onCheckedChange={(checked) => handleToggleParticipation(classItem.id, checked)}
                              />
                              <div>
                                <Label
                                  htmlFor={`switch-${classItem.id}`}
                                  className="font-bold text-sm cursor-pointer block"
                                >
                                  {classItem.name}
                                </Label>
                                <span className="text-[11px] text-muted-foreground block">
                                  {current.is_active ? (
                                    <span className="text-emerald-600 flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Assigned
                                    </span>
                                  ) : (
                                    "Not assigned"
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Active Controls */}
                            {current.is_active ? (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                                {/* Teacher */}
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                                    <UserCheck className="h-3 w-3" /> Teacher
                                  </span>
                                  <Select
                                    value={current.teacher_id || "unassigned"}
                                    onValueChange={(val) =>
                                      handleValueChange(classItem.id, {
                                        teacher_id: val === "unassigned" ? null : val,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-9 text-xs rounded-xl">
                                      <SelectValue placeholder="No teacher" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">Unassigned</SelectItem>
                                      {teachers.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                          {t.first_name} {t.last_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Subject Code */}
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                                    <Hash className="h-3 w-3" /> Subject Code
                                  </span>
                                  <Input
                                    type="text"
                                    value={current.subject_code}
                                    onChange={(e) =>
                                      handleValueChange(classItem.id, {
                                        subject_code: e.target.value.toUpperCase(),
                                      })
                                    }
                                    className="h-9 text-xs font-mono rounded-xl"
                                    placeholder="e.g. MATH-JSS1"
                                  />
                                </div>

                                {/* Optional Toggle */}
                                <div className="flex flex-col justify-center space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                    Type
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={current.is_optional}
                                      onCheckedChange={(checked) =>
                                        handleValueChange(classItem.id, {
                                          is_optional: checked,
                                        })
                                      }
                                      className="scale-75"
                                    />
                                    <span className="text-xs">
                                      {current.is_optional ? "Elective" : "Core"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 text-xs text-muted-foreground italic flex items-center justify-end pr-2 h-9">
                                Subject not assigned to this class
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ════════════════════════════
                  TAB: TEACHERS
              ════════════════════════════ */}
              <TabsContent value="teachers" className="space-y-4 focus-visible:outline-none mt-0">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="border-b bg-muted/20 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold">Teachers Assigned to This Subject</CardTitle>
                        <CardDescription>
                          Teachers currently instructing {subject.name} across all classes
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {liveUniqueTeachers} teacher{liveUniqueTeachers !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {(() => {
                      // Build teacher -> [classes] map
                      const teacherMap: Record<
                        string,
                        { teacher: Teacher; assignments: { className: string; subjectCode: string }[] }
                      > = {};

                      activeAllocations.forEach((alloc) => {
                        if (!alloc.teacher_id) return;
                        const teacher = teachers.find((t) => t.id === alloc.teacher_id);
                        if (!teacher) return;

                        if (!teacherMap[alloc.teacher_id]) {
                          teacherMap[alloc.teacher_id] = { teacher, assignments: [] };
                        }
                        teacherMap[alloc.teacher_id].assignments.push({
                          className: targetClasses.find((c) => c.id === alloc.class_id)?.name || "Unknown",
                          subjectCode: alloc.subject_code,
                        });
                      });

                      const entries = Object.values(teacherMap);

                      if (entries.length === 0) {
                        return (
                          <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center">
                            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No teachers assigned yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Assign teachers in the Classes tab
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {entries.map(({ teacher, assignments }) => (
                            <div
                              key={teacher.id}
                              className="rounded-xl border bg-card overflow-hidden hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-3 px-4 py-3 bg-muted/10 border-b">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                  {teacher.first_name[0]}
                                  {teacher.last_name[0]}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm">
                                    {teacher.first_name} {teacher.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {assignments.length} class{assignments.length > 1 ? "es" : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="p-3 flex flex-wrap gap-2">
                                {assignments.map((a, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 rounded-lg border px-3 py-1.5 bg-muted/10"
                                  >
                                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-medium">{a.className}</span>
                                    {a.subjectCode && (
                                      <Badge variant="outline" className="text-[10px] font-mono px-1 h-4">
                                        {a.subjectCode}
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Unassigned Classes */}
                {(() => {
                  const unassignedAllocs = activeAllocations.filter((a) => !a.teacher_id);
                  if (unassignedAllocs.length === 0) return null;

                  return (
                    <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
                      <CardHeader className="border-b border-amber-100 p-5">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <CardTitle className="text-sm font-semibold text-amber-900">
                            Classes Without Teachers ({unassignedAllocs.length})
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {unassignedAllocs.map((alloc) => {
                            const classItem = targetClasses.find((c) => c.id === alloc.class_id);
                            return (
                              <Badge key={alloc.class_id} variant="outline" className="bg-white border-amber-300 text-amber-800">
                                {classItem?.name || "Unknown"}
                              </Badge>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              {/* ════════════════════════════
                  TAB: ANALYTICS
              ════════════════════════════ */}
              <TabsContent value="analytics" className="focus-visible:outline-none mt-0">
                {schoolId && subjectId && (
                  <SubjectAnalyticsTab
                    subjectId={subjectId}
                    schoolId={schoolId}
                    subjectName={subject.name}
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Delete Subject</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete <span className="font-semibold text-red-700">{subject.name}</span>?
              This will permanently remove the subject and all its class assignments, results, and timetable entries.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubject}
              disabled={deleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
