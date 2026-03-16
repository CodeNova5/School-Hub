"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Wrench, ArrowRight, BookOpen, GraduationCap, CheckCircle2, AlertCircle, Zap, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Department, EducationLevelSubjectPreset, Religion, Subject, Teacher } from "@/lib/types";
import { useSchoolContext } from "@/hooks/use-school-context";
import { useSchoolConfig } from "@/hooks/use-school-config";
import {
  PredefinedSubject,
  getSubjectsForLevel,
  getSmartDepartmentId,
  getSmartReligionId,
  validatePredefinedSubjectsForSchool,
} from "@/lib/nigerian-subjects";

type EducationLevelOption = {
  id: string;
  name: string;
  order_sequence: number;
};

type ClassWithLevel = {
  id: string;
  name: string;
  class_level_id: string;
  school_class_levels?: {
    id: string;
    name: string;
    education_level_id: string;
    school_education_levels?: {
      id: string;
      name: string;
    };
  } | null;
};

type SubjectAssignmentRow = {
  class_id: string;
  subject_id: string;
  classes?: {
    id: string;
    name: string;
    class_level_id: string;
  } | null;
};

type SetupSummary = {
  createdCatalogSubjects: number;
  createdAssignments: number;
  skippedAlreadyAssigned: number;
};

type SetupSubjectOption = PredefinedSubject & {
  departmentId?: string | null;
  religionId?: string | null;
};

type WizardClassConfig = {
  classId: string;
  className: string;
  teacherId: string;
  fullMark: string;
  passMark: string;
  includeOptionalSubjects: boolean;
  selectedSubjectNames: string[];
};

function getSubjectCodePrefix(
  subjectName: string,
  allSubjectNames: string[]
): { prefix: string; length: number } {
  const nameNoSpace = subjectName.replace(/\s+/g, "");
  let prefix = nameNoSpace.slice(0, 3).toUpperCase();

  // Check for collisions with 3 characters
  const conflictsWith3 = allSubjectNames.some(
    (name) =>
      name !== subjectName &&
      name.replace(/\s+/g, "").slice(0, 3).toUpperCase() === prefix
  );

  if (conflictsWith3) {
    // Try 4 characters
    prefix = nameNoSpace.slice(0, 4).toUpperCase();
    return { prefix, length: 4 };
  }

  return { prefix, length: 3 };
}

function generateSubjectCode(
  subjectName: string,
  className: string,
  subjectId?: string,
  allSubjectNames?: string[]
): string {
  if (!allSubjectNames) {
    // Fallback to simple 3-character code
    const prefix = subjectName.replace(/\s+/g, "").slice(0, 3).toUpperCase();
    return `${prefix}-${className}`;
  }

  const { prefix, length } = getSubjectCodePrefix(subjectName, allSubjectNames);

  // Check if there's still a collision at this length
  const stillConflicting = allSubjectNames.some(
    (name) =>
      name !== subjectName &&
      getSubjectCodePrefix(name, allSubjectNames).prefix === prefix
  );

  if (stillConflicting && subjectId) {
    // Use subject ID for disambiguation (4-char prefix + 4-char ID)
    return `${prefix}-${subjectId.slice(0, 4)}-${className}`;
  }

  return `${prefix}-${className}`;
}

