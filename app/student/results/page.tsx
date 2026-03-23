"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth";
import { Session, Term } from "@/lib/types";
import { useSchoolContext } from "@/hooks/use-school-context";

export default function StudentResultPage() {
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [hasResults, setHasResults] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [classId, setClassId] = useState<string>("");
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadStudentData();
    }
  }, [schoolId, schoolLoading]);

  useEffect(() => {
    if (studentId && selectedSessionId && selectedTermId && schoolId) {
      checkForResults();
    }
  }, [studentId, selectedSessionId, selectedTermId, schoolId]);

  async function loadStudentData() {
    if (!schoolId) return;
    try {
      setLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        return;
      }

      // Fetch student details
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          student_id,
          first_name,
          last_name,
          classes (
            id,
            name
          )
        `)
        .eq("user_id", user.id)
        .eq("school_id", schoolId)
        .single();

      if (studentError || !studentData) {
        toast.error("Student profile not found");
        return;
      }

      setStudentId(studentData.id);
      setStudentName(`${studentData.first_name} ${studentData.last_name}`);
      
      const classData = studentData.classes as any;
      setStudentClass(classData?.name || "No class assigned");
      setClassId(classData?.id || "");

      // Fetch all sessions and terms
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select("*")
        .eq("school_id", schoolId)
        .order("name", { ascending: false });

      const { data: termsData } = await supabase
        .from("terms")
        .select("*")
        .eq("school_id", schoolId)
        .order("start_date", { ascending: false });

      setSessions(sessionsData || []);
      setTerms(termsData || []);

      // Set current session and term as default
      const currentSession = sessionsData?.find((s: Session) => s.is_current);
      const currentTerm = termsData?.find((t: Term) => t.is_current);

      if (currentSession) setSelectedSessionId(currentSession.id);
      if (currentTerm) setSelectedTermId(currentTerm.id);

    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Failed to load student data");
    } finally {
      setLoading(false);
    }
  }

  async function checkForResults() {
    if (!schoolId) return;
    try {
      // Check if results exist
      const { data: results } = await supabase
        .from("results")
        .select("id")
        .eq("student_id", studentId)
        .eq("session_id", selectedSessionId)
        .eq("term_id", selectedTermId)
        .eq("school_id", schoolId)
        .limit(1);

      setHasResults((results && results.length > 0) || false);

      // Check if results are published
      if (classId) {
        const { data: publication } = await supabase
          .from("results_publication")
          .select("is_published")
          .eq("class_id", classId)
          .eq("session_id", selectedSessionId)
          .eq("term_id", selectedTermId)
          .eq("school_id", schoolId)
          .single();

        setIsPublished(publication?.is_published || false);
      } else {
        setIsPublished(false);
      }
    } catch (error) {
      console.error("Error checking for results:", error);
      setHasResults(false);
      setIsPublished(false);
    }
  }

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your results...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-blue-600" />
              My Report Card
            </h1>
            <p className="text-gray-600 mt-1">
              {studentName} — {studentClass}
            </p>
          </div>
        </div>

        {/* Session and Term Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Select Session & Term</CardTitle>
            <p className="text-sm text-gray-500">
              Choose the academic session and term to view your results
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Session Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Academic Session</label>
                <Select 
                  value={selectedSessionId} 
                  onValueChange={setSelectedSessionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name} {session.is_current && "★ (Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Term Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Term</label>
                <Select 
                  value={selectedTermId} 
                  onValueChange={setSelectedTermId}
                  disabled={!selectedSessionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {terms
                      .filter((term) => term.session_id === selectedSessionId)
                      .map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          {term.name} {term.is_current && "★ (Current)"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Info Alert */}
        {hasResults && isPublished && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are viewing your results in read-only mode. Use the <strong>Export as PDF</strong> button above the report card to save a copy. If you notice any errors, 
              please contact your class teacher or the admin office.
            </AlertDescription>
          </Alert>
        )}

        {/* Results Display */}
        {selectedSessionId && selectedTermId ? (
          <div className="space-y-4">
            {hasResults && isPublished ? (
              <ResultEntry
                studentId={studentId}
                role="student"
                canEditPrincipalComment={false}
                canEdit={false}
                isReadOnly={true}
                sessionId={selectedSessionId}
                termId={selectedTermId}
              />
            ) : hasResults && !isPublished ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-yellow-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Results Not Yet Published
                    </h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Your results for this term are being prepared and have not been published yet. 
                      Please check back later or contact your class teacher.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      No Results Available
                    </h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Results for the selected session and term have not been uploaded yet. 
                      Please check back later or contact your class teacher.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <p>Please select both a session and term to view your results.</p>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
