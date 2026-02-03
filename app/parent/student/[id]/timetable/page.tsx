"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";

interface TimetableEntry {
  id: string;
  day: string;
  period: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  teacher_id: string;
  subjects?: {
    name: string;
  };
  teachers?: {
    first_name: string;
    last_name: string;
  };
}

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  class_id: string;
  classes?: {
    name: string;
  };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function ParentStudentTimetablePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [studentId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/parent/login");
        return;
      }

      // Verify parent and get student
      const { data: parent } = await supabase
        .from("parents")
        .select("email")
        .eq("user_id", user.id)
        .single();

      if (!parent) {
        toast.error("Parent account not found");
        router.push("/parent/dashboard");
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*, classes(name)")
        .eq("id", studentId)
        .eq("parent_email", parent.email)
        .single();

      if (studentError || !studentData) {
        toast.error("Student not found or not authorized");
        router.push("/parent/dashboard");
        return;
      }

      setStudent(studentData);

      if (!studentData.class_id) {
        setTimetable([]);
        setIsLoading(false);
        return;
      }

      // Get timetable for student's class
      const { data: timetableData, error: timetableError } = await supabase
        .from("timetable")
        .select(`
          *,
          subjects(name),
          teachers(first_name, last_name)
        `)
        .eq("class_id", studentData.class_id)
        .order("day")
        .order("period");

      if (timetableError) throw timetableError;

      setTimetable(timetableData || []);
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return null;
  }

  const periods = Array.from(new Set(timetable.map(t => t.period))).sort((a, b) => a - b);

  return (
    <DashboardLayout role="parent">
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {student.first_name} {student.last_name} - Timetable
            </h1>
            <p className="text-gray-600 mt-1">
              {student.student_id} • {student.classes?.name || "No Class"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Timetable</CardTitle>
          </CardHeader>
          <CardContent>
            {timetable.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-50">Period</th>
                      {DAYS.map(day => (
                        <th key={day} className="border p-2 bg-gray-50">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(period => {
                      const periodEntry = timetable.find(t => t.period === period);
                      const timeSlot = periodEntry 
                        ? `${periodEntry.start_time} - ${periodEntry.end_time}`
                        : "";

                      return (
                        <tr key={period}>
                          <td className="border p-2 font-medium bg-gray-50">
                            <div>Period {period}</div>
                            {timeSlot && <div className="text-xs text-gray-600">{timeSlot}</div>}
                          </td>
                          {DAYS.map(day => {
                            const entry = timetable.find(
                              t => t.day === day && t.period === period
                            );

                            return (
                              <td key={day} className="border p-2">
                                {entry ? (
                                  <div className="text-sm">
                                    <div className="font-semibold text-blue-700">
                                      {entry.subjects?.name || "Unknown"}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      {entry.teachers?.first_name} {entry.teachers?.last_name}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-gray-400 text-sm">-</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No timetable available</p>
                <p className="text-sm text-gray-500 mt-1">
                  Timetable will be shown once it's created for the class
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
