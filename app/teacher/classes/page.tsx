"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Trophy, TrendingUp, PieChart, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { Class, Subject } from "@/lib/types";

// Types for analytics
interface ClassWithAnalytics extends Class {
  studentCount: number;
  subjects: Subject[];
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
      const user = await getCurrentUser();
      if (!user) return toast.error("Please log in");

      const teacher = await getTeacherByUserId(user.id);
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
        // Students
        const { data: studentsData } = await supabase
          .from("students")
          .select("id, gender")
          .eq("class_id", cls.id)
          .eq("status", "active");

        const studentIds = studentsData?.map(s => s.id) || [];

        // Count
        const studentCount = studentIds.length;

        // Gender distribution
        const genderCount = {
          male: studentsData?.filter(s => s.gender === "Male").length || 0,
          female: studentsData?.filter(s => s.gender === "Female").length || 0,
        };

        // Subjects in class
        const { data: subjectLinks } = await supabase
          .from("subject_classes")
          .select("subject_id")
          .eq("class_id", cls.id);

        const subjectIds = subjectLinks?.map(s => s.subject_id) || [];

        const { data: subjectList } = await supabase
          .from("subjects")
          .select("*")
          .in("id", subjectIds);

        const subjects: Subject[] = subjectList || [];

        // Results
        const { data: results } = await supabase
          .from("results")
          .select("*")
          .in("student_id", studentIds);

        let avgScore = 0;
        let passRate = 0;
        let topStudent = null;

        if (results && results.length > 0) {
          const allScores = results.map(r => r.total);
          const passes = results.filter(r => r.total >= 50).length;

          avgScore = Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1));
          passRate = Number(((passes / allScores.length) * 100).toFixed(1));

          // Top student
          const best = results.reduce((a, b) => (a.total > b.total ? a : b));
          const { data: topStudentData } = await supabase
            .from("students")
            .select("first_name, last_name")
            .eq("id", best.student_id)
            .single();

          topStudent = `${topStudentData?.first_name} ${topStudentData?.last_name}`;
        }

        // Avg performance per subject
        let subjectPerformance: { name: string; avg: number }[] = [];

        subjects.forEach(sub => {
          const filtered = results?.filter(r => r.subject_id === sub.id) || [];
          const avg = filtered.length
            ? Number(
                (
                  filtered.reduce((a, b) => a + b.total, 0) / filtered.length
                ).toFixed(1)
              )
            : 0;
          subjectPerformance.push({ name: sub.name, avg });
        });

        finalData.push({
          ...cls,
          studentCount,
          subjects,
          avgScore,
          passRate,
          topStudent,
          genderCount,
          subjectPerformance,
        });
      }

      setClasses(finalData);
    } catch (err: any) {
      toast.error("Failed to load classes: " + err.message);
    }

    setIsLoading(false);
  }

  const getLevelColor = (educationLevel: string) => {
    switch (educationLevel) {
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
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">My Classes</h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {classes.map(cls => (
            <Card key={cls.id} className="hover:shadow-lg transition">
              <CardHeader>
                <CardTitle className="flex justify-between">
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
                    <p className="font-bold">{cls.avgScore || 0}%</p>
                  </div>

                  <div className="p-3 rounded bg-yellow-50">
                    <p className="text-xs">Pass Rate</p>
                    <p className="font-bold">{cls.passRate || 0}%</p>
                  </div>

                  <div className="p-3 rounded bg-purple-50">
                    <p className="text-xs">Top</p>
                    <p className="font-bold truncate">{cls.topStudent || "—"}</p>
                  </div>
                </div>

                {/* Gender distribution */}
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

                {/* Subject performance */}
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

                {/* Subject List */}
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-sm font-medium">Subjects</span>
                  </div>

                  <div className="max-h-32 overflow-y-auto text-sm space-y-1">
                    {cls.subjects.map(sub => (
                      <div key={sub.id} className="py-1 px-2 bg-gray-50 rounded">
                        {sub.name}
                      </div>
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
