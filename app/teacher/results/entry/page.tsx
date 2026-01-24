"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import ResultEntry from "@/components/ResultEntry";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function ResultEntryPage() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkClassTeacher() {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user || user.user_metadata?.role !== "teacher") {
        setIsClassTeacher(false);
        setLoading(false);
        return;
      }

      const teacher = await getTeacherByUserId(user.id);
      if (!teacher) {
        setIsClassTeacher(false);
        setLoading(false);
        return;
      }

      // Check if assigned as class teacher
      const { data: classData } = await supabase
        .from("classes")
        .select("id")
        .eq("class_teacher_id", teacher.id)
        .maybeSingle();

      if (classData) {
        setIsClassTeacher(true);
        setTeacherName(teacher.first_name + " " + teacher.last_name);
      } else {
        setIsClassTeacher(false);
      }
      setLoading(false);
    }
    if (studentId) checkClassTeacher();
  }, [studentId]);

  if (!studentId) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">No student selected.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isClassTeacher) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">You are not assigned as a class teacher and cannot access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <ResultEntry
        studentId={studentId}
        role="class_teacher"
        canEditPrincipalComment={false}
        canEdit={true}
        isReadOnly={false}
        teacherName={teacherName}
      />
    </DashboardLayout>
  );
}
