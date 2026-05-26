"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DashboardLayout } from "@/components/dashboard-layout";
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
  Loader2,
  Library,
} from "lucide-react";
import type {
  Subject,
  Teacher,
  Class as SchoolClass,
  EducationLevelSubjectPreset,
  EducationLevel,
  Department,
  Religion,
} from "@/lib/types";
import { getSubjectsForLevel } from "@/lib/nigerian-subjects";
import { generateUniqueSubjectCode } from "@/lib/subject-code-generator";

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

export default function SubjectsPage() {
  const { schoolId } = useSchoolContext();

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

  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [religions, setReligions] = useState<Religion[]>([]);

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
    if (error) toast.error(error.message || "Failed to load level subjects");
    else setSubjectPresets((data ?? []) as EducationLevelSubjectPreset[]);
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
    if (error) toast.error(error.message || "Failed to load subject catalog");
    else setOperationalSubjects((data ?? []) as Subject[]);
    setOpSubjectsLoading(false);
  }, [schoolId]);

  const fetchTeachers = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("teachers")
      .select("id, staff_id, first_name, last_name, email, phone, address, qualification, specialization, hire_date, photo_url, bio, status, created_at, school_id")
      .eq("school_id", schoolId)
      .order("first_name", { ascending: true });
    if (error) toast.error(error.message || "Failed to load teachers");
    else setTeachers((data ?? []) as Teacher[]);
  }, [schoolId]);

  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("classes")
      .select("id, school_id, name, class_level_id, stream_id, department_id, room_number, class_teacher_id, session_id, academic_year, created_at, updated_at")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error(error.message || "Failed to load classes");
    else setClasses((data ?? []) as SchoolClass[]);
  }, [schoolId]);

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
    if (!payload.name) return toast.error("Subject name is required");
    if (!payload.education_level_id) return toast.error("Education level is required");
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
        const { error: insertError } = await supabase.from("subjects").insert(payload);
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
    if (error) return toast.error(error.message || "Failed to load existing assignments");
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
    if (selectedClassIds.length === 0) return toast.error("Select at least one class");
    setApplyingSubject(true);
    try {
      const selectedClasses = classes.filter((item) => selectedClassIds.includes(item.id));
      const { data: existingSubjectClasses, error: fetchError } = await supabase
        .from("subject_classes")
        .select("class_id, subject_code")
        .eq("school_id", schoolId)
        .in("class_id", selectedClasses.map((c) => c.id));
      if (fetchError) throw fetchError;
      const codesByClass: Record<string, string[]> = {};
      for (const classItem of selectedClasses) {
        codesByClass[classItem.id] = (existingSubjectClasses || [])
          .filter((sc: { class_id: string }) => sc.class_id === classItem.id)
          .map((sc: any) => sc.subject_code);
      }
      const payload = selectedClasses.map((classItem) => ({
        school_id: schoolId,
        subject_id: applyTargetSubject.id,
        class_id: classItem.id,
        teacher_id: teacherByClassId[classItem.id] || null,
        subject_code: generateUniqueSubjectCode(applyTargetSubject.name, classItem.name, codesByClass[classItem.id] || []),
        department_id: applyTargetSubject.department_id || null,
        religion_id: applyTargetSubject.religion_id || null,
        is_optional: applyTargetSubject.is_optional,
        is_active: true,
      }));
      const { error } = await supabase.from("subject_classes").upsert(payload, {
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
      if (!payload.name) return toast.error("Subject name is required");
      if (!Number.isFinite(payload.order_sequence) || payload.order_sequence < 1)
        return toast.error("Order sequence must be at least 1");
      if (editingSp) {
        const { error } = await supabase.from("school_level_subject_presets").update(payload).eq("id", editingSp.id);
        if (error) throw error;
        toast.success("Level subject updated");
      } else {
        const { error } = await supabase.from("school_level_subject_presets").insert(payload);
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
    const { error } = await supabase.from("school_level_subject_presets").delete().eq("id", deleteSpId);
    if (error) toast.error(error.message || "Failed to delete level subject");
    else {
      toast.success("Level subject deleted");
      fetchSubjectPresets(selectedPresetLevelId);
    }
    setDeleteSpId(null);
  }

  async function toggleSubjectPresetActive(item: EducationLevelSubjectPreset) {
    const { error } = await supabase.from("school_level_subject_presets").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) toast.error(error.message || "Failed to update status");
    else setSubjectPresets((prev) => prev.map((row) => (row.id === item.id ? { ...row, is_active: !row.is_active } : row)));
  }

  function loadDefaultSubjectsForPresetLevel() {
    if (!schoolId || !selectedPresetLevelId) return toast.error("Select an education level first");
    if (subjectPresets.length > 0) {
      setLoadDefaultsConfirmOpen(true);
      return;
    }
    proceedWithLoadingDefaults();
  }

  async function proceedWithLoadingDefaults() {
    if (!schoolId || !selectedPresetLevelId) return toast.error("Select an education level first");
    const selectedLevel = educationLevels.find((level) => level.id === selectedPresetLevelId);
    if (!selectedLevel) return toast.error("Selected education level was not found");
    const defaults = getSubjectsForLevel(selectedLevel.name);
    if (defaults.length === 0) return toast.error(`No default subjects found for ${selectedLevel.name}`);
    const rows = defaults.map((subject, index) => ({
      school_id: schoolId,
      education_level_id: selectedPresetLevelId,
      name: subject.name,
      is_optional: Boolean(subject.isOptional),
      order_sequence: index + 1,
      is_active: true,
    }));
    const { error } = await supabase.from("school_level_subject_presets").upsert(rows, { onConflict: "school_id,education_level_id,name", ignoreDuplicates: false });
    if (error) return toast.error(error.message || "Failed to load default subjects");
    toast.success(`Loaded ${rows.length} default subjects for ${selectedLevel.name}`);
    setLoadDefaultsConfirmOpen(false);
    fetchSubjectPresets(selectedPresetLevelId);
  }

  useEffect(() => {
    if (schoolId) {
      fetchEducationLevels();
      fetchOperationalSubjects();
      fetchTeachers();
      fetchClasses();
      fetchDepartments();
      fetchReligions();
      fetchSubjectPresets();
    }
  }, [schoolId]);

  useEffect(() => {
    if (schoolId && selectedPresetLevelId) fetchSubjectPresets(selectedPresetLevelId);
  }, [schoolId, selectedPresetLevelId]);

  return (
    <DashboardLayout role="admin">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Subjects</h1>
            <p className="text-sm text-muted-foreground">Manage operational subjects and level presets.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { setSubjectDialogOpen(true); setEditingOperationalSubject(null); setSubjectForm(blankOperationalSubject()); }}>
              <Plus className="h-4 w-4 mr-2" /> New Subject
            </Button>
          </div>
        </div>

        <Tabs value={subjectTabValue} onValueChange={setSubjectTabValue} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="operational" className="flex items-center gap-2">
              <Library className="h-4 w-4" /> Operational
            </TabsTrigger>
            <TabsTrigger value="presets" className="flex items-center gap-2">
              <Library className="h-4 w-4" /> Presets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operational">
            <div className="rounded-xl border bg-card overflow-hidden p-4">
              {opSubjectsLoading ? (
                <div className="py-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
              ) : operationalSubjects.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No operational subjects yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Level</th>
                        <th className="px-3 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {operationalSubjects.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/10">
                          <td className="px-3 py-2">{s.name}</td>
                          <td className="px-3 py-2">{s.education_level_id || "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setEditingOperationalSubject(s); setSubjectForm({ name: s.name, education_level_id: s.education_level_id || "", department_id: s.department_id || "", religion_id: s.religion_id || "", is_optional: s.is_optional, is_active: s.is_active }); setSubjectDialogOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" onClick={() => openApplyDialog(s)}>
                                Apply
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="presets">
            <div className="rounded-xl border bg-card overflow-hidden p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">Level presets for subjects.</div>
                <div className="flex gap-2">
                  <Button onClick={() => setSpDialogOpen(true)}>New Preset</Button>
                  <Button variant="outline" onClick={loadDefaultSubjectsForPresetLevel}>Load Defaults</Button>
                </div>
              </div>

              {spLoading ? (
                <div className="py-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
              ) : subjectPresets.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No presets for selected level.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Order</th>
                        <th className="px-3 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {subjectPresets.map((sp) => (
                        <tr key={sp.id} className="hover:bg-muted/10">
                          <td className="px-3 py-2">{sp.name}</td>
                          <td className="px-3 py-2">{sp.order_sequence}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setEditingSp(sp); setSpForm({ name: sp.name, is_optional: sp.is_optional, department_id: sp.department_id || "", religion_id: sp.religion_id || "", order_sequence: sp.order_sequence, is_active: sp.is_active }); setSpDialogOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteSpId(sp.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialogs and alerts (create/edit/apply/load defaults) */}
        <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingOperationalSubject ? "Edit Subject" : "Add Subject"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveOperationalSubject} className="space-y-4">
              <div>
                <Label>Subject Name *</Label>
                <Input value={subjectForm.name} onChange={(e) => setSubjectForm((c) => ({ ...c, name: e.target.value }))} required className="mt-1" />
              </div>
              <div>
                <Label>Education Level *</Label>
                <Select value={subjectForm.education_level_id} onValueChange={(v) => setSubjectForm((c) => ({ ...c, education_level_id: v }))}>
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setSubjectDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={subjectSaving}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Apply Subject to Classes</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">{/* simplified view handled in apply dialog */}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>Cancel</Button>
              <Button onClick={applySubjectToClasses} disabled={applyingSubject || selectedClassIds.length === 0}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={spDialogOpen} onOpenChange={setSpDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSp ? "Edit Level Subject" : "Add Level Subject"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveSubjectPreset} className="space-y-4">
              <div>
                <Label>Subject Name *</Label>
                <Input value={spForm.name} onChange={(e) => setSpForm((f) => ({ ...f, name: e.target.value }))} required className="mt-1" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSpDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={spSaving}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteSpId} onOpenChange={() => setDeleteSpId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Level Subject</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete this preset subject? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteSubjectPreset}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={loadDefaultsConfirmOpen} onOpenChange={setLoadDefaultsConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Load Default Subjects</AlertDialogTitle>
              <AlertDialogDescription>Loading defaults will add and update matching names. Continue?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={proceedWithLoadingDefaults}>Load Defaults</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