export default function SubjectsPage() {
  const { schoolId } = useSchoolContext();

  const { data: departments } = useSchoolConfig({ type: "departments" });
  const { data: religions } = useSchoolConfig({ type: "religions" });

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassWithLevel[]>([]);
  const [assignments, setAssignments] = useState<SubjectAssignmentRow[]>([]);
  const [educationLevels, setEducationLevels] = useState<EducationLevelOption[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [levelSubjectPresets, setLevelSubjectPresets] = useState<EducationLevelSubjectPreset[]>([]);

  const [loading, setLoading] = useState(true);
  const [isRunningSetup, setIsRunningSetup] = useState(false);
  const [setupSummary, setSetupSummary] = useState<SetupSummary | null>(null);

  const [selectedEducationLevelId, setSelectedEducationLevelId] = useState("");
  const [defaultTeacherId, setDefaultTeacherId] = useState("");
  const [defaultFullMark, setDefaultFullMark] = useState("100");
  const [defaultPassMark, setDefaultPassMark] = useState("40");
  const [includeOptionalSubjects, setIncludeOptionalSubjects] = useState(true);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardClassConfigs, setWizardClassConfigs] = useState<WizardClassConfig[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevelId, setFilterLevelId] = useState<"all" | string>("all");
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) {
      return;
    }

    void loadPageData();
  }, [schoolId]);

  const selectedLevel = useMemo(
    () => educationLevels.find((level) => level.id === selectedEducationLevelId) ?? null,
    [educationLevels, selectedEducationLevelId]
  );

  const classesInSelectedLevel = useMemo(
    () =>
      selectedLevel
        ? classes.filter(
            (classItem) => classItem.school_class_levels?.education_level_id === selectedLevel.id
          )
        : [],
    [classes, selectedLevel]
  );

  const configuredSubjectsForSelectedLevel = useMemo(() => {
    if (!selectedLevel) {
      return [] as SetupSubjectOption[];
    }

    return levelSubjectPresets
      .filter((preset) => preset.education_level_id === selectedLevel.id && preset.is_active)
      .sort((a, b) => {
        if (a.order_sequence !== b.order_sequence) {
          return a.order_sequence - b.order_sequence;
        }
        return a.name.localeCompare(b.name);
      })
      .map((preset) => ({
        name: preset.name,
        isOptional: preset.is_optional,
        departmentId: preset.department_id,
        religionId: preset.religion_id,
      }));
  }, [levelSubjectPresets, selectedLevel]);

  const validatedPredefined = useMemo(() => {
    if (!selectedLevel) {
      return {
        loadable: [] as SetupSubjectOption[],
        warnings: [] as string[],
      };
    }

    const predefined =
      configuredSubjectsForSelectedLevel.length > 0
        ? configuredSubjectsForSelectedLevel
        : getSubjectsForLevel(selectedLevel.name);

    return validatePredefinedSubjectsForSchool(predefined, (religions || []) as Religion[]);
  }, [selectedLevel, religions, configuredSubjectsForSelectedLevel]);

  const predefinedPreview = useMemo(() => {
    if (!selectedLevel) {
      return {
        subjects: [] as ReturnType<typeof getSubjectsForLevel>,
        warnings: [] as string[],
      };
    }

    const filtered = includeOptionalSubjects
      ? validatedPredefined.loadable
      : validatedPredefined.loadable.filter((subject) => !subject.isOptional);

    return {
      subjects: filtered,
      warnings: validatedPredefined.warnings,
    };
  }, [selectedLevel, includeOptionalSubjects, validatedPredefined]);

  const selectedSubjectsTotal = useMemo(
    () =>
      wizardClassConfigs.reduce((sum, classConfig) => sum + classConfig.selectedSubjectNames.length, 0),
    [wizardClassConfigs]
  );

  const wizardHasClassValidationErrors = useMemo(
    () =>
      wizardClassConfigs.some((classConfig) => {
        const fullMark = Number(classConfig.fullMark);
        const passMark = Number(classConfig.passMark);

        if (!Number.isFinite(fullMark) || fullMark <= 0) {
          return true;
        }

        if (!Number.isFinite(passMark) || passMark < 0 || passMark > fullMark) {
          return true;
        }

        return classConfig.selectedSubjectNames.length === 0;
      }),
    [wizardClassConfigs]
  );

  const subjectCoverage = useMemo(() => {
    const classMap = new Map(classes.map((item) => [item.id, item]));

    const assignmentMap = new Map<
      string,
      { subject: Subject; classIds: string[]; classNames: string[]; levelIds: string[] }
    >();

    for (const subject of subjects) {
      assignmentMap.set(subject.id, {
        subject,
        classIds: [],
        classNames: [],
        levelIds: [],
      });
    }

    for (const row of assignments) {
      const existing = assignmentMap.get(row.subject_id);
      if (!existing) {
        continue;
      }

      const classEntry = classMap.get(row.class_id);
      if (!classEntry) {
        continue;
      }

      const levelId = classEntry.school_class_levels?.education_level_id || "";
      existing.classIds.push(classEntry.id);
      existing.classNames.push(classEntry.name);
      if (levelId) {
        existing.levelIds.push(levelId);
      }
    }

    const rows = Array.from(assignmentMap.values()).map((entry) => ({
      subjectId: entry.subject.id,
      subjectName: entry.subject.name,
      catalogCode: entry.subject.subject_code || "-",
      classIds: entry.classIds,
      classNames: entry.classNames,
      levelIds: Array.from(new Set(entry.levelIds)),
    }));

    return rows
      .filter((row) => {
        if (
          searchTerm.trim() &&
          !row.subjectName.toLowerCase().includes(searchTerm.trim().toLowerCase())
        ) {
          return false;
        }

        if (filterLevelId !== "all") {
          return row.levelIds.includes(filterLevelId);
        }

        return true;
      })
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [subjects, assignments, classes, searchTerm, filterLevelId]);

  async function loadPageData() {
    if (!schoolId) {
      return;
    }

    setLoading(true);

    try {
      const [
        levelsResponse,
        subjectsResponse,
        classesResponse,
        assignmentsResponse,
        teachersResponse,
        presetsResponse,
      ] = await Promise.all([
        supabase
          .from("school_education_levels")
          .select("id, name, order_sequence")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("order_sequence", { ascending: true }),
        supabase
          .from("subjects")
          .select("id, school_id, name, subject_code, is_active, created_at, updated_at")
          .eq("school_id", schoolId)
          .order("name", { ascending: true }),
        supabase
          .from("classes")
          .select(`
            id,
            name,
            class_level_id,
            school_class_levels:class_level_id(
              id,
              name,
              education_level_id,
              school_education_levels:education_level_id(id, name)
            )
          `)
          .eq("school_id", schoolId)
          .order("name", { ascending: true }),
        supabase
          .from("subject_classes")
          .select(`
            class_id,
            subject_id,
            classes:class_id(id, name, class_level_id)
          `)
          .eq("school_id", schoolId),
        supabase
          .from("teachers")
          .select("id, first_name, last_name")
          .eq("school_id", schoolId)
          .order("first_name", { ascending: true }),
        supabase
          .from("school_level_subject_presets")
          .select("*")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("order_sequence", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (levelsResponse.error) throw levelsResponse.error;
      if (subjectsResponse.error) throw subjectsResponse.error;
      if (classesResponse.error) throw classesResponse.error;
      if (assignmentsResponse.error) throw assignmentsResponse.error;
      if (teachersResponse.error) throw teachersResponse.error;
      if (presetsResponse.error) throw presetsResponse.error;

      setEducationLevels((levelsResponse.data || []) as EducationLevelOption[]);
      setSubjects((subjectsResponse.data || []) as Subject[]);
      setClasses((classesResponse.data || []) as ClassWithLevel[]);
      setAssignments((assignmentsResponse.data || []) as SubjectAssignmentRow[]);
      setTeachers((teachersResponse.data || []) as Teacher[]);
      setLevelSubjectPresets((presetsResponse.data || []) as EducationLevelSubjectPreset[]);
    } catch (error) {
      console.error("Error loading subjects page:", error);
      toast.error("Failed to load subject setup data");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunInitialSetup() {
    if (!schoolId) {
      toast.error("School not found");
      return;
    }

    if (!selectedLevel) {
      toast.error("Select an education level first");
      return;
    }

    if (classesInSelectedLevel.length === 0) {
      toast.error("No classes found under this education level");
      return;
    }

    if (wizardClassConfigs.length === 0) {
      toast.error("Build and configure the wizard before confirming setup");
      return;
    }

    const invalidClass = wizardClassConfigs.find((classConfig) => {
      const fullMark = Number(classConfig.fullMark);
      const passMark = Number(classConfig.passMark);

      if (!Number.isFinite(fullMark) || fullMark <= 0) {
        return true;
      }

      if (!Number.isFinite(passMark) || passMark < 0 || passMark > fullMark) {
        return true;
      }

      return classConfig.selectedSubjectNames.length === 0;
    });

    if (invalidClass) {
      toast.error(`Please complete valid configuration for ${invalidClass.className}`);
      return;
    }

    const subjectByName = new Map<string, SetupSubjectOption>();
    for (const setupSubject of validatedPredefined.loadable) {
      subjectByName.set(setupSubject.name.toLowerCase(), setupSubject);
    }

    setIsRunningSetup(true);

    try {
      const classIds = wizardClassConfigs.map((item) => item.classId);
      const selectedSubjectNames = Array.from(
        new Set(wizardClassConfigs.flatMap((classConfig) => classConfig.selectedSubjectNames))
      );

      if (selectedSubjectNames.length === 0) {
        toast.error("No subjects selected in wizard");
        return;
      }

      const [catalogResponse, assignmentResponse] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, name")
          .eq("school_id", schoolId),
        supabase
          .from("subject_classes")
          .select("subject_id, class_id")
          .eq("school_id", schoolId)
          .in("class_id", classIds),
      ]);

      if (catalogResponse.error) throw catalogResponse.error;
      if (assignmentResponse.error) throw assignmentResponse.error;

      const catalogByName = new Map<string, string>();
      for (const row of catalogResponse.data || []) {
        catalogByName.set(row.name.toLowerCase(), row.id);
      }

      const subjectsMissingInCatalog = selectedSubjectNames
        .filter((subjectName) => !catalogByName.has(subjectName.toLowerCase()))
        .map((subjectName) => ({
          name: subjectName,
          meta: subjectByName.get(subjectName.toLowerCase()) || null,
        }));

      let createdCatalogSubjects = 0;
      if (subjectsMissingInCatalog.length > 0) {
        const { data: insertedSubjects, error: insertSubjectsError } = await supabase
          .from("subjects")
          .insert(
            subjectsMissingInCatalog.map((subject) => ({
              school_id: schoolId,
              name: subject.name,
              subject_code: null,
              is_active: true,
            }))
          )
          .select("id, name");

        if (insertSubjectsError) throw insertSubjectsError;

        createdCatalogSubjects = insertedSubjects?.length || 0;

        for (const row of insertedSubjects || []) {
          catalogByName.set(row.name.toLowerCase(), row.id);
        }
      }

      const existingPairs = new Set<string>();
      for (const row of assignmentResponse.data || []) {
        existingPairs.add(`${row.subject_id}::${row.class_id}`);
      }

      const defaultDepartmentCache = new Map<string, string>();
      const defaultReligionCache = new Map<string, string>();

      const payload: Array<{
        school_id: string;
        subject_id: string;
        class_id: string;
        teacher_id: string | null;
        department_id: string | null;
        religion_id: string | null;
        is_optional: boolean;
        full_mark_obtainable: number;
        pass_mark: number;
        subject_code: string;
        is_active: boolean;
      }> = [];

      const classById = new Map(classesInSelectedLevel.map((classItem) => [classItem.id, classItem]));

      for (const classConfig of wizardClassConfigs) {
        const classItem = classById.get(classConfig.classId);
        if (!classItem) {
          continue;
        }

        const fullMark = Number(classConfig.fullMark);
        const passMark = Number(classConfig.passMark);

        for (const subjectName of classConfig.selectedSubjectNames) {
          const subjectId = catalogByName.get(subjectName.toLowerCase());
          const setupSubject = subjectByName.get(subjectName.toLowerCase());
          if (!subjectId) {
            continue;
          }

          if (!defaultDepartmentCache.has(subjectName)) {
            const configuredDepartmentId = setupSubject?.departmentId?.trim() || "";
            defaultDepartmentCache.set(
              subjectName,
              configuredDepartmentId || getSmartDepartmentId(subjectName, (departments || []) as Department[])
            );
          }

          if (!defaultReligionCache.has(subjectName)) {
            const configuredReligionId = setupSubject?.religionId?.trim() || "";
            defaultReligionCache.set(
              subjectName,
              configuredReligionId || getSmartReligionId(subjectName, (religions || []) as Religion[])
            );
          }

          const key = `${subjectId}::${classItem.id}`;
          if (existingPairs.has(key)) {
            continue;
          }

          payload.push({
            school_id: schoolId,
            subject_id: subjectId,
            class_id: classItem.id,
            teacher_id: classConfig.teacherId || null,
            department_id: defaultDepartmentCache.get(subjectName) || null,
            religion_id: defaultReligionCache.get(subjectName) || null,
            is_optional: Boolean(setupSubject?.isOptional),
            full_mark_obtainable: fullMark,
            pass_mark: passMark,
            subject_code: generateSubjectCode(subjectName, classItem.name, subjectId, selectedSubjectNames),
            is_active: true,
          });
        }
      }

      let createdAssignments = 0;
      if (payload.length > 0) {
        const { error: upsertError, data: insertedRows } = await supabase
          .from("subject_classes")
          .upsert(payload, {
            onConflict: "school_id,subject_id,class_id",
            ignoreDuplicates: true,
          })
          .select("subject_id, class_id");

        if (upsertError) throw upsertError;

        createdAssignments = insertedRows?.length || 0;
      }

      const skippedAlreadyAssigned = selectedSubjectsTotal - createdAssignments;

      setSetupSummary({
        createdCatalogSubjects,
        createdAssignments,
        skippedAlreadyAssigned,
      });

      toast.success("Initial setup completed");
      setWizardStep(1);
      setWizardClassConfigs([]);
      await loadPageData();
    } catch (error: any) {
      console.error("Initial setup error:", error);
      toast.error(error?.message || "Failed to run initial setup");
    } finally {
      setIsRunningSetup(false);
    }
  }

  function buildClassWizard() {
    if (!selectedLevel) {
      toast.error("Select an education level first");
      return;
    }

    const fullMark = Number(defaultFullMark);
    const passMark = Number(defaultPassMark);

    if (!Number.isFinite(fullMark) || fullMark <= 0) {
      toast.error("Default full mark must be greater than 0");
      return;
    }

    if (!Number.isFinite(passMark) || passMark < 0 || passMark > fullMark) {
      toast.error("Default pass mark must be between 0 and full mark");
      return;
    }

    if (classesInSelectedLevel.length === 0) {
      toast.error("No classes found under this education level");
      return;
    }

    const initialSubjects = includeOptionalSubjects
      ? validatedPredefined.loadable
      : validatedPredefined.loadable.filter((subject) => !subject.isOptional);

    if (initialSubjects.length === 0) {
      toast.error("No loadable predefined subjects for this level");
      return;
    }

    setWizardClassConfigs(
      classesInSelectedLevel.map((classItem) => ({
        classId: classItem.id,
        className: classItem.name,
        teacherId: defaultTeacherId,
        fullMark: defaultFullMark,
        passMark: defaultPassMark,
        includeOptionalSubjects,
        selectedSubjectNames: initialSubjects.map((subject) => subject.name),
      }))
    );
    setWizardStep(2);
    setSetupSummary(null);
  }

  function getLoadableSubjectsForClass(classConfig: WizardClassConfig) {
    return classConfig.includeOptionalSubjects
      ? validatedPredefined.loadable
      : validatedPredefined.loadable.filter((subject) => !subject.isOptional);
  }

  function updateClassConfig(classId: string, updater: (current: WizardClassConfig) => WizardClassConfig) {
    setWizardClassConfigs((current) =>
      current.map((classConfig) =>
        classConfig.classId === classId ? updater(classConfig) : classConfig
      )
    );
  }

  function goToReviewStep() {
    if (wizardClassConfigs.length === 0) {
      toast.error("No class configuration found");
      return;
    }

    if (wizardHasClassValidationErrors) {
      toast.error("Fix class setup issues before review");
      return;
    }

    setWizardStep(3);
  }

  // Stats for dashboard
  const stats = useMemo(() => {
    const totalClasses = classes.length;
    const totalSubjects = subjects.length;
    const assignedClasses = new Set(assignments.map((a) => a.class_id)).size;
    const unconfiguredClasses = totalClasses - assignedClasses;
    const avgSubjectsPerClass = totalClasses > 0 ? Math.round((assignments.length / totalClasses) * 10) / 10 : 0;

    return {
      totalClasses,
      totalSubjects,
      assignedClasses,
      unconfiguredClasses,
      avgSubjectsPerClass,
    };
  }, [classes, subjects, assignments]);

  function closeWizardModal() {
    setIsWizardOpen(false);
    setWizardStep(1);
    setWizardClassConfigs([]);
    setSelectedEducationLevelId("");
    setDefaultTeacherId("");
    setDefaultFullMark("100");
    setDefaultPassMark("40");
    setIncludeOptionalSubjects(true);
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Subject Setup</h1>
          <p className="text-gray-600">
            This page is for initial rollout only. Detailed subject configuration now belongs in each class.
          </p>
        </div>

        {/* Stats Dashboard */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{stats.totalClasses}</p>
                <p className="text-xs text-gray-600 mt-1">Total Classes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{stats.assignedClasses}</p>
                <p className="text-xs text-gray-600 mt-1">Configured</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600">{stats.unconfiguredClasses}</p>
                <p className="text-xs text-gray-600 mt-1">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{stats.totalSubjects}</p>
                <p className="text-xs text-gray-600 mt-1">Subjects</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-indigo-600">{stats.avgSubjectsPerClass}</p>
                <p className="text-xs text-gray-600 mt-1">Avg per Class</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Start Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Quick Start Wizard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Use the quick wizard to bulk assign predefined subjects to all classes in an education level. Each class can be customized after setup.
            </p>
            <Button onClick={() => setIsWizardOpen(true)} size="lg">
              <Wrench className="h-4 w-4 mr-2" />
              Launch Setup Wizard
            </Button>
          </CardContent>
        </Card>

        {/* Setup Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              Initial Setup Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-gray-700 md:grid-cols-3">
            <div className="rounded-lg border bg-blue-50 p-4">
              <p className="font-semibold text-blue-900">Step 1</p>
              <p className="text-blue-800 mt-1">Pick an education level and preview predefined subjects</p>
            </div>
            <div className="rounded-lg border bg-indigo-50 p-4">
              <p className="font-semibold text-indigo-900">Step 2</p>
              <p className="text-indigo-800 mt-1">Apply defaults and assign subjects to all classes at once</p>
            </div>
            <div className="rounded-lg border bg-purple-50 p-4">
              <p className="font-semibold text-purple-900">Step 3</p>
              <p className="text-purple-800 mt-1">Fine-tune any class via the class Subjects tab</p>
            </div>
          </CardContent>
        </Card>
        {/* Subject Coverage Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Subject Coverage & Class Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_240px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search subject"
                  className="pl-10"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <select
                className="rounded-md border px-3 py-2"
                value={filterLevelId}
                onChange={(event) => setFilterLevelId(event.target.value)}
              >
                <option value="all">All education levels</option>
                {educationLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>

            {subjectCoverage.length === 0 ? (
              <div className="rounded-md border p-8 text-center text-sm text-gray-500">
                No subjects matched your filter.
              </div>
            ) : (
              <div className="space-y-3">
                {subjectCoverage.map((row) => (
                  <div key={row.subjectId} className="rounded-lg border p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{row.subjectName}</p>
                        <p className="text-xs text-gray-500">Code: {row.catalogCode}</p>
                      </div>
                      <Badge variant={row.classIds.length > 0 ? "default" : "secondary"}>
                        {row.classIds.length} class(es)
                      </Badge>
                    </div>

                    {row.classIds.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">Not assigned to any class yet.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.classIds.map((classId, index) => (
                          <Link
                            key={`${row.subjectId}-${classId}`}
                            href={`/admin/classes/${classId}?tab=subjects`}
                            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
                          >
                            <GraduationCap className="h-3.5 w-3.5" />
                            {row.classNames[index]}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Wizard */}
      <WizardModal
        isOpen={isWizardOpen}
        onClose={closeWizardModal}
        wizardStep={wizardStep}
        setWizardStep={setWizardStep}
        selectedEducationLevelId={selectedEducationLevelId}
        setSelectedEducationLevelId={setSelectedEducationLevelId}
        defaultTeacherId={defaultTeacherId}
        setDefaultTeacherId={setDefaultTeacherId}
        defaultFullMark={defaultFullMark}
        setDefaultFullMark={setDefaultFullMark}
        defaultPassMark={defaultPassMark}
        setDefaultPassMark={setDefaultPassMark}
        includeOptionalSubjects={includeOptionalSubjects}
        setIncludeOptionalSubjects={setIncludeOptionalSubjects}
        wizardClassConfigs={wizardClassConfigs}
        setWizardClassConfigs={setWizardClassConfigs}
        educationLevels={educationLevels}
        teachers={teachers}
        classes={classesInSelectedLevel}
        selectedLevel={selectedLevel}
        validatedPredefined={validatedPredefined}
        predefinedPreview={predefinedPreview}
        wizardHasClassValidationErrors={wizardHasClassValidationErrors}
        isRunningSetup={isRunningSetup}
        loading={loading}
        onRunSetup={handleRunInitialSetup}
        onBuildWizard={buildClassWizard}
        getLoadableSubjectsForClass={getLoadableSubjectsForClass}
        updateClassConfig={updateClassConfig}
        goToReviewStep={goToReviewStep}
        setupSummary={setupSummary}
        setSetupSummary={setSetupSummary}
      />
    </DashboardLayout>
  );
}

// Modal Wizard Component
interface WizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  wizardStep: 1 | 2 | 3;
  setWizardStep: (step: 1 | 2 | 3) => void;
  selectedEducationLevelId: string;
  setSelectedEducationLevelId: (id: string) => void;
  defaultTeacherId: string;
  setDefaultTeacherId: (id: string) => void;
  defaultFullMark: string;
  setDefaultFullMark: (mark: string) => void;
  defaultPassMark: string;
  setDefaultPassMark: (mark: string) => void;
  includeOptionalSubjects: boolean;
  setIncludeOptionalSubjects: (include: boolean) => void;
  wizardClassConfigs: WizardClassConfig[];
  setWizardClassConfigs: (configs: WizardClassConfig[]) => void;
  educationLevels: EducationLevelOption[];
  teachers: Teacher[];
  classes: ClassWithLevel[];
  selectedLevel: EducationLevelOption | null;
  validatedPredefined: { loadable: SetupSubjectOption[]; warnings: string[] };
  predefinedPreview: { subjects: SetupSubjectOption[]; warnings: string[] };
  wizardHasClassValidationErrors: boolean;
  isRunningSetup: boolean;
  loading: boolean;
  onRunSetup: () => Promise<void>;
  onBuildWizard: () => void;
  getLoadableSubjectsForClass: (classConfig: WizardClassConfig) => SetupSubjectOption[];
  updateClassConfig: (classId: string, updater: (current: WizardClassConfig) => WizardClassConfig) => void;
  goToReviewStep: () => void;
  setupSummary: SetupSummary | null;
  setSetupSummary: (summary: SetupSummary | null) => void;
}

function WizardModal({
  isOpen,
  onClose,
  wizardStep,
  setWizardStep,
  selectedEducationLevelId,
  setSelectedEducationLevelId,
  defaultTeacherId,
  setDefaultTeacherId,
  defaultFullMark,
  setDefaultFullMark,
  defaultPassMark,
  setDefaultPassMark,
  includeOptionalSubjects,
  setIncludeOptionalSubjects,
  wizardClassConfigs,
  setWizardClassConfigs,
  educationLevels,
  teachers,
  classes,
  selectedLevel,
  validatedPredefined,
  predefinedPreview,
  wizardHasClassValidationErrors,
  isRunningSetup,
  loading,
  onRunSetup,
  onBuildWizard,
  getLoadableSubjectsForClass,
  updateClassConfig,
  goToReviewStep,
  setupSummary,
  setSetupSummary,
}: WizardModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle>Subject Setup Wizard</DialogTitle>
            <p className="text-sm text-gray-600 mt-1">Bulk assign subjects to classes by education level</p>
          </div>
          <button onClick={onClose} className="rounded-md hover:bg-gray-100 p-1">
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        {/* Step Progress Indicator */}
        <div className="grid grid-cols-3 gap-2 py-4 border-b">
          {[1, 2, 3].map((step) => (
            <button
              key={step}
              onClick={() => step < wizardStep && setWizardStep(step as 1 | 2 | 3)}
              className={`rounded-md p-2 text-xs font-medium transition-colors ${
                wizardStep === step
                  ? "bg-blue-100 text-blue-900 border border-blue-300"
                  : wizardStep > step
                    ? "bg-green-50 text-green-900 border border-green-200 cursor-pointer"
                    : "bg-gray-100 text-gray-500 border border-gray-200"
              }`}
            >
              {wizardStep > step && <CheckCircle2 className="h-4 w-4 inline mr-1" />}
              Step {step}
            </button>
          ))}
        </div>

        <div className="py-4 space-y-4">
          {/* Step 1: Select Level and Defaults */}
          {wizardStep === 1 && (
            <Step1Content
              educationLevels={educationLevels}
              selectedEducationLevelId={selectedEducationLevelId}
              setSelectedEducationLevelId={setSelectedEducationLevelId}
              defaultTeacherId={defaultTeacherId}
              setDefaultTeacherId={setDefaultTeacherId}
              defaultFullMark={defaultFullMark}
              setDefaultFullMark={setDefaultFullMark}
              defaultPassMark={defaultPassMark}
              setDefaultPassMark={setDefaultPassMark}
              teachers={teachers}
              includeOptionalSubjects={includeOptionalSubjects}
              setIncludeOptionalSubjects={setIncludeOptionalSubjects}
              selectedLevel={selectedLevel}
              predefinedPreview={predefinedPreview}
            />
          )}

          {/* Step 2: Configure Classes */}
          {wizardStep === 2 && (
            <Step2Content
              wizardClassConfigs={wizardClassConfigs}
              wizardHasClassValidationErrors={wizardHasClassValidationErrors}
              getLoadableSubjectsForClass={getLoadableSubjectsForClass}
              updateClassConfig={updateClassConfig}
              teachers={teachers}
              validatedPredefined={validatedPredefined}
            />
          )}

          {/* Step 3: Review and Confirm */}
          {wizardStep === 3 && (
            <Step3Content
              wizardClassConfigs={wizardClassConfigs}
              setupSummary={setupSummary}
            />
          )}
        </div>

        {/* Footer Navigation */}
        <DialogFooter className="flex justify-between gap-2 border-t pt-4">
          <div className="flex gap-2">
            {wizardStep > 1 && (
              <Button
                variant="outline"
                onClick={() => {
                  if (wizardStep === 3) setWizardStep(2);
                  else if (wizardStep === 2) setWizardStep(1);
                }}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>

            {wizardStep === 1 && (
              <Button onClick={onBuildWizard} disabled={!selectedLevel || loading || isRunningSetup}>
                Next: Configure Classes
              </Button>
            )}

            {wizardStep === 2 && (
              <Button
                onClick={goToReviewStep}
                disabled={wizardHasClassValidationErrors}
              >
                Next: Review
              </Button>
            )}

            {wizardStep === 3 && (
              <Button
                onClick={onRunSetup}
                disabled={isRunningSetup || wizardHasClassValidationErrors}
              >
                {isRunningSetup ? "Running setup..." : "Confirm & Setup"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Step 1 Component
function Step1Content({
  educationLevels,
  selectedEducationLevelId,
  setSelectedEducationLevelId,
  defaultTeacherId,
  setDefaultTeacherId,
  defaultFullMark,
  setDefaultFullMark,
  defaultPassMark,
  setDefaultPassMark,
  teachers,
  includeOptionalSubjects,
  setIncludeOptionalSubjects,
  selectedLevel,
  predefinedPreview,
}: {
  educationLevels: EducationLevelOption[];
  selectedEducationLevelId: string;
  setSelectedEducationLevelId: (id: string) => void;
  defaultTeacherId: string;
  setDefaultTeacherId: (id: string) => void;
  defaultFullMark: string;
  setDefaultFullMark: (mark: string) => void;
  defaultPassMark: string;
  setDefaultPassMark: (mark: string) => void;
  teachers: Teacher[];
  includeOptionalSubjects: boolean;
  setIncludeOptionalSubjects: (include: boolean) => void;
  selectedLevel: EducationLevelOption | null;
  predefinedPreview: { subjects: SetupSubjectOption[]; warnings: string[] };
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="step1_education_level" className="font-medium">Education Level</Label>
        <select
          id="step1_education_level"
          className="mt-2 w-full rounded-md border px-3 py-2"
          value={selectedEducationLevelId}
          onChange={(e) => setSelectedEducationLevelId(e.target.value)}
        >
          <option value="">Select level...</option>
          {educationLevels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="step1_teacher" className="font-medium">Default Teacher (optional)</Label>
          <select
            id="step1_teacher"
            className="mt-2 w-full rounded-md border px-3 py-2"
            value={defaultTeacherId}
            onChange={(e) => setDefaultTeacherId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.first_name} {teacher.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="step1_full_mark" className="font-medium">Default Full Mark</Label>
          <Input
            id="step1_full_mark"
            type="number"
            min="1"
            value={defaultFullMark}
            onChange={(e) => setDefaultFullMark(e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="step1_pass_mark" className="font-medium">Default Pass Mark</Label>
          <Input
            id="step1_pass_mark"
            type="number"
            min="0"
            value={defaultPassMark}
            onChange={(e) => setDefaultPassMark(e.target.value)}
            className="mt-2"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label className="font-medium">Include Optional Subjects</Label>
          <p className="text-xs text-gray-500">Toggle optional subjects for all classes</p>
        </div>
        <Switch checked={includeOptionalSubjects} onCheckedChange={setIncludeOptionalSubjects} />
      </div>

      {/* Subject Preview */}
      {selectedLevel && (
        <div className="rounded-md border bg-gray-50 p-4 space-y-3">
          <div>
            <p className="font-medium text-sm">{predefinedPreview.subjects.length} Predefined Subjects</p>
            <p className="text-xs text-gray-600">For {selectedLevel.name}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {predefinedPreview.subjects.slice(0, 15).map((subject) => (
              <Badge key={subject.name} variant="outline">
                {subject.name}
              </Badge>
            ))}
            {predefinedPreview.subjects.length > 15 && (
              <Badge variant="secondary">+{predefinedPreview.subjects.length - 15} more</Badge>
            )}
          </div>

          {predefinedPreview.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-medium flex gap-1">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                {predefinedPreview.warnings.length} warning(s)
              </p>
              <ul className="mt-1 list-disc pl-5">
                {predefinedPreview.warnings.slice(0, 2).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Step 2 Component
function Step2Content({
  wizardClassConfigs,
  wizardHasClassValidationErrors,
  getLoadableSubjectsForClass,
  updateClassConfig,
  teachers,
  validatedPredefined,
}: {
  wizardClassConfigs: WizardClassConfig[];
  wizardHasClassValidationErrors: boolean;
  getLoadableSubjectsForClass: (classConfig: WizardClassConfig) => SetupSubjectOption[];
  updateClassConfig: (classId: string, updater: (current: WizardClassConfig) => WizardClassConfig) => void;
  teachers: Teacher[];
  validatedPredefined: { loadable: SetupSubjectOption[]; warnings: string[] };
}) {
  const [expandedClassId, setExpandedClassId] = useState<string | null>(
    wizardClassConfigs.length === 1 ? wizardClassConfigs[0].classId : null
  );

  return (
    <div className="space-y-3">
      {wizardHasClassValidationErrors && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Fix invalid marks or zero selected subjects before proceeding</p>
        </div>
      )}

      {wizardClassConfigs.map((classConfig) => (
        <ClassConfigCard
          key={classConfig.classId}
          classConfig={classConfig}
          isExpanded={expandedClassId === classConfig.classId}
          onToggle={() =>
            setExpandedClassId(expandedClassId === classConfig.classId ? null : classConfig.classId)
          }
          getLoadableSubjectsForClass={getLoadableSubjectsForClass}
          updateClassConfig={updateClassConfig}
          teachers={teachers}
          validatedPredefined={validatedPredefined}
        />
      ))}
    </div>
  );
}

// Class Config Card Component
function ClassConfigCard({
  classConfig,
  isExpanded,
  onToggle,
  getLoadableSubjectsForClass,
  updateClassConfig,
  teachers,
  validatedPredefined,
}: {
  classConfig: WizardClassConfig;
  isExpanded: boolean;
  onToggle: () => void;
  getLoadableSubjectsForClass: (classConfig: WizardClassConfig) => SetupSubjectOption[];
  updateClassConfig: (classId: string, updater: (current: WizardClassConfig) => WizardClassConfig) => void;
  teachers: Teacher[];
  validatedPredefined: { loadable: SetupSubjectOption[]; warnings: string[] };
}) {
  const classSubjects = getLoadableSubjectsForClass(classConfig);
  const fullMark = Number(classConfig.fullMark);
  const passMark = Number(classConfig.passMark);
  const hasInvalidMarks =
    !Number.isFinite(fullMark) ||
    fullMark <= 0 ||
    !Number.isFinite(passMark) ||
    passMark < 0 ||
    passMark > fullMark;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between font-medium text-sm transition-colors"
      >
        <div className="flex items-center gap-2">
          <p>{classConfig.className}</p>
          <Badge variant={classConfig.selectedSubjectNames.length > 0 ? "default" : "outline"}>
            {classConfig.selectedSubjectNames.length} subject(s)
          </Badge>
          {hasInvalidMarks && <Badge variant="destructive">Error</Badge>}
        </div>
        <p className="text-xs text-gray-600">{isExpanded ? "▼" : "▶"}</p>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-3 border-t">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="text-xs font-medium">Teacher</Label>
              <select
                className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                value={classConfig.teacherId}
                onChange={(e) =>
                  updateClassConfig(classConfig.classId, (current) => ({
                    ...current,
                    teacherId: e.target.value,
                  }))
                }
              >
                <option value="">Unassigned</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.first_name} {teacher.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-medium">Full Mark</Label>
              <Input
                type="number"
                min="1"
                value={classConfig.fullMark}
                onChange={(e) =>
                  updateClassConfig(classConfig.classId, (current) => ({
                    ...current,
                    fullMark: e.target.value,
                  }))
                }
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Pass Mark</Label>
              <Input
                type="number"
                min="0"
                value={classConfig.passMark}
                onChange={(e) =>
                  updateClassConfig(classConfig.classId, (current) => ({
                    ...current,
                    passMark: e.target.value,
                  }))
                }
                className="mt-1 text-sm"
              />
            </div>
          </div>

          {hasInvalidMarks && (
            <p className="text-xs text-red-600">
              Pass mark must be between 0 and full mark
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Subjects ({classConfig.selectedSubjectNames.length})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateClassConfig(classConfig.classId, (current) => ({
                    ...current,
                    selectedSubjectNames: classSubjects.map((s) => s.name),
                  }))
                }
              >
                Select All
              </Button>
            </div>

            <div className="max-h-40 overflow-y-auto grid gap-1.5 md:grid-cols-2">
              {classSubjects.map((subject) => {
                const isSelected = classConfig.selectedSubjectNames.includes(subject.name);
                return (
                  <label
                    key={`${classConfig.classId}-${subject.name}`}
                    className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        updateClassConfig(classConfig.classId, (current) => {
                          const next = new Set(current.selectedSubjectNames);
                          if (e.target.checked) {
                            next.add(subject.name);
                          } else {
                            next.delete(subject.name);
                          }
                          return {
                            ...current,
                            selectedSubjectNames: Array.from(next).sort((a, b) =>
                              a.localeCompare(b)
                            ),
                          };
                        })
                      }
                      className="rounded"
                    />
                    <span>{subject.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {classConfig.selectedSubjectNames.length === 0 && (
            <p className="text-xs text-red-600">Please select at least one subject</p>
          )}
        </div>
      )}
    </div>
  );
}

// Step 3 Component
function Step3Content({
  wizardClassConfigs,
  setupSummary,
}: {
  wizardClassConfigs: WizardClassConfig[];
  setupSummary: SetupSummary | null;
}) {
  if (setupSummary) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-2">
        <p className="font-medium text-green-900 flex gap-2">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          Setup Completed Successfully!
        </p>
        <ul className="text-sm text-green-800 space-y-1 ml-7">
          <li>• Created {setupSummary.createdCatalogSubjects} new subject(s)</li>
          <li>• Added {setupSummary.createdAssignments} class assignment(s)</li>
          <li>• Skipped {setupSummary.skippedAlreadyAssigned} existing assignment(s)</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Review your configuration before confirming:</p>

      {wizardClassConfigs.map((classConfig) => (
        <div
          key={`review-${classConfig.classId}`}
          className="rounded-md border border-blue-200 bg-blue-50 p-3"
        >
          <p className="font-medium text-sm">{classConfig.className}</p>
          <table className="mt-2 text-xs text-gray-700 w-full">
            <tbody>
              <tr>
                <td className="pr-4">Teacher:</td>
                <td>{classConfig.teacherId ? "Assigned" : "Unassigned"}</td>
              </tr>
              <tr>
                <td className="pr-4">Marks:</td>
                <td>
                  {classConfig.passMark}/{classConfig.fullMark}
                </td>
              </tr>
              <tr>
                <td className="pr-4">Subjects:</td>
                <td>{classConfig.selectedSubjectNames.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
