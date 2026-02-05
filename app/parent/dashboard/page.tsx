"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { 
  Users, 
  Calendar, 
  BookOpen, 
  TrendingUp, 
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Eye
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  class_id: string;
  department: string;
  status: string;
  classes?: {
    name: string;
  };
  average_attendance?: number;
  pending_assignments?: number;
  latest_result?: {
    total: number;
    grade: string;
  };
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [children, setChildren] = useState<Student[]>([]);
  const [parentName, setParentName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/parent/login");
        return;
      }

      // Get parent info
      const { data: parent, error: parentError } = await supabase
        .from("parents")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (parentError || !parent) {
        toast.error("Parent account not found");
        router.push("/parent/login");
        return;
      }

      setParentName(parent.name);

      // Get all children
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select(`
          *,
          classes(name)
        `)
        .eq("parent_email", parent.email)
        .order("first_name");

      if (studentsError) throw studentsError;

      // Fetch additional data for each child
      const enrichedStudents = await Promise.all(
        (students || []).map(async (student) => {
          // Get attendance
          const { data: attendance } = await supabase
            .from("attendance")
            .select("status")
            .eq("student_id", student.id);

          const totalRecords = attendance?.length || 0;
          const presentRecords = attendance?.filter(
            (a) => a.status === "present" || a.status === "late" || a.status === "excused"
          ).length || 0;

          const average_attendance = totalRecords === 0 ? 0 : Math.round((presentRecords / totalRecords) * 100);

          // Get pending assignments
          const { data: studentSubjects } = await supabase
            .from("student_subjects")
            .select("subject_class_id")
            .eq("student_id", student.id);

          const subjectClassIds = studentSubjects?.map(ss => ss.subject_class_id) || [];

          let pending_assignments = 0;
          if (subjectClassIds.length > 0) {
            const { data: assignments } = await supabase
              .from("assignments")
              .select("id")
              .in("subject_id", subjectClassIds)
              .gte("due_date", new Date().toISOString());

            const assignmentIds = assignments?.map(a => a.id) || [];

            if (assignmentIds.length > 0) {
              const { data: submissions } = await supabase
                .from("assignment_submissions")
                .select("assignment_id")
                .eq("student_id", student.id)
                .in("assignment_id", assignmentIds);

              const submittedIds = submissions?.map(s => s.assignment_id) || [];
              pending_assignments = assignmentIds.filter(id => !submittedIds.includes(id)).length;
            }
          }

          // Get latest result
          const { data: results } = await supabase
            .from("results")
            .select("total, grade")
            .eq("student_id", student.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return {
            ...student,
            average_attendance,
            pending_assignments,
            latest_result: results?.[0] || null,
          };
        })
      );

      setChildren(enrichedStudents);
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

  return (
    <DashboardLayout role="parent">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {parentName}</h1>
          <p className="text-gray-600 mt-1">
            Monitor your {children.length === 1 ? "child's" : "children's"} academic progress
          </p>
        </div>

      </div>
    </DashboardLayout>
  );
}
