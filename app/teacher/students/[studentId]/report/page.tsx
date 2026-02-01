"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import ResultEntry from "@/components/ResultEntry";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Session, Term } from "@/lib/types";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";

export default function TeacherStudentReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const termId = searchParams.get("term");
  const sessionId = searchParams.get("session");

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState(sessionId || "");
  const [selectedTermId, setSelectedTermId] = useState(termId || "");
  const [canEdit, setCanEdit] = useState(false);
  const [isStudentInTeacherClass, setIsStudentInTeacherClass] = useState(false);

  useEffect(() => {
    async function loadStudentData() {
      setLoading(true);
      try {
        // Get current teacher
        const user = await getCurrentUser();
        if (!user) {
          toast.error("Please log in to continue");
          router.push("/teacher/login");
          return;
        }

        const teacher = await getTeacherByUserId(user.id);
        if (!teacher) {
          toast.error("Teacher profile not found");
          router.push("/teacher/login");
          return;
        }

        // Fetch student details
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("first_name, last_name, class_id")
          .eq("id", studentId)
          .single();

        if (studentError || !studentData) {
          toast.error("Student not found");
          router.push("/teacher/students");
          return;
        }

        setStudentName(`${studentData.first_name} ${studentData.last_name}`);

        // Check if this student is in a class taught by the teacher
        const { data: teacherClasses, error: classError } = await supabase
          .from("classes")
          .select("id")
          .eq("class_teacher_id", teacher.id);

        if (classError) {
          console.error("Error fetching teacher classes:", classError);
          toast.error("Failed to verify teacher access");
          return;
        }

        const teacherClassIds = teacherClasses?.map((c) => c.id) || [];
        const studentInTeacherClass = teacherClassIds.includes(studentData.class_id);
        
        setIsStudentInTeacherClass(studentInTeacherClass);
        
        // Teachers can only edit students in their own class
        setCanEdit(studentInTeacherClass);

        if (!studentInTeacherClass) {
          toast.warning("This student is not in your class. Viewing in read-only mode.");
        }

        // Fetch all sessions and terms
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

        // If no session/term provided, fetch current ones
        if (!sessionId || !termId) {
          const currentSession = sessionsData?.find((s) => s.is_current);
          const currentTerm = termsData?.find((t) => t.is_current);

          if (currentSession) setSelectedSessionId(currentSession.id);
          if (currentTerm) setSelectedTermId(currentTerm.id);
        }
      } catch (error) {
        console.error("Error loading student data:", error);
        toast.error("Failed to load student data");
      } finally {
        setLoading(false);
      }
    }

    if (studentId) {
      loadStudentData();
    }
  }, [studentId, sessionId, termId, router]);

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!studentId) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">No student selected</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Student Report Card</h1>
            <p className="text-muted-foreground mt-1">
              {studentName}
              {!isStudentInTeacherClass && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Read-only (Not in your class)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Session and Term Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <label className="text-sm font-medium">Session</label>
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name} {session.is_current && "(Current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Term</label>
            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name} {term.is_current && "(Current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedSessionId && selectedTermId ? (
          <ResultEntry
            studentId={studentId}
            role="teacher"
            canEditPrincipalComment={false}
            canEdit={canEdit}
            isReadOnly={!canEdit}
            sessionId={selectedSessionId}
            termId={selectedTermId}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Unable to load report. Session or term information is missing.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
