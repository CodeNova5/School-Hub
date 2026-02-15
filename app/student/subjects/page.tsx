"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Line, LineChart, Legend, Pie, PieChart } from "recharts";
import { BookOpen, TrendingUp, TrendingDown, Award, Target, Calendar, AlertCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth";

interface SubjectWithResults {
  id: string;
  subject_class_id: string;
  subject_name: string;
  subject_code: string;
  teacher_name: string;
  teacher_photo_url: string;
  class_name: string;
  results: any[];
  currentTermResult?: any;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  currentGrade?: string;
  trend: "up" | "down" | "stable";
}
interface SubjectClass {
  id: string;
  subject_code: string;
  subjects: {
    id: string;
    name: string;
  }[]; // array
  classes: {
    id: string;
    name: string;
    level: string;
    education_level?: string;
  }[]; // array
  teachers?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string;
  }[]; // array
}

export default function StudentSubjectsPage() {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [subjects, setSubjects] = useState<SubjectWithResults[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [currentTerm, setCurrentTerm] = useState<string>("");
  const [publishSettings, setPublishSettings] = useState<any>(null);

  // Analytics state
  const [overallAverage, setOverallAverage] = useState<number>(0);
  const [strongestSubject, setStrongestSubject] = useState<string>("");
  const [weakestSubject, setWeakestSubject] = useState<string>("");
  const [gradeDistribution, setGradeDistribution] = useState<any[]>([]);
  const [performanceTrend, setPerformanceTrend] = useState<any[]>([]);

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
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSession && currentTerm) {
      loadSubjectsAndResults();
    }
  }, [selectedSession, currentTerm]);

  async function loadData() {
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
        .single();

      if (studentError || !studentData) {
        toast.error("Student profile not found");
        return;
      }

      setStudent(studentData);

      // Load sessions and terms
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*")
        .order("name", { ascending: false });

      const { data: termData } = await supabase
        .from("terms")
        .select("*")
        .order("name");

      setSessions(sessionData || []);

      // Set current session and term (locked to current)
      const currentSession = sessionData?.find((s) => s.is_current);
      const currentTermData = termData?.find((t) => t.is_current);

      if (currentSession) setSelectedSession(currentSession.id);
      if (currentTermData) setCurrentTerm(currentTermData.id);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubjectsAndResults() {
    if (!student || !selectedSession || !currentTerm) return;

    try {
      // Get publication settings for this class and term
      const classData = student.classes as any;
      const { data: pubSettings } = await supabase
        .from("results_publication")
        .select("*")
        .eq("class_id", classData.id)
        .eq("term_id", currentTerm)
        .single();

      setPublishSettings(pubSettings);
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
        .eq("student_id", student.id);

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

        // Fetch all results for this subject across all terms in selected session
        const { data: results } = await supabase
          .from("results")
          .select(`
            *,
            terms (id, name)
          `)
          .eq("student_id", student.id)
          .eq("subject_class_id", ss.subject_class_id)
          .eq("session_id", selectedSession)
          .order("term_id");

        // Get current term result
        const currentTermResult = results?.find(r => r.term_id === currentTerm);

        // Calculate analytics
        const scores = results?.map(r => r.total || 0) || [];
        const avgScore = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;

        const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
        const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

        // Determine trend
        let trend: "up" | "down" | "stable" = "stable";
        if (scores.length >= 2) {
          const recent = scores[scores.length - 1];
          const previous = scores[scores.length - 2];
          if (recent > previous + 5) trend = "up";
          else if (recent < previous - 5) trend = "down";
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
          results: results || [],
          currentTermResult,
          averageScore: avgScore,
          highestScore,
          lowestScore,
          currentGrade: currentTermResult?.grade,
          trend,
        });
      }

      setSubjects(subjectsWithResults);

      // Calculate overall analytics
      calculateOverallAnalytics(subjectsWithResults);

    } catch (error) {
      console.error("Error loading subjects and results:", error);
      toast.error("Failed to load subjects");
    }
  }

  function calculateOverallAnalytics(subjectsData: SubjectWithResults[]) {
    if (subjectsData.length === 0 || !publishSettings) return;

    // Overall average - only count published components
    const currentTermScores = subjectsData
      .map(s => {
        if (!s.currentTermResult) return 0;
        let total = 0;
        let maxScore = 0;

        if (publishSettings?.welcome_test_published) {
          total += s.currentTermResult.welcome_test || 0;
          maxScore += 10;
        }
        if (publishSettings?.mid_term_test_published) {
          total += s.currentTermResult.mid_term_test || 0;
          maxScore += 20;
        }
        if (publishSettings?.vetting_published) {
          total += s.currentTermResult.vetting || 0;
          maxScore += 10;
        }
        if (publishSettings?.exam_published) {
          total += s.currentTermResult.exam || 0;
          maxScore += 60;
        }

        return maxScore > 0 ? (total / maxScore) * 100 : 0;
      })
      .filter(score => score > 0);

    const avg = currentTermScores.length > 0
      ? currentTermScores.reduce((a, b) => a + b, 0) / currentTermScores.length
      : 0;

    setOverallAverage(avg);

    // Strongest and weakest subjects
    const withCurrentScores = subjectsData.filter(s => s.currentTermResult);
    if (withCurrentScores.length > 0) {
      const strongest = withCurrentScores.reduce((max, s) =>
        (s.currentTermResult?.total || 0) > (max.currentTermResult?.total || 0) ? s : max
      );
      const weakest = withCurrentScores.reduce((min, s) =>
        (s.currentTermResult?.total || 0) < (min.currentTermResult?.total || 0) ? s : min
      );

      setStrongestSubject(strongest.subject_name);
      setWeakestSubject(weakest.subject_name);
    }

    // Grade distribution
    const grades = subjectsData
      .map(s => s.currentTermResult?.grade)
      .filter(Boolean);

    const distribution = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"].map(grade => ({
      grade,
      count: grades.filter(g => g === grade).length,
    }));

    setGradeDistribution(distribution);

    // Performance trend across terms - only include data if published
    let termsInSession = Array.from(new Set(
      subjectsData.flatMap(s => s.results.map(r => r.terms?.name))
    )).filter(Boolean) as string[];

    // Filter out future terms that aren't published yet
    termsInSession = termsInSession.filter(term => {
      if (term === "Current") return publishSettings;
      return true;
    });

    const trend = termsInSession.map(termName => {
      const termResults = subjectsData.flatMap(s =>
        s.results.filter(r => r.terms?.name === termName)
      );

      const avgForTerm = termResults.length > 0
        ? termResults.reduce((a, b) => a + (b.total || 0), 0) / termResults.length
        : 0;

      return {
        term: termName,
        average: parseFloat(avgForTerm.toFixed(1)),
      };
    });

    setPerformanceTrend(trend);
  }

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your subjects...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Subjects</h1>
          <p className="text-gray-600 mt-1">
            View all your subjects and academic performance
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Select Session</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Select
              value={selectedSession}
              onValueChange={setSelectedSession}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem value={s.id} key={s.id}>
                    {s.name} {s.is_current && "(Current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center">
              <div className="text-sm">
                <p className="text-gray-600 font-medium">Current Term</p>
                <p className="text-lg font-semibold text-blue-600 mt-1">
                  {currentTerm ? "Active" : "Loading..."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {subjects.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are not enrolled in any subjects yet. Please contact your class teacher or administrator.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Analytics Section */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">

                {/* Summary Cards */}
                <div className="grid md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 flex flex-col items-center">
                      <BookOpen className="h-6 w-6 mb-2 text-blue-600" />
                      <p className="text-3xl font-bold">{subjects.length}</p>
                      <p className="text-gray-500 text-sm text-center">Total Subjects</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 flex flex-col items-center">
                      <Target className="h-6 w-6 mb-2 text-green-600" />
                      <p className="text-3xl font-bold">{overallAverage.toFixed(1)}</p>
                      <p className="text-gray-500 text-sm text-center">Overall Average</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 flex flex-col items-center">
                      <TrendingUp className="h-6 w-6 mb-2 text-purple-600" />
                      <p className="text-lg font-bold truncate w-full text-center" title={strongestSubject}>
                        {strongestSubject || "N/A"}
                      </p>
                      <p className="text-gray-500 text-sm text-center">Strongest Subject</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 flex flex-col items-center">
                      <TrendingDown className="h-6 w-6 mb-2 text-orange-600" />
                      <p className="text-lg font-bold truncate w-full text-center" title={weakestSubject}>
                        {weakestSubject || "N/A"}
                      </p>
                      <p className="text-gray-500 text-sm text-center">Needs Attention</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Subjects List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Your Subjects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subjects.map((subject) => (
                        <Card key={subject.id} className="hover:shadow-lg transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg mb-1">
                                  {subject.subject_name}
                                </h3>
                                <p className="text-xs text-gray-500 mb-2">
                                  {subject.subject_code}
                                </p>
                              </div>

                              {subject.trend === "up" && (
                                <TrendingUp className="h-5 w-5 text-green-600" />
                              )}
                              {subject.trend === "down" && (
                                <TrendingDown className="h-5 w-5 text-red-600" />
                              )}
                            </div>

                            {/* Teacher */}
                            <div className="flex items-center gap-2 mb-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={subject.teacher_photo_url} />
                                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                  {subject.teacher_name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {subject.teacher_name}
                                </p>
                                <p className="text-xs text-gray-500">Teacher</p>
                              </div>
                            </div>

                            {/* Current Performance */}
                            {subject.currentTermResult ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">Current Score:</span>
                                  <span className="text-lg font-bold">
                                    {subject.currentTermResult.total}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">Grade:</span>
                                  <Badge
                                    style={{
                                      backgroundColor: GRADE_COLORS[subject.currentGrade || ""] || "#gray",
                                      color: "white",
                                    }}
                                  >
                                    {subject.currentGrade}
                                  </Badge>
                                </div>

                                {/* Score Breakdown - Only Published Components */}
                                <div className="pt-2 border-t space-y-1">
                                  {publishSettings?.welcome_test_published && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">Welcome Test:</span>
                                      <span>{subject.currentTermResult.welcome_test || 0}/10</span>
                                    </div>
                                  )}
                                  {publishSettings?.mid_term_test_published && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">Mid-Term:</span>
                                      <span>{subject.currentTermResult.mid_term_test || 0}/20</span>
                                    </div>
                                  )}
                                  {publishSettings?.vetting_published && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">Vetting:</span>
                                      <span>{subject.currentTermResult.vetting || 0}/10</span>
                                    </div>
                                  )}
                                  {publishSettings?.exam_published && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-gray-500">Exam:</span>
                                      <span>{subject.currentTermResult.exam || 0}/60</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-sm text-gray-500">No results available</p>
                              </div>
                            )}

                            {/* Subject Stats */}
                            <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <p className="text-gray-500">Average</p>
                                <p className="font-semibold">{subject.averageScore.toFixed(1)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-500">Highest</p>
                                <p className="font-semibold text-green-600">{subject.highestScore}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-500">Lowest</p>
                                <p className="font-semibold text-red-600">{subject.lowestScore}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-6">

                {/* Performance Trend */}
                {performanceTrend.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Trend</CardTitle>
                      <p className="text-sm text-gray-500">
                        Your average score across terms in this session
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={performanceTrend}>
                          <XAxis dataKey="term" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="average"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            name="Average Score"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Grade Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Grade Distribution</CardTitle>
                    <p className="text-sm text-gray-500">
                      Current term grades across all subjects
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={gradeDistribution.filter(g => g.count > 0)}>
                        <XAxis dataKey="grade" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" name="Number of Subjects">
                          {gradeDistribution.map((entry, index) => (
                            <Cell key={index} fill={GRADE_COLORS[entry.grade]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Subject Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>Subject Comparison</CardTitle>
                    <p className="text-sm text-gray-500">
                      Compare your performance across all subjects
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={subjects
                          .filter(s => s.currentTermResult)
                          .map(s => ({
                            subject: s.subject_name.length > 15
                              ? s.subject_name.substring(0, 12) + "..."
                              : s.subject_name,
                            score: s.currentTermResult?.total || 0,
                          }))}
                        layout="horizontal"
                      >
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis dataKey="subject" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="score" fill="#3b82f6" name="Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Assessment Breakdown - Only Published Components */}
                <Card>
                  <CardHeader>
                    <CardTitle>Assessment Component Average</CardTitle>
                    <p className="text-sm text-gray-500">
                      Your average scores across different assessment types
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          ...(publishSettings?.welcome_test_published ? [{
                            name: "Welcome Test",
                            avg: subjects
                              .filter(s => s.currentTermResult)
                              .reduce((sum, s) => sum + (s.currentTermResult?.welcome_test || 0), 0) /
                              subjects.filter(s => s.currentTermResult).length || 0,
                            max: 10,
                          }] : []),
                          ...(publishSettings?.mid_term_test_published ? [{
                            name: "Mid-Term",
                            avg: subjects
                              .filter(s => s.currentTermResult)
                              .reduce((sum, s) => sum + (s.currentTermResult?.mid_term_test || 0), 0) /
                              subjects.filter(s => s.currentTermResult).length || 0,
                            max: 20,
                          }] : []),
                          ...(publishSettings?.vetting_published ? [{
                            name: "Vetting",
                            avg: subjects
                              .filter(s => s.currentTermResult)
                              .reduce((sum, s) => sum + (s.currentTermResult?.vetting || 0), 0) /
                              subjects.filter(s => s.currentTermResult).length || 0,
                            max: 10,
                          }] : []),
                          ...(publishSettings?.exam_published ? [{
                            name: "Exam",
                            avg: subjects
                              .filter(s => s.currentTermResult)
                              .reduce((sum, s) => sum + (s.currentTermResult?.exam || 0), 0) /
                              subjects.filter(s => s.currentTermResult).length || 0,
                            max: 60,
                          }] : []),
                        ]}
                      >
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="avg" fill="#10b981" name="Your Average" />
                        <Bar dataKey="max" fill="#e5e7eb" name="Maximum Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
