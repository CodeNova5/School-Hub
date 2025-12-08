"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { PieChart, TrendingUp, Users, BookOpen, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { toast } from "sonner";

type ClassRow = {
  id: number;
  name: string;
  level: string;
};

type TimetableEntry = {
  day: string;
  period: string;
  subject: string;
};

type FinalClass = ClassRow & {
  avg: number;
  pass: number;
  top: string | null;
  studentCount: number;
  genderCount: { male: number; female: number };
  timetable?: TimetableEntry[];
};

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<FinalClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return toast.error("Please log in");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacher) return toast.error("Teacher profile not found");

      const { data: tc } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      const classIds = tc?.map((c) => c.class_id) ?? [];

      const { data: classData } = await supabase
        .from("classes")
        .select("*")
        .in("id", classIds)
        .order("level");

      const final: FinalClass[] = [];

      for (const cls of classData ?? []) {
        // Fetch students
        const { data: studentsRaw } = await supabase
          .from("students")
          .select("id, gender, first_name, last_name")
          .eq("class_id", cls.id)
          .eq("status", "active");

        const students = studentsRaw ?? [];
        const ids = students.map((s) => s.id);

        // Fetch results
        const { data: resultsRaw } = await supabase
          .from("results")
          .select("*")
          .in("student_id", ids);

        const results = resultsRaw ?? [];

        const avg = results.length
          ? Number(
              (results.reduce((a, b) => a + b.total, 0) / results.length).toFixed(1)
            )
          : 0;

        const pass = results.length
          ? Number(
              ((results.filter((r) => r.total >= 50).length / results.length) * 100).toFixed(2)
            )
          : 0;

        let top: string | null = null;
        if (results.length) {
          const best = results.reduce((a, b) => (a.total > b.total ? a : b));
          const sd = students.find((s) => s.id === best.student_id);
          top = sd ? `${sd.first_name} ${sd.last_name}` : null;
        }

        const genderCount = {
          male: students.filter((s) => s.gender === "male").length,
          female: students.filter((s) => s.gender === "female").length,
        };

        // Fetch timetable for this class
        const { data: timetableRaw } = await supabase
          .from("timetable")
          .select("*")
          .eq("class_id", cls.id)
          .order("day", { ascending: true })
          .order("period", { ascending: true });

        final.push({
          ...cls,
          avg,
          pass,
          top,
          genderCount,
          studentCount: ids.length,
          timetable: timetableRaw ?? [],
        });
      }

      setClasses(final);
    } catch (err) {
      console.log(err);
      toast.error("Error loading classes");
    }
    setLoading(false);
  }

  if (loading)
    return (
      <DashboardLayout role="teacher">
        <div className="flex justify-center items-center h-80 text-gray-500 text-lg">
          Loading classes...
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Classes</h1>
            <p className="text-gray-600">View class stats, top students, gender distribution, and timetable</p>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(350px,1fr))] w-full">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="rounded-2xl shadow-sm hover:shadow-lg transition-all p-6 bg-white"
            >
              {/* Class Header */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">{cls.name}</h2>
                <Badge className="bg-purple-100 text-purple-700">{cls.level}</Badge>
              </div>

              {/* Class Stats */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-xl text-center">
                  <Users className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs">Students</p>
                  <p className="font-bold text-lg">{cls.studentCount}</p>
                </div>

                <div className="p-3 bg-green-50 rounded-xl text-center">
                  <TrendingUp className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs">Avg</p>
                  <p className="font-bold text-lg">{cls.avg}%</p>
                </div>

                <div className="p-3 bg-yellow-50 rounded-xl text-center">
                  <PieChart className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs">Pass</p>
                  <p className="font-bold text-lg">{cls.pass}%</p>
                </div>

                <div className="p-3 bg-purple-50 rounded-xl text-center">
                  <Star className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs">Top</p>
                  <p className="font-bold text-sm truncate">{cls.top || "—"}</p>
                </div>
              </div>

              {/* Gender Distribution */}
              <div className="p-4 bg-gray-50 rounded-xl border mb-4">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <PieChart className="w-4 h-4" /> Gender Distribution
                </p>
                <div className="flex justify-between text-sm">
                  <span>Male: {cls.genderCount.male}</span>
                  <span>Female: {cls.genderCount.female}</span>
                </div>
              </div>

              {/* Timetable */}
              {cls.timetable && cls.timetable.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                  <p className="font-medium mb-2">Class Timetable</p>
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-2 py-1 text-left">Day</th>
                        <th className="border px-2 py-1 text-left">Period</th>
                        <th className="border px-2 py-1 text-left">Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cls.timetable.map((t, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="border px-2 py-1">{t.day}</td>
                          <td className="border px-2 py-1">{t.period}</td>
                          <td className="border px-2 py-1">{t.subject}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View Details */}
              <Link href={`/teacher/classes/${cls.id}`}>
                <div className="p-4 border hover:bg-blue-50 cursor-pointer transition rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-gray-600" />
                    <span className="font-semibold text-sm">View Class Details</span>
                  </div>
                  <p className="text-xs text-gray-500">Analytics • Subjects • Students</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
