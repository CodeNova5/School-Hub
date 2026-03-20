"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowRight, BookOpen, GraduationCap, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Subject } from "@/lib/types";
import { useSchoolContext } from "@/hooks/use-school-context";
import { SubjectsSkeleton } from "@/components/skeletons";

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

export default function SubjectsPage() {
  const { schoolId } = useSchoolContext();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassWithLevel[]>([]);
  const [assignments, setAssignments] = useState<SubjectAssignmentRow[]>([]);
  const [educationLevels, setEducationLevels] = useState<EducationLevelOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevelId, setFilterLevelId] = useState<"all" | string>("all");

  useEffect(() => {
    if (!schoolId) {
      return;
    }

    void loadPageData();
  }, [schoolId]);

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

  const stats = useMemo(() => {
    const totalClasses = classes.length;
    const totalSubjects = subjects.length;
    const assignedClasses = new Set(assignments.map((a) => a.class_id)).size;
    const unconfiguredClasses = totalClasses - assignedClasses;
    const avgSubjectsPerClass =
      totalClasses > 0 ? Math.round((assignments.length / totalClasses) * 10) / 10 : 0;

    return {
      totalClasses,
      totalSubjects,
      assignedClasses,
      unconfiguredClasses,
      avgSubjectsPerClass,
    };
  }, [classes, subjects, assignments]);

  async function loadPageData() {
    if (!schoolId) {
      return;
    }

    setLoading(true);

    try {
      const [levelsResponse, subjectsResponse, classesResponse, assignmentsResponse] = await Promise.all([
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
      ]);

      if (levelsResponse.error) throw levelsResponse.error;
      if (subjectsResponse.error) throw subjectsResponse.error;
      if (classesResponse.error) throw classesResponse.error;
      if (assignmentsResponse.error) throw assignmentsResponse.error;

      setEducationLevels((levelsResponse.data || []) as EducationLevelOption[]);
      setSubjects((subjectsResponse.data || []) as Subject[]);
      setClasses((classesResponse.data || []) as ClassWithLevel[]);
      setAssignments((assignmentsResponse.data || []) as SubjectAssignmentRow[]);
    } catch (error) {
      console.error("Error loading subjects page:", error);
      toast.error("Failed to load subject data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <SubjectsSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Subjects Overview</h1>
            <p className="text-gray-600">
              Monitor subject coverage and jump into class-level subject management. Subject creation and
              assignment setup now lives in School Config.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/school-config">
              <Settings2 className="h-4 w-4 mr-2" />
              Open School Config
            </Link>
          </Button>
        </div>

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
    </DashboardLayout>
  );
}
