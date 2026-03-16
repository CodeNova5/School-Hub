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
import { toast } from "sonner";
import { Search, Wrench, ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Department, Religion, Subject, Teacher } from "@/lib/types";
import { useSchoolContext } from "@/hooks/use-school-context";
import { useSchoolConfig } from "@/hooks/use-school-config";
import {
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

function generateSubjectCode(subjectName: string, className: string) {
  const prefix = subjectName.replace(/\s+/g, "").slice(0, 3).toUpperCase();
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

  const [loading, setLoading] = useState(true);
  const [isRunningSetup, setIsRunningSetup] = useState(false);
  const [setupSummary, setSetupSummary] = useState<SetupSummary | null>(null);

  const [selectedEducationLevelId, setSelectedEducationLevelId] = useState("");
  const [defaultTeacherId, setDefaultTeacherId] = useState("");
  const [defaultFullMark, setDefaultFullMark] = useState("100");
  const [defaultPassMark, setDefaultPassMark] = useState("40");
  const [includeOptionalSubjects, setIncludeOptionalSubjects] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevelId, setFilterLevelId] = useState<"all" | string>("all");

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

  const predefinedPreview = useMemo(() => {
    if (!selectedLevel) {
      return {
        subjects: [] as ReturnType<typeof getSubjectsForLevel>,
        warnings: [] as string[],
      };
    }

    const predefined = getSubjectsForLevel(selectedLevel.name);
    const validated = validatePredefinedSubjectsForSchool(
      predefined,
      (religions || []) as Religion[]
    );

    const filtered = includeOptionalSubjects
      ? validated.loadable
      : validated.loadable.filter((subject) => !subject.isOptional);

    return {
      subjects: filtered,
      warnings: validated.warnings,
    };
  }, [selectedLevel, includeOptionalSubjects, religions]);

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
      ]);

      if (levelsResponse.error) throw levelsResponse.error;
      if (subjectsResponse.error) throw subjectsResponse.error;
      if (classesResponse.error) throw classesResponse.error;
      if (assignmentsResponse.error) throw assignmentsResponse.error;
      if (teachersResponse.error) throw teachersResponse.error;

      setEducationLevels((levelsResponse.data || []) as EducationLevelOption[]);
      setSubjects((subjectsResponse.data || []) as Subject[]);
      setClasses((classesResponse.data || []) as ClassWithLevel[]);
      setAssignments((assignmentsResponse.data || []) as SubjectAssignmentRow[]);
      setTeachers((teachersResponse.data || []) as Teacher[]);
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

    const fullMark = Number(defaultFullMark);
    const passMark = Number(defaultPassMark);

    if (!Number.isFinite(fullMark) || fullMark <= 0) {
      toast.error("Full mark must be greater than 0");
      return;
    }

    if (!Number.isFinite(passMark) || passMark < 0 || passMark > fullMark) {
      toast.error("Pass mark must be between 0 and full mark");
      return;
    }

    const classesInLevel = classes.filter(
      (classItem) => classItem.school_class_levels?.education_level_id === selectedLevel.id
    );

    if (classesInLevel.length === 0) {
      toast.error("No classes found under this education level");
      return;
    }

    const predefined = getSubjectsForLevel(selectedLevel.name);
    const { loadable } = validatePredefinedSubjectsForSchool(
      predefined,
      (religions || []) as Religion[]
    );

    const selectedSubjects = includeOptionalSubjects
      ? loadable
      : loadable.filter((subject) => !subject.isOptional);

    if (selectedSubjects.length === 0) {
      toast.error("No loadable predefined subjects for this level");
      return;
    }

    setIsRunningSetup(true);

    try {
      const classIds = classesInLevel.map((item) => item.id);

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

      const subjectsMissingInCatalog = selectedSubjects.filter(
        (subject) => !catalogByName.has(subject.name.toLowerCase())
      );

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

      for (const setupSubject of selectedSubjects) {
        const subjectId = catalogByName.get(setupSubject.name.toLowerCase());
        if (!subjectId) {
          continue;
        }

        if (!defaultDepartmentCache.has(setupSubject.name)) {
          defaultDepartmentCache.set(
            setupSubject.name,
            getSmartDepartmentId(setupSubject.name, (departments || []) as Department[])
          );
        }

        if (!defaultReligionCache.has(setupSubject.name)) {
          defaultReligionCache.set(
            setupSubject.name,
            getSmartReligionId(setupSubject.name, (religions || []) as Religion[])
          );
        }

        for (const classItem of classesInLevel) {
          const key = `${subjectId}::${classItem.id}`;
          if (existingPairs.has(key)) {
            continue;
          }

          payload.push({
            school_id: schoolId,
            subject_id: subjectId,
            class_id: classItem.id,
            teacher_id: defaultTeacherId || null,
            department_id: defaultDepartmentCache.get(setupSubject.name) || null,
            religion_id: defaultReligionCache.get(setupSubject.name) || null,
            is_optional: Boolean(setupSubject.isOptional),
            full_mark_obtainable: fullMark,
            pass_mark: passMark,
            subject_code: generateSubjectCode(setupSubject.name, classItem.name),
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

      const skippedAlreadyAssigned = selectedSubjects.length * classesInLevel.length - createdAssignments;

      setSetupSummary({
        createdCatalogSubjects,
        createdAssignments,
        skippedAlreadyAssigned,
      });

      toast.success("Initial setup completed");
      await loadPageData();
    } catch (error: any) {
      console.error("Initial setup error:", error);
      toast.error(error?.message || "Failed to run initial setup");
    } finally {
      setIsRunningSetup(false);
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Subject Setup</h1>
          <p className="text-gray-600">
            This page is for initial rollout only. Detailed subject configuration now belongs in each class.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Initial Setup Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-gray-700 md:grid-cols-3">
            <div className="rounded-lg border bg-gray-50 p-4">
              1. Pick an education level and preview predefined subjects.
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              2. Apply defaults once and assign subjects to every class in that level.
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              3. Fine-tune any class via the class Subjects tab.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run Initial Setup by Education Level</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="education_level">Education Level</Label>
                <select
                  id="education_level"
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={selectedEducationLevelId}
                  onChange={(event) => setSelectedEducationLevelId(event.target.value)}
                >
                  <option value="">Select level</option>
                  {educationLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="default_teacher">Default Teacher (optional)</Label>
                <select
                  id="default_teacher"
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={defaultTeacherId}
                  onChange={(event) => setDefaultTeacherId(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.first_name} {teacher.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="default_full_mark">Default Full Mark</Label>
                <Input
                  id="default_full_mark"
                  type="number"
                  min="1"
                  value={defaultFullMark}
                  onChange={(event) => setDefaultFullMark(event.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="default_pass_mark">Default Pass Mark</Label>
                <Input
                  id="default_pass_mark"
                  type="number"
                  min="0"
                  value={defaultPassMark}
                  onChange={(event) => setDefaultPassMark(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label htmlFor="include_optional">Include optional predefined subjects</Label>
                <p className="text-xs text-gray-500">
                  Turn this off if you want only compulsory setup during rollout.
                </p>
              </div>
              <Switch
                id="include_optional"
                checked={includeOptionalSubjects}
                onCheckedChange={setIncludeOptionalSubjects}
              />
            </div>

            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
              <p className="text-sm font-medium">Predefined Subject Preview</p>
              {selectedLevel ? (
                <>
                  <p className="text-sm text-gray-600">
                    {predefinedPreview.subjects.length} loadable subject(s) for {selectedLevel.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {predefinedPreview.subjects.slice(0, 20).map((subject) => (
                      <Badge key={subject.name} variant="outline">
                        {subject.name}
                      </Badge>
                    ))}
                    {predefinedPreview.subjects.length > 20 && (
                      <Badge variant="secondary">+{predefinedPreview.subjects.length - 20} more</Badge>
                    )}
                  </div>

                  {predefinedPreview.warnings.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-medium">
                        {predefinedPreview.warnings.length} warning(s) based on school religion config:
                      </p>
                      <ul className="mt-1 list-disc pl-5">
                        {predefinedPreview.warnings.slice(0, 4).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                        {predefinedPreview.warnings.length > 4 && (
                          <li>And {predefinedPreview.warnings.length - 4} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">Select an education level to preview subjects.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button onClick={handleRunInitialSetup} disabled={isRunningSetup || loading}>
                {isRunningSetup ? "Running setup..." : "Run Initial Setup"}
              </Button>
              <span className="text-xs text-gray-500">
                Safe to re-run. Existing class assignments are left untouched.
              </span>
            </div>

            {setupSummary && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <p className="font-medium">Setup complete</p>
                <p>
                  Created {setupSummary.createdCatalogSubjects} new catalog subject(s), added{" "}
                  {setupSummary.createdAssignments} class assignment(s), skipped{" "}
                  {setupSummary.skippedAlreadyAssigned} already existing assignment(s).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Subject Coverage and Class Links
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
                  <div key={row.subjectId} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{row.subjectName}</p>
                        <p className="text-xs text-gray-500">Catalog code: {row.catalogCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={row.classIds.length > 0 ? "default" : "secondary"}>
                          {row.classIds.length} class(es)
                        </Badge>
                      </div>
                    </div>

                    {row.classIds.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">Not assigned to any class yet.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.classIds.map((classId, index) => (
                          <Link
                            key={`${row.subjectId}-${classId}`}
                            href={`/admin/classes/${classId}?tab=subjects`}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
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
    </DashboardLayout>
  );
}
