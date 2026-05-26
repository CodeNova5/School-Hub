"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Save,
  Layers,
  UserPlus,
  Hash,
  CheckCircle2,
  AlertCircle,
  Edit2,
  X
} from "lucide-react";
import type { Subject, Class as SchoolClass, Teacher, ClassLevel, Department, Religion, EducationLevel } from "@/lib/types";
import { generateUniqueSubjectCode } from "@/lib/subject-code-generator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SubjectClassAllocation {
  class_id: string;
  teacher_id: string | null;
  subject_code: string;
  is_optional: boolean;
  is_active: boolean;
  is_modified?: boolean;
}

export default function SubjectAllocationWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.id as string;
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  /* ── Metadata States ── */
  const [subject, setSubject] = useState<Subject | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [targetClasses, setTargetClasses] = useState<SchoolClass[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [religions, setReligions] = useState<Religion[]>([]);
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([]);

  /* ── Edit Form States ── */
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Subject>>({});
  const [savingSubject, setSavingSubject] = useState(false);
  
  /* ── Operational Matrix State ── */
  const [allocations, setAllocations] = useState<Record<string, SubjectClassAllocation>>({});
  const [initialAllocationsCount, setInitialAllocationsCount] = useState(0);

  /* ── Global Page Loadings ── */
  const [pageLoading, setPageLoading] = useState(true);
  const [savingChanges, setSavingChanges] = useState(false);

  /* ═══════════════════════════════════════
     DATA INITIALIZATION & SYNC
  ═══════════════════════════════════════ */
  const initializeWorkspace = useCallback(async () => {
    if (!schoolId || !subjectId) return;
    setPageLoading(true);

    try {
      // 1. Fetch Master Subject details
      const { data: subjectData, error: subError } = await supabase
        .from("subjects")
        .select("*")
        .eq("id", subjectId)
        .eq("school_id", schoolId)
        .single();

      if (subError || !subjectData) throw new Error("Master subject not found.");
      setSubject(subjectData as Subject);
      setEditFormData(subjectData as Subject);

      // 2. Fetch Teachers, Departments, Religions, and Education Levels
      const [teacherRes, deptRes, religionRes, levelRes] = await Promise.all([
        supabase
          .from("teachers")
          .select("id, first_name, last_name, staff_id")
          .eq("school_id", schoolId)
          .order("first_name", { ascending: true }),
        supabase
          .from("departments")
          .select("*")
          .eq("school_id", schoolId)
          .order("name", { ascending: true }),
        supabase
          .from("religions")
          .select("*")
          .eq("school_id", schoolId)
          .order("name", { ascending: true }),
        supabase
          .from("education_levels")
          .select("*")
          .eq("school_id", schoolId)
          .order("order_sequence", { ascending: true })
      ]);

      setTeachers((teacherRes.data ?? []) as Teacher[]);
      setDepartments((deptRes.data ?? []) as Department[]);
      setReligions((religionRes.data ?? []) as Religion[]);
      setEducationLevels((levelRes.data ?? []) as EducationLevel[]);

      // 3. Find structural track matches (Class Levels targeting this education level)
      const { data: levelData } = await supabase
        .from("school_class_levels")
        .select("id")
        .eq("education_level_id", subjectData.education_level_id);
      
      const targetLevelIds = new Set((levelData ?? []).map((l: { id: string }) => l.id));

      // 4. Fetch physical classes mapped to those tracks
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, class_level_id")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });

      const filteredClasses = (classData ?? []).filter((c: { class_level_id: string }) => targetLevelIds.has(c.class_level_id));
      setTargetClasses(filteredClasses as SchoolClass[]);

      // 5. Pull any existing real active allocations from junction table
      const { data: dynamicAllocations, error: allocError } = await supabase
        .from("subject_classes")
        .select("class_id, teacher_id, subject_code, is_optional, is_active")
        .eq("school_id", schoolId)
        .eq("subject_id", subjectId);

      if (allocError) throw allocError;

      // 6. Map intersection matrix state
      const allocationMap: Record<string, SubjectClassAllocation> = {};
      
      // Seed with defaults based on Master Subject rules
      filteredClasses.forEach((classItem: SchoolClass) => {
        allocationMap[classItem.id] = {
          class_id: classItem.id,
          teacher_id: null,
          subject_code: "", // Populated dynamically or via DB record
          is_optional: subjectData.is_optional,
          is_active: false, // Inactive until assigned or saved
        };
      });

      // Overlay existing persistent database states
      let counter = 0;
      if (dynamicAllocations && dynamicAllocations.length > 0) {
        dynamicAllocations.forEach((record: { class_id: string; teacher_id: string | null; subject_code: string; is_optional: boolean; is_active: boolean }) => {
          if (allocationMap[record.class_id]) {
            allocationMap[record.class_id] = {
              ...record,
              is_active: true, // If record exists in junction, it is actively mapped
            };
            counter++;
          }
        });
      }

      setInitialAllocationsCount(counter);
      setAllocations(allocationMap);

    } catch (err: any) {
      toast.error(err?.message || "Failed running architectural lookup setup sequence");
    } finally {
      setPageLoading(false);
    }
  }, [schoolId, subjectId]);

  useEffect(() => {
    if (schoolId) initializeWorkspace();
  }, [schoolId, initializeWorkspace]);

  /* ═══════════════════════════════════════
     STATE MUTATION PROPAGATORS
  ═══════════════════════════════════════ */
  const handleToggleParticipation = (classId: string, checked: boolean) => {
    setAllocations((prev) => {
      const target = prev[classId];
      
      // Code compilation Strategy: generate safe fallback code if empty string detected
      let trackingCode = target.subject_code;
      if (checked && !trackingCode && subject) {
        const targetClassName = targetClasses.find(c => c.id === classId)?.name || "RM";
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
    if (teacherId === "none") return;
    setAllocations((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((classId) => {
        if (updated[classId].is_active) {
          updated[classId] = { ...updated[classId], teacher_id: teacherId === "clear" ? null : teacherId, is_modified: true };
        }
      });
      return updated;
    });
    toast.success("Applied tutor macro routing overrides across active selections");
  };

  const handleEditFormChange = (field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveSubjectChanges = async () => {
    if (!schoolId || !subject) return;

    setSavingSubject(true);
    try {
      const { error } = await supabase
        .from("subjects")
        .update({
          name: editFormData.name,
          education_level_id: editFormData.education_level_id,
          department_id: editFormData.department_id,
          religion_id: editFormData.religion_id,
          is_optional: editFormData.is_optional,
        })
        .eq("id", subject.id)
        .eq("school_id", schoolId);

      if (error) throw error;

      setSubject(editFormData as Subject);
      setIsEditing(false);
      toast.success("Subject details updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update subject");
    } finally {
      setSavingSubject(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditFormData(subject || {});
  };

  /* ═══════════════════════════════════════
     PERSISTENCE HANDLER (DATABASE SYNC)
  ═══════════════════════════════════════ */
  const saveAllAllocations = async () => {
    if (!schoolId || !subject) return;

    setSavingChanges(true);
    try {
      const allocationsList = Object.values(allocations);
      
      // Separate entries to upsert versus entries to remove from tracking space completely
      const activeModifiedPayloads = allocationsList
        .filter((a) => a.is_active && a.is_modified)
        .map((a) => ({
          school_id: schoolId,
          subject_id: subject.id,
          class_id: a.class_id,
          teacher_id: a.teacher_id,
          subject_code: a.subject_code.trim() || generateUniqueSubjectCode(subject.name, targetClasses.find(tc => tc.id === a.class_id)?.name || "RM", []),
          department_id: subject.department_id || null,
          religion_id: subject.religion_id || null,
          is_optional: a.is_optional,
          is_active: true,
        }));

      const disabledClassIds = allocationsList
        .filter((a) => !a.is_active && a.is_modified)
        .map((a) => a.class_id);

      // 1. Transaction Simulation: Clear dropped allocations out of junction index rules
      if (disabledClassIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("subject_classes")
          .delete()
          .eq("school_id", schoolId)
          .eq("subject_id", subject.id)
          .in("class_id", disabledClassIds);

        if (deleteError) throw deleteError;
      }

      // 2. Transaction Simulation: Insert/Upsert mutations to index rows
      if (activeModifiedPayloads.length > 0) {
        const { error: upsertError } = await supabase
          .from("subject_classes")
          .upsert(activeModifiedPayloads, {
            onConflict: "school_id,subject_id,class_id",
            ignoreDuplicates: false,
          });

        if (upsertError) throw upsertError;
      }

      toast.success("Operational mapping index synchronized smoothly");
      initializeWorkspace(); // Refresh state metrics tracking parameters cleanly
    } catch (err: any) {
      toast.error(err?.message || "Sync execution exception dropped");
    } finally {
      setSavingChanges(false);
    }
  };

  /* ── Guarding Parent Lifecycle Layouts ── */
  if (schoolLoading || pageLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono animate-pulse">Assembling structural deployment routing grids...</p>
        </div>
      </DashboardLayout>
    );
  }

  const trackingModifiedCount = Object.values(allocations).filter(a => a.is_modified).length;

  return (
    <DashboardLayout role="admin">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Workspace Back Link Action Bar */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push("/admin/subjects")}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Subject Catalog
          </Button>
          {trackingModifiedCount > 0 && (
            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 animate-bounce">
              ⚠️ {trackingModifiedCount} Unsaved allocation edits pending
            </Badge>
          )}
        </div>

        {/* Master Context Meta Banner card */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Operational Tracking Engine</span>
                <h1 className="text-2xl font-bold tracking-tight">{subject?.name}</h1>
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Mapping context rules down to physical instances. Changes deployed here update classroom schedules, scorebook ledgers, and terminal reporting profiles instantly.
            </p>
          </div>

          <div className="flex gap-4 border-t pt-4 md:pt-0 md:border-t-0 md:border-l md:pl-6 text-xs font-mono space-y-2 flex-col justify-center">
            <div>
              <span className="text-muted-foreground block">Master Core Configuration status:</span>
              <span className="font-semibold">{subject?.is_optional ? "🟠 Elective Pathway" : "🔵 Compulsory Curricula"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Current System Footprint:</span>
              <span className="font-semibold text-primary">{initialAllocationsCount} Classrooms active</span>
            </div>
          </div>
        </div>

        {/* Subject Edit Form Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Subject Configuration</CardTitle>
              <CardDescription>Edit master subject properties</CardDescription>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
            )}
          </CardHeader>

          <CardContent>
            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Subject Title</span>
                  <p className="text-sm font-medium">{subject?.name}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Education Level</span>
                  <p className="text-sm font-medium">{subject?.education_level?.name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Department</span>
                  <p className="text-sm font-medium">{subject?.department?.name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Religious Alignment</span>
                  <p className="text-sm font-medium">{subject?.religion?.name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Classification</span>
                  <p className="text-sm font-medium">{subject?.is_optional ? "🟠 Elective" : "🔵 Mandatory"}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject Title *</label>
                    <Input
                      value={editFormData.name || ""}
                      onChange={(e) => handleEditFormChange("name", e.target.value)}
                      placeholder="e.g. Agricultural Science"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Education Level</label>
                    <Select
                      value={editFormData.education_level_id || ""}
                      onValueChange={(value) => handleEditFormChange("education_level_id", value || null)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select education level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {educationLevels.map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</label>
                    <Select
                      value={editFormData.department_id || ""}
                      onValueChange={(value) => handleEditFormChange("department_id", value || null)}
                    >
                      <SelectTrigger className="h-9">
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Religious Alignment</label>
                    <Select
                      value={editFormData.religion_id || ""}
                      onValueChange={(value) => handleEditFormChange("religion_id", value || null)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select religion" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {religions.map((religion) => (
                          <SelectItem key={religion.id} value={religion.id}>
                            {religion.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Switch
                    checked={editFormData.is_optional || false}
                    onCheckedChange={(checked) => handleEditFormChange("is_optional", checked)}
                  />
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Elective Designation</span>
                    <span className="text-xs text-muted-foreground">Is this subject optional for student pathways?</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveSubjectChanges}
                    disabled={savingSubject}
                    className="gap-2"
                  >
                    {savingSubject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Action Macro Bar */}
        <div className="bg-muted/40 border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Macro Staff Router:</span>
            <Select onValueChange={applyBulkTeacher}>
              <SelectTrigger className="h-8.5 w-full sm:w-[240px] bg-background">
                <SelectValue placeholder="Assign teacher to all active classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clear">❌ Unassign All Staff</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    🧑‍🏫 {t.first_name} {t.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={saveAllAllocations} 
            disabled={trackingModifiedCount === 0 || savingChanges}
            className="w-full sm:w-auto gap-2"
          >
            {savingChanges ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Publish Allocations Tracking Matrix
          </Button>
        </div>

        {/* Allocations Matrix Grid Layout */}
        <div className="border rounded-2xl bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/10">
            <h3 className="text-sm font-semibold">Active Class Implementation Matrix</h3>
            <p className="text-[11px] text-muted-foreground">Toggle classes into matching tracks, set unique identification routing metrics, and allocate specialized educators.</p>
          </div>

          {targetClasses.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm space-y-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p>No functional school classes currently match the baseline configuration of this subject track.</p>
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
                      current.is_active ? "bg-primary/[0.01] hover:bg-primary/[0.02]" : "bg-muted/10 opacity-70"
                    }`}
                  >
                    {/* Class Selection State column */}
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <Switch 
                        id={`switch-${classItem.id}`}
                        checked={current.is_active}
                        onCheckedChange={(checked) => handleToggleParticipation(classItem.id, checked)}
                      />
                      <div>
                        <Label htmlFor={`switch-${classItem.id}`} className="font-bold text-sm cursor-pointer block">
                          {classItem.name}
                        </Label>
                        <span className="text-[11px] font-mono text-muted-foreground block">
                          {current.is_active ? (
                            <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3 inline" /> Active mapping routing</span>
                          ) : (
                            "💤 Offline (No deployment)"
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Operational Variables Context Inputs */}
                    {current.is_active ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                        
                        {/* Teacher Assignment dropdown Column */}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                            <UserPlus className="h-3 w-3" /> Designated Educator
                          </span>
                          <Select
                            value={current.teacher_id || "unassigned"}
                            onValueChange={(val) => handleValueChange(classItem.id, { teacher_id: val === "unassigned" ? null : val })}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="No Teacher Assigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">⚠️ Unassigned (No Tutor)</SelectItem>
                              {teachers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  🧑‍🏫 {t.first_name} {t.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Subject Custom system unique code column */}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                            <Hash className="h-3 w-3" /> Unique Subject System Tracking Code
                          </span>
                          <div className="relative">
                            <input
                              type="text"
                              value={current.subject_code}
                              onChange={(e) => handleValueChange(classItem.id, { subject_code: e.target.value.toUpperCase() })}
                              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder="e.g. MAT-JSS1A"
                            />
                          </div>
                        </div>

                        {/* Local Class Elective Flag Overrides */}
                        <div className="flex flex-col justify-center sm:items-end space-y-1 pr-4">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            Local Classroom Elective Pathway Flag
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{current.is_optional ? "Elective" : "Mandatory"}</span>
                            <Switch 
                              checked={current.is_optional}
                              className="scale-75"
                              onCheckedChange={(checked) => handleValueChange(classItem.id, { is_optional: checked })}
                            />
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="flex-1 text-xs text-muted-foreground italic flex items-center justify-end pr-6 h-9">
                        This physical classroom is completely omitted from this subject parameter grid.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}