"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, GraduationCap, Settings2, ExternalLink, BookMarked, School, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Subject } from "@/lib/types";
import { useSchoolContext } from "@/hooks/use-school-context";
import { SubjectsSkeleton } from "@/components/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          <Card className="stat-card-enter border-slate-200 shadow-sm" style={{ animationDelay: "0ms" }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <School className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-blue-700">{stats.totalClasses}</p>
                <p className="text-xs text-muted-foreground">Total Classes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card-enter border-slate-200 shadow-sm" style={{ animationDelay: "60ms" }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <BookMarked className="h-4 w-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-700">{stats.assignedClasses}</p>
                <p className="text-xs text-muted-foreground">Configured</p>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card-enter border-slate-200 shadow-sm" style={{ animationDelay: "120ms" }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-700">{stats.unconfiguredClasses}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card-enter border-slate-200 shadow-sm" style={{ animationDelay: "180ms" }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4 text-purple-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-purple-700">{stats.totalSubjects}</p>
                <p className="text-xs text-muted-foreground">Subjects</p>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card-enter border-slate-200 shadow-sm" style={{ animationDelay: "240ms" }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-indigo-700" />
              </div>
              <div>
                <p className="text-xl font-bold text-indigo-700">{stats.avgSubjectsPerClass}</p>
                <p className="text-xs text-muted-foreground">Avg per Class</p>
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
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subjects..."
                  className="pl-10 h-10 rounded-xl"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <Select value={filterLevelId} onValueChange={(v) => setFilterLevelId(v)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="All education levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All education levels</SelectItem>
                  {educationLevels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subjectCoverage.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-10 text-center">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No subjects matched your filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subjectCoverage.map((row, idx) => (
                  <Link
                    key={row.subjectId}
                    href={`/admin/subjects/${row.subjectId}`}
                    className="subject-card-enter block rounded-xl border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="font-semibold hover:text-primary transition-colors flex items-center gap-1.5">
                            {row.subjectName}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          <p className="text-xs text-muted-foreground">Code: <span className="font-mono font-medium">{row.catalogCode}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={row.classIds.length > 0 ? "default" : "secondary"} className="text-xs">
                          {row.classIds.length} class{row.classIds.length !== 1 ? "es" : ""}
                        </Badge>
                        <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          View details →
                        </span>
                      </div>
                    </div>

                    {row.classIds.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">Not assigned to any class yet.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {row.classNames.map((name, index) => (
                          <span
                            key={`${row.subjectId}-${row.classIds[index]}`}
                            className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            <GraduationCap className="h-3 w-3" />
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ ANIMATIONS ═══ */}
        <style>{`
          .stat-card-enter {
            animation: cardFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .subject-card-enter {
            animation: cardFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          @keyframes cardFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .stat-card-enter { animation: none !important; }
            .subject-card-enter { animation: none !important; }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
