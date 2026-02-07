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

export default function StudentReportPage() {
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

  useEffect(() => {
    async function loadStudentData() {
      setLoading(true);
      try {
        // Fetch student details
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("first_name, last_name")
          .eq("id", studentId)
          .single();

        if (studentError || !studentData) {
          toast.error("Student not found");
          router.push("/admin/students");
          return;
        }

        setStudentName(`${studentData.first_name} ${studentData.last_name}`);

        // Fetch all sessions and terms
        const { data: sessionsData } = await supabase
          .from("sessions")
          .select("*")
          .order("name", { ascending: false });

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

  // When session changes, reset term selection or auto-select first term of new session
  useEffect(() => {
    if (selectedSessionId) {
      const sessionTerms = terms.filter(t => t.session_id === selectedSessionId);
      if (sessionTerms.length > 0) {
        // Auto-select first term or current term of the selected session
        const currentTerm = sessionTerms.find(t => t.is_current);
        setSelectedTermId(currentTerm?.id || sessionTerms[0].id);
      } else {
        setSelectedTermId("");
      }
    }
  }, [selectedSessionId, terms]);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!studentId) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">No student selected</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
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
            <p className="text-muted-foreground mt-1">{studentName}</p>
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
            <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedSessionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {terms
                  .filter(term => term.session_id === selectedSessionId)
                  .map((term) => (
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
            role="admin"
            canEditPrincipalComment={true}
            canEdit={true}
            isReadOnly={false}
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
