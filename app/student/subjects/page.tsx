"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BookOpen, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth";
import { useSchoolContext } from "@/hooks/use-school-context";

interface SubjectWithResults {
  id: string;
  subject_class_id: string;
  subject_name: string;
  subject_code: string;
  teacher_name: string;
  teacher_photo_url: string;
  class_name: string;
  currentTermResult?: any;
  currentGrade?: string;
  percentage: number;
  trend: "up" | "down" | "stable";
}

export default function StudentSubjectsPage() {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [subjects, setSubjects] = useState<SubjectWithResults[]>([]);
  const [currentTerm, setCurrentTerm] = useState<string>("");
  const [publishSettings, setPublishSettings] = useState<any>(null);
  const [maxScore, setMaxScore] = useState(0);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const GRADE_COLORS: Record<string, string> = {
    A1: "#16a34a",
    B2: "#4ade80",
    B3: "#86efac",
    C4: "#fef08a",
    C5: "#fde047",
    C6: "#facc15",
    D7: "#f97316",
    E8: "#fb923c",
    F9: "#ef4444",
  };

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadData();
    }
  }, [schoolId, schoolLoading]);

  async function loadData() {
    if (!schoolId) return;
    try {
      setLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        return;
      }

      // Get student info
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          student_id,
          first_name,
          last_name,
          gender,
          photo_url,
          class_id,
          classes (
            id,
            name,
            level,
            education_level
          )
        `)
        .eq("user_id", user.id)
        .eq("school_id", schoolId)
        .single();

      if (studentError || !studentData) {
        toast.error("Student profile not found");
        return;
      }

      setStudent(studentData);

      // Load current term
      const { data: termData } = await supabase
        .from("terms")
        .select("*")
        .eq("is_current", true)
        .eq("school_id", schoolId)
        .single();

      if (termData) setCurrentTerm(termData.id);

      // Load current session
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("id")
        .eq("is_current", true)
        .eq("school_id", schoolId)
        .single();

      if (sessionData && termData) {
        // Load publication settings for this class
        const classData = studentData.classes as any;
        const { data: pubSettings } = await supabase
          .from("results_publication")
          .select("*")
          .eq("class_id", classData.id)
          .eq("session_id", sessionData.id)
          .eq("term_id", termData.id)
          .eq("school_id", schoolId)
          .single();

        setPublishSettings(pubSettings);

        // Calculate max score based on published components
        let max = 0;
        if (pubSettings?.welcome_test_published) max += 10;
        if (pubSettings?.mid_term_test_published) max += 20;
        if (pubSettings?.vetting_published) max += 10;
        if (pubSettings?.exam_published) max += 60;
        setMaxScore(max || 100); // Default to 100 if no settings found

        loadSubjectsAndResults(studentData, sessionData.id, termData.id);
      }

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubjectsAndResults(studentData: any, sessionId: string, termId: string) {
    if (!schoolId) return;
    try {
      // Get student's enrolled subjects
      const { data: studentSubjects, error: subjectsError } = await supabase
        .from("student_subjects")
        .select(`
          subject_class_id,
          subject_classes (
            id,
            subject_code,
            subjects (
              id,
              name
            ),
            classes (
              id,
              name,
              level
            ),
            teachers (
              id,
              first_name,
              last_name,
              photo_url
            )
          )
        `)
        .eq("student_id", studentData.id)
        .eq("school_id", schoolId);

      if (subjectsError) {
        console.error("Error fetching subjects:", subjectsError);
        return;
      }

      if (!studentSubjects || studentSubjects.length === 0) {
        toast.info("You are not enrolled in any subjects yet");
        setSubjects([]);
        return;
      }

      // Get results for all subjects
      const subjectsWithResults: SubjectWithResults[] = [];

      for (const ss of studentSubjects) {
        const subjectClass = ss.subject_classes as any;
        if (!subjectClass) continue;

        // Fetch results for this subject in current term and session
        const { data: results } = await supabase
          .from("results")
          .select("*")
          .eq("student_id", studentData.id)
          .eq("subject_class_id", ss.subject_class_id)
          .eq("session_id", sessionId)
          .eq("term_id", termId)
          .eq("school_id", schoolId)
          .single();

        // Calculate percentage based on published components
        let calculatedPercentage = 0;
        let calculatedMaxScore = 0;

        if (results) {
          let score = 0;
          if (publishSettings?.welcome_test_published) {
            score += results.welcome_test || 0;
            calculatedMaxScore += 10;
          }
          if (publishSettings?.mid_term_test_published) {
            score += results.mid_term_test || 0;
            calculatedMaxScore += 20;
          }
          if (publishSettings?.vetting_published) {
            score += results.vetting || 0;
            calculatedMaxScore += 10;
          }
          if (publishSettings?.exam_published) {
            score += results.exam || 0;
            calculatedMaxScore += 60;
          }

          calculatedPercentage = calculatedMaxScore > 0
            ? (score / calculatedMaxScore) * 100
            : 0;
        }

        // Fallback to 100 if no published settings
        if (calculatedMaxScore === 0) {
          calculatedMaxScore = 100;
          calculatedPercentage = results ? (results.total || 0) : 0;
        }

        // Determine trend (compare with previous term)
        let trend: "up" | "down" | "stable" = "stable";
        if (results) {
          const { data: previousResult } = await supabase
            .from("results")
            .select("id, total")
            .eq("student_id", studentData.id)
            .eq("subject_class_id", ss.subject_class_id)
            .eq("session_id", sessionId)
            .neq("term_id", termId)
            .eq("school_id", schoolId)
            .order("term_id", { ascending: false })
            .limit(1)
            .single();

          if (previousResult) {
            const diff = (results.total || 0) - (previousResult.total || 0);
            if (diff > 5) trend = "up";
            else if (diff < -5) trend = "down";
          }
        }

        subjectsWithResults.push({
          id: subjectClass.id,
          subject_class_id: ss.subject_class_id,
          subject_name: subjectClass.subjects?.name || "Unknown",
          subject_code: subjectClass.subject_code || "",
          teacher_name: subjectClass.teachers
            ? `${subjectClass.teachers.first_name} ${subjectClass.teachers.last_name}`
            : "No teacher assigned",
          teacher_photo_url: subjectClass.teachers?.photo_url || "",
          class_name: subjectClass.classes?.name || "",
          currentTermResult: results,
          currentGrade: results?.grade,
          percentage: calculatedPercentage,
          trend,
        });
      }

      setSubjects(subjectsWithResults);

    } catch (error) {
      console.error("Error loading subjects and results:", error);
      toast.error("Failed to load subjects");
    }
  }

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your subjects...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Categorize subjects
  const wellPerformingSubjects = subjects.filter(s => s.percentage >= 70);
  const needsImprovementSubjects = subjects.filter(s => s.percentage < 70);

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            My Subjects
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
          </p>
        </div>

        {subjects.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are not enrolled in any subjects yet. Please contact your class teacher or administrator.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Performing Well Section */}
            {wellPerformingSubjects.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                  <h2 className="text-2xl font-semibold text-gray-900">Performing Well</h2>
                  <Badge className="bg-green-100 text-green-800 text-sm font-semibold">
                    {wellPerformingSubjects.length}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wellPerformingSubjects.map((subject) => (
                    <SubjectCard key={subject.id} subject={subject} gradeColors={GRADE_COLORS} maxScore={maxScore} publishSettings={publishSettings} />
                  ))}
                </div>
              </div>
            )}

            {/* Needs Improvement Section */}
            {needsImprovementSubjects.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingDown className="h-6 w-6 text-orange-600" />
                  <h2 className="text-2xl font-semibold text-gray-900">Needs Improvement</h2>
                  <Badge className="bg-orange-100 text-orange-800 text-sm font-semibold">
                    {needsImprovementSubjects.length}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {needsImprovementSubjects.map((subject) => (
                    <SubjectCard key={subject.id} subject={subject} gradeColors={GRADE_COLORS} maxScore={maxScore} publishSettings={publishSettings} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// Subject Card Component
interface SubjectCardProps {
  subject: SubjectWithResults;
  gradeColors: Record<string, string>;
  maxScore: number;
  publishSettings: any;
}

function SubjectCard({ subject, gradeColors, maxScore, publishSettings }: SubjectCardProps) {
  const performanceColor = subject.percentage >= 70 ? "text-green-600" : "text-orange-600";
  const performanceBgColor = subject.percentage >= 70 ? "bg-green-50" : "bg-orange-50";

  // Calculate score based on published components
  let publishedScore = 0;
  if (subject.currentTermResult) {
    if (publishSettings?.welcome_test_published) {
      publishedScore += subject.currentTermResult.welcome_test || 0;
    }
    if (publishSettings?.mid_term_test_published) {
      publishedScore += subject.currentTermResult.mid_term_test || 0;
    }
    if (publishSettings?.vetting_published) {
      publishedScore += subject.currentTermResult.vetting || 0;
    }
    if (publishSettings?.exam_published) {
      publishedScore += subject.currentTermResult.exam || 0;
    }
  }

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100">
      <CardContent className="p-6">
        {/* Header with trend */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-xl text-gray-900 mb-1">
              {subject.subject_name}
            </h3>
            <p className="text-sm text-gray-500">
              {subject.subject_code}
            </p>
          </div>

          {subject.trend === "up" && (
            <div className="bg-green-50 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          )}
          {subject.trend === "down" && (
            <div className="bg-red-50 p-2 rounded-lg">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
          )}
        </div>

        {/* Teacher Info */}
        <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
          <Avatar className="h-10 w-10">
            <AvatarImage src={subject.teacher_photo_url} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
              {subject.teacher_name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {subject.teacher_name}
            </p>
            <p className="text-xs text-gray-500">Teacher</p>
          </div>
        </div>

        {/* Performance Section */}
        {subject.currentTermResult ? (
          <div className="space-y-4">
            {/* Percentage Display */}
            <div className={`${performanceBgColor} p-4 rounded-lg`}>
              <p className="text-sm text-gray-600 mb-1">Current Performance</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${performanceColor}`}>
                  {subject.percentage.toFixed(0)}%
                </span>
                <span className="text-sm text-gray-500">out of {maxScore}</span>
              </div>
            </div>

            {/* Score and Grade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-600 mb-1">Score</p>
                <p className="text-2xl font-bold text-blue-600">
                  {publishedScore}
                </p>
              </div>

              <div className="p-3 rounded-lg text-center border-2" style={{ borderColor: gradeColors[subject.currentGrade || ""] || "#e5e7eb" }}>
                <p className="text-xs text-gray-600 mb-1">Grade</p>
                <Badge
                  style={{
                    backgroundColor: gradeColors[subject.currentGrade || ""] || "#gray",
                    color: "white",
                    fontSize: "16px",
                    padding: "6px 12px",
                  }}
                >
                  {subject.currentGrade}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No results available yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
