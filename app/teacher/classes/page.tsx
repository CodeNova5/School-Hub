"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Trophy, TrendingUp, PieChart, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// Types for analytics
interface ClassWithAnalytics {
  id: string;
  name: string;
  level: string;
  education_level: string;
  studentCount: number;
  subjects: any[];
  avgScore: number;
  passRate: number;
  topStudent: string | null;
  genderCount: { male: number; female: number };
  subjectPerformance: { name: string; avg: number }[];
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassWithAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    setIsLoading(true);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return toast.error("Please log in");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacher) return toast.error("Teacher profile not found");

      const { data: teacherClasses } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      const classIds = teacherClasses?.map(t => t.class_id) || [];

      const { data: classesData } = await supabase
        .from("classes")
        .select("*")
        .in("id", classIds)
        .order("level");

      if (!classesData) return;

      const finalData: ClassWithAnalytics[] = [];

      for (const cls of classesData) {

        // Fetch students
        const { data: students } = await supabase
          .from("students")
          .select("id, gender")
          .eq("class_id", cls.id)
          .eq("status", "active");

        const studentIds = students?.map(s => s.id) || [];

        const genderCount = {
          male: students?.filter(s => s.gender === "male").length || 0,
          female: students?.filter(s => s.gender === "female").length || 0
        };

        // Fetch subjects
        const { data: subjectLinks } = await supabase
          .from("subject_classes")
          .select("subject_id, is_optional")
          .eq("class_id", cls.id);

        const subjectIds = subjectLinks?.map(s => s.subject_id) || [];

        const optionalMap = Object.fromEntries(
          subjectLinks?.map(s => [s.subject_id, s.is_optional]) || []
        );

        const { data: subjectList } = await supabase
          .from("subjects")
          .select("*")
          .in("id", subjectIds);

        const subjects = (subjectList || []).map(s => ({
          ...s,
          is_optional: optionalMap[s.id] || false
        }));

        // Fetch results
        const { data: results } = await supabase
          .from("results")
          .select("*")
          .in("student_id", studentIds);

        let avgScore = 0;
        let passRate = 0;
        let topStudent = null;

        if (results?.length) {
          const totals = results.map(r => r.total);

          avgScore = Number(
            (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)
          );

          passRate = Number(
            ((results.filter(r => r.total >= 50).length / results.length) * 100).toFixed(1)
          );

          const best = results.reduce((a, b) => (a.total > b.total ? a : b));

          const { data: topStudentData } = await supabase
            .from("students")
            .select("first_name, last_name")
            .eq("id", best.student_id)
            .single();

          topStudent = `${topStudentData?.first_name} ${topStudentData?.last_name}`;
        }

        // Subject performance mini chart
        const subjectPerformance = subjects.map(sub => {
          const subs = results?.filter(r => r.subject_id === sub.id) || [];
          const avg = subs.length
            ? Number((subs.reduce((a, b) => a + b.total, 0) / subs.length).toFixed(1))
            : 0;

          return { name: sub.name, avg };
        });

        finalData.push({
          ...cls,
          studentCount: studentIds.length,
          subjects,
          avgScore,
          passRate,
          topStudent,
          genderCount,
          subjectPerformance
        });
      }

      setClasses(finalData);
    } catch (err) {
      console.log(err);
    }

    setIsLoading(false);
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Primary":
        return "bg-blue-100 text-blue-700";
      case "JSS":
        return "bg-green-100 text-green-700";
      case "SSS":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="w-full space-y-8">
        
        <h1 className="text-3xl font-bold mb-4">My Classes</h1>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2 w-full">

          {classes.map(cls => (
            <Card key={cls.id} className="hover:shadow-lg transition w-full">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{cls.name}</span>
                  <Badge className={getLevelColor(cls.education_level)}>
                    {cls.level}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4">
                  
                  <div className="p-3 rounded bg-blue-50">
                    <p className="text-xs">Students</p>
                    <p className="font-bold">{cls.studentCount}</p>
                  </div>

                  <div className="p-3 rounded bg-green-50">
                    <p className="text-xs">Avg Score</p>
                    <p className="font-bold">{cls.avgScore}%</p>
                  </div>

                  <div className="p-3 rounded bg-yellow-50">
                    <p className="text-xs">Pass Rate</p>
                    <p className="font-bold">{cls.passRate}%</p>
                  </div>

                  <div className="p-3 rounded bg-purple-50">
                    <p className="text-xs">Top</p>
                    <p className="font-bold truncate">{cls.topStudent || "—"}</p>
                  </div>

                </div>

                {/* Gender Distribution */}
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <PieChart className="w-4 h-4" />
                    <span className="text-sm font-medium">Gender Distribution</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span>Male: {cls.genderCount.male}</span>
                    <span>Female: {cls.genderCount.female}</span>
                  </div>
                </Card>

                {/* Subject Performance */}
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">Subject Performance</span>
                  </div>

                  <div className="space-y-1">
                    {cls.subjectPerformance.map(sub => (
                      <div className="flex justify-between text-sm" key={sub.name}>
                        <span>{sub.name}</span>
                        <span className="font-medium">{sub.avg}%</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* SUBJECT LIST WITH ACTIONS */}
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-sm font-medium">Subjects (Clickable)</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-2">

                    {cls.subjects.map(sub => (
                      <Link
                        key={sub.id}
                        href={`/teacher/subjects/${sub.id}`}
                        className="block"
                      >
                        <div
                          className="
                          p-2 rounded border
                          hover:bg-blue-50 hover:border-blue-300 
                          cursor-pointer transition 
                          flex justify-between items-center
                        "
                          title={`${cls.studentCount} students taking this subject`}
                        >
                          <span>{sub.name}</span>

                          <Badge
                            className={
                              sub.is_optional
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }
                          >
                            {sub.is_optional ? "Optional" : "Compulsory"}
                          </Badge>
                        </div>
                      </Link>
                    ))}

                  </div>
                </Card>

              </CardContent>
            </Card>
          ))}

        </div>
      </div>
    </DashboardLayout>
  );
}
