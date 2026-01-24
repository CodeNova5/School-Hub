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
  const [sessions, setSessions] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");

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

      if (classData) {
        setIsClassTeacher(true);
        setTeacherName(teacher.first_name + " " + teacher.last_name);
      } else {
        setIsClassTeacher(false);
      }
      setLoading(false);
    }
    async function fetchSessionsAndTerms() {
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select("*")
        .order("start_date", { ascending: false });
      const { data: termsData } = await supabase
        .from("terms")
        .select("*")
        .order("start_date", { ascending: false });
      setSessions(sessionsData || []);
      setTerms(termsData || []);
      // Auto-select current session and term if available
      const currentSession = sessionsData?.find((s) => s.is_current);
      const currentTerm = termsData?.find((t) => t.is_current);
      if (currentSession) setSelectedSessionId(currentSession.id);
      if (currentTerm) setSelectedTermId(currentTerm.id);
    }
    if (studentId) {
      checkClassTeacher();
      fetchSessionsAndTerms();
    }
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
      <div className="mx-auto p-4">
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Session</label>
            <select
              className="border rounded-md p-2 w-full"
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
            >
              <option value="">Select session</option>
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.name} {session.is_current && "(Current)"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Term</label>
            <select
              className="border rounded-md p-2 w-full"
              value={selectedTermId}
              onChange={e => setSelectedTermId(e.target.value)}
            >
              <option value="">Select term</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>
                  {term.name} {term.is_current && "(Current)"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedSessionId && selectedTermId ? (
          <ResultEntry
            studentId={studentId}
            role="class_teacher"
            canEditPrincipalComment={false}
            canEdit={true}
            isReadOnly={false}
            teacherName={teacherName}
            sessionId={selectedSessionId}
            termId={selectedTermId}
          />
        ) : (
          <div className="text-center text-muted-foreground py-12">Please select session and term to enter results.</div>
        )}
      </div>
    </DashboardLayout>
  );
}
