"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowUp, 
  Users, 
  GraduationCap, 
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Class {
  id: string;
  name: string;
  level: string;
  education_level: string;
  department?: string;
  stream?: string;
}

interface Session {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface Term {
  id: string;
  name: string;
  session_id: string;
  start_date: string;
  is_current: boolean;
}

interface PromotionMapping {
  sourceClassId: string;
  targetClassId: string;
  studentCount: number;
  isGraduation?: boolean;
}

interface StudentPerformance {
  student_id: string;
  student_name: string;
  class_name: string;
  average_score: number;
  terms_with_results: number;
  status: 'promote' | 'review' | 'retain';
}

interface PerformanceReview {
  classId: string;
  className: string;
  students: StudentPerformance[];
  atRiskCount: number;
}

export default function PromotionsPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [nextSession, setNextSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  
  const [promotionMappings, setPromotionMappings] = useState<PromotionMapping[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [promotionResults, setPromotionResults] = useState<any>(null);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);
  const [isPerformanceReviewOpen, setIsPerformanceReviewOpen] = useState(false);
  const [studentsToRetain, setStudentsToRetain] = useState<Set<string>>(new Set());
  const [passingThreshold, setPassingThreshold] = useState(50);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchClasses(),
        fetchSessions(),
        fetchTerms()
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClasses() {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("education_level", { ascending: true })
      .order("level", { ascending: true});

    if (!error && data) {
      setClasses(data);
    }
  }

  async function fetchSessions() {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("start_date", { ascending: false });
    
    if (!error && data) {
      setSessions(data);
      const current = data.find((s: Session) => s.is_current);
      setCurrentSession(current || null);
      
      if (current) {
        const next = data.find((s: Session) => 
          new Date(s.start_date) > new Date(current.end_date)
        );
        setNextSession(next || null);
      }
    }
  }

  async function fetchTerms() {
    const { data, error } = await supabase
      .from("terms")
      .select("*")
      .order("start_date", { ascending: true });
    
    if (!error && data) {
      setTerms(data);
    }
  }

  async function fetchClassStudentCount(classId: string): Promise<number> {
    if (!currentSession) return 0;
    
    const currentTerm = terms.find(t => t.is_current);
    if (!currentTerm) return 0;

    const { count } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("session_id", currentSession.id)
      .eq("term_id", currentTerm.id)
      .eq("status", "active");
    
    return count || 0;
  }

  function addPromotionMapping(sourceClassId: string, targetClassId: string) {
    if (promotionMappings.find(m => m.sourceClassId === sourceClassId)) {
      toast.error("Source class already mapped");
      return;
    }

    fetchClassStudentCount(sourceClassId).then(count => {
      setPromotionMappings([...promotionMappings, {
        sourceClassId,
        targetClassId,
        studentCount: count
      }]);
    });
  }

  function removePromotionMapping(sourceClassId: string) {
    setPromotionMappings(promotionMappings.filter(m => m.sourceClassId !== sourceClassId));
  }

  async function handleAutoMapClasses() {
    if (!currentSession) {
      toast.error("No current session found");
      return;
    }

    const mappings: PromotionMapping[] = [];
    const classHierarchy: Record<string, string[]> = {
      "Pre-Primary": ["Nursery 1", "Nursery 2", "KG 1", "KG 2"],
      "Primary": ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
      "JSS": ["JSS 1", "JSS 2", "JSS 3"],
      "SSS": ["SSS 1", "SSS 2", "SSS 3"]
    };

    for (const [educationLevel, levels] of Object.entries(classHierarchy)) {
      for (let i = 0; i < levels.length; i++) {
        const currentLevel = levels[i];
        const classesForLevel = classes.filter(c => c.level === currentLevel);

        for (const sourceClass of classesForLevel) {
          if (mappings.find(m => m.sourceClassId === sourceClass.id)) continue;

          let targetClass: Class | undefined;
          let isGraduation = false;

          if (i < levels.length - 1) {
            const nextLevel = levels[i + 1];
            targetClass = classes.find(c => 
              c.level === nextLevel && 
              c.education_level === educationLevel &&
              (!sourceClass.stream || c.stream === sourceClass.stream)
            );
          } else {
            if (educationLevel === "Pre-Primary") {
              targetClass = classes.find(c => c.level === "Primary 1");
            } else if (educationLevel === "Primary") {
              targetClass = classes.find(c => c.level === "JSS 1");
            } else if (educationLevel === "JSS") {
              targetClass = classes.find(c => c.level === "SSS 1");
            } else if (educationLevel === "SSS") {
              isGraduation = true;
            }
          }

          if (targetClass || isGraduation) {
            const count = await fetchClassStudentCount(sourceClass.id);
            if (count > 0) {
              mappings.push({
                sourceClassId: sourceClass.id,
                targetClassId: targetClass?.id || "",
                studentCount: count,
                isGraduation
              });
            }
          }
        }
      }
    }

    if (mappings.length === 0) {
      toast.info("No classes with students found to map");
      return;
    }

    setPromotionMappings(mappings);
    toast.success(`Auto-mapped ${mappings.length} classes`);
  }

  async function handleCheckPerformance() {
    if (promotionMappings.length === 0) {
      toast.error("Add promotion mappings first");
      return;
    }

    if (!currentSession) return;

    const currentTerm = terms.find(t => t.is_current);
    if (!currentTerm) return;

    toast.loading("Analyzing student performance...", { id: "performance" });

    const reviews: PerformanceReview[] = [];

    for (const mapping of promotionMappings) {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, students(id, first_name, last_name)")
        .eq("class_id", mapping.sourceClassId)
        .eq("session_id", currentSession.id)
        .eq("term_id", currentTerm.id)
        .eq("status", "active");

      if (!enrollments || enrollments.length === 0) continue;

      const studentPerformances: StudentPerformance[] = [];

      for (const enrollment of enrollments) {
        const student = enrollment.students as any;
        if (!student) continue;

        const { data: results } = await supabase
          .from("results")
          .select("total_score, session_id, term_id")
          .eq("student_id", student.id)
          .eq("session_id", currentSession.id);

        if (!results || results.length === 0) {
          studentPerformances.push({
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            class_name: getClassName(mapping.sourceClassId),
            average_score: 0,
            terms_with_results: 0,
            status: 'review'
          });
          continue;
        }

        const totalScore = results.reduce((sum, r) => sum + (r.total_score || 0), 0);
        const averageScore = totalScore / results.length;

        studentPerformances.push({
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          class_name: getClassName(mapping.sourceClassId),
          average_score: Math.round(averageScore * 10) / 10,
          terms_with_results: results.length,
          status: averageScore < passingThreshold ? 'review' : 'promote'
        });
      }

      const atRiskCount = studentPerformances.filter(s => s.status === 'review').length;

      reviews.push({
        classId: mapping.sourceClassId,
        className: getClassName(mapping.sourceClassId),
        students: studentPerformances,
        atRiskCount
      });
    }

    setPerformanceReviews(reviews);
    
    const totalAtRisk = reviews.reduce((sum, r) => sum + r.atRiskCount, 0);
    
    toast.success(`Performance check complete. ${totalAtRisk} students need review.`, { id: "performance" });

    if (totalAtRisk > 0) {
      setIsPerformanceReviewOpen(true);
    } else {
      handlePreviewPromotion();
    }
  }

  function toggleStudentRetention(studentId: string) {
    const newSet = new Set(studentsToRetain);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setStudentsToRetain(newSet);
  }

  async function handlePreviewPromotion() {
    if (promotionMappings.length === 0) {
      toast.error("Add at least one promotion mapping");
      return;
    }

    if (!nextSession && !promotionMappings.some(m => m.isGraduation)) {
      toast.error("No next session found. Please create next academic session first.");
      return;
    }

    setIsPreviewOpen(true);
  }

  async function handleExecutePromotion() {
    if (!nextSession && !promotionMappings.every(m => m.isGraduation)) {
      toast.error("No next session available");
      return;
    }

    setPromoting(true);
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      graduated: 0,
      retained: studentsToRetain.size,
      errors: [] as string[]
    };

    try {
      for (const mapping of promotionMappings) {
        results.total += mapping.studentCount;

        if (mapping.isGraduation) {
          const response = await fetch("/api/admin/promote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "graduate-class",
              sourceClassId: mapping.sourceClassId,
              excludeStudentIds: Array.from(studentsToRetain)
            })
          });

          const result = await response.json();

          if (response.ok) {
            results.graduated += result.graduated || 0;
            results.successful += result.graduated || 0;
          } else {
            results.errors.push(`Graduation failed: ${result.error}`);
          }
        } else {
          const response = await fetch("/api/admin/promote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "promote-class",
              sourceClassId: mapping.sourceClassId,
              targetClassId: mapping.targetClassId,
              targetSessionId: nextSession?.id,
              excludeStudentIds: Array.from(studentsToRetain)
            })
          });

          const result = await response.json();

          if (response.ok) {
            results.successful += result.promoted || 0;
            results.failed += result.failed || 0;
            if (result.errors) {
              results.errors.push(...result.errors);
            }
          } else {
            results.failed += mapping.studentCount;
            results.errors.push(`Class promotion failed: ${result.error}`);
          }
        }
      }

      setPromotionResults(results);
      
      if (results.failed === 0) {
        const message = results.graduated > 0 
          ? `Successfully promoted ${results.successful - results.graduated} students and graduated ${results.graduated} students!`
          : `Successfully promoted ${results.successful} students!`;
        toast.success(message);
        setPromotionMappings([]);
        setPerformanceReviews([]);
        setStudentsToRetain(new Set());
        setIsPreviewOpen(false);
      } else {
        toast.warning(`Promoted ${results.successful} students, ${results.failed} failed${results.retained > 0 ? `, ${results.retained} retained` : ''}`);
      }

    } catch (error: any) {
      toast.error("Promotion failed: " + error.message);
    } finally {
      setPromoting(false);
    }
  }

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || "Unknown";
  };

  const totalStudentsToPromote = promotionMappings.reduce((sum, m) => sum + m.studentCount, 0);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Student Promotions
          </h1>
          <p className="text-muted-foreground mt-2">
            Promote students to the next class for the upcoming academic session
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentSession ? (
                <div>
                  <p className="text-2xl font-bold">{currentSession.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(currentSession.start_date).toLocaleDateString()} - {new Date(currentSession.end_date).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-600">No current session found</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Target Session (Next)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextSession ? (
                <div>
                  <p className="text-2xl font-bold">{nextSession.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(nextSession.start_date).toLocaleDateString()} - {new Date(nextSession.end_date).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-red-600 font-medium">No next session found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create the next academic session before promoting students
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowUp className="h-5 w-5" />
                Promotion Mappings
              </span>
              <Badge variant="outline">
                {totalStudentsToPromote} students to promote
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">Add Promotion Mapping</p>
              <PromotionMappingForm 
                classes={classes}
                onAdd={addPromotionMapping}
              />
            </div>

            {promotionMappings.length > 0 ? (
              <div className="space-y-2">
                {promotionMappings.map((mapping) => (
                  <div 
                    key={mapping.sourceClassId}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{getClassName(mapping.sourceClassId)}</span>
                      </div>
                      <ArrowUp className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        {mapping.isGraduation ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                            <span className="font-medium text-purple-600">Graduation</span>
                          </>
                        ) : (
                          <>
                            <GraduationCap className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{getClassName(mapping.targetClassId)}</span>
                          </>
                        )}
                      </div>
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {mapping.studentCount} students
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removePromotionMapping(mapping.sourceClassId)}
                    >
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No promotion mappings added yet</p>
                <p className="text-sm">Add source and target class mappings above</p>
              </div>
            )}

            {promotionMappings.length > 0 && (
              <div className="flex justify-between items-center gap-2 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Passing Score:</label>
                  <input
                    type="number"
                    value={passingThreshold}
                    onChange={(e) => setPassingThreshold(Number(e.target.value))}
                    className="w-20 border rounded px-2 py-1 text-sm"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPromotionMappings([]);
                      setPerformanceReviews([]);
                      setStudentsToRetain(new Set());
                    }}
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={handleCheckPerformance}
                    variant="secondary"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Check Performance & Promote
                  </Button>
                </div>
              </div>
            )}

            {promotionMappings.length === 0 && (
              <div className="text-center py-4">
                <Button
                  onClick={handleAutoMapClasses}
                  variant="outline"
                  size="lg"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Auto-Map All Classes
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Automatically map all classes to next level (SSS 3 → Graduation)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {promotionResults && (
          <Card>
            <CardHeader>
              <CardTitle>Promotion Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{promotionResults.total}</p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{promotionResults.successful}</p>
                  <p className="text-sm text-muted-foreground">Promoted/Graduated</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{promotionResults.retained}</p>
                  <p className="text-sm text-muted-foreground">Retained</p>
                </div>
              </div>
              
              {promotionResults.graduated > 0 && (
                <div className="text-center p-4 border rounded-lg bg-purple-50">
                  <p className="text-2xl font-bold text-purple-600">{promotionResults.graduated}</p>
                  <p className="text-sm text-purple-900">Students Graduated 🎓</p>
                </div>
              )}

              {promotionResults.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Errors:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {promotionResults.errors.map((error: string, i: number) => (
                      <p key={i} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Confirm Student Promotion</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Important</p>
                    <p className="text-sm text-yellow-800 mt-1">
                      This will create new enrollments for {totalStudentsToPromote - studentsToRetain.size} students in the {nextSession?.name} session.
                      {studentsToRetain.size > 0 && ` ${studentsToRetain.size} students will be retained in their current class.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg">
                <div className="bg-muted px-4 py-2 font-medium text-sm">
                  Promotion Summary
                </div>
                <div className="divide-y">
                  {promotionMappings.map((mapping) => (
                    <div key={mapping.sourceClassId} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getClassName(mapping.sourceClassId)}</span>
                        <ArrowUp className="h-4 w-4" />
                        {mapping.isGraduation ? (
                          <span className="font-medium text-purple-600">🎓 Graduation</span>
                        ) : (
                          <span className="font-medium text-green-600">{getClassName(mapping.targetClassId)}</span>
                        )}
                      </div>
                      <Badge>{mapping.studentCount} students</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium">What happens:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Current enrollments marked as 'completed'</li>
                    <li>New enrollments created for next session (or graduated)</li>
                    <li>Compulsory subjects auto-assigned</li>
                    <li>All historical results preserved</li>
                    {studentsToRetain.size > 0 && (
                      <li className="text-orange-700 font-medium">
                        {studentsToRetain.size} low-performing students retained
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsPreviewOpen(false)}
                disabled={promoting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecutePromotion}
                disabled={promoting}
              >
                {promoting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Promoting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Execute Promotion
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPerformanceReviewOpen} onOpenChange={setIsPerformanceReviewOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Student Performance Review</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Review students with low performance (below {passingThreshold}%) before promotion
              </p>
            </DialogHeader>

            <div className="space-y-4">
              {performanceReviews.map((review) => (
                <Card key={review.classId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{review.className}</CardTitle>
                      <Badge variant={review.atRiskCount > 0 ? "destructive" : "default"}>
                        {review.atRiskCount} need review
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {review.students
                        .filter(s => s.status === 'review')
                        .map((student) => (
                          <div
                            key={student.student_id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                          >
                            <div className="flex-1">
                              <p className="font-medium">{student.student_name}</p>
                              <div className="flex gap-4 mt-1">
                                <span className="text-sm text-muted-foreground">
                                  Avg: <span className={student.average_score < passingThreshold ? "text-red-600 font-medium" : ""}>
                                    {student.average_score}%
                                  </span>
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  Terms: {student.terms_with_results}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={studentsToRetain.has(student.student_id) ? "default" : "outline"}
                                onClick={() => toggleStudentRetention(student.student_id)}
                              >
                                {studentsToRetain.has(student.student_id) ? (
                                  <>
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Retain
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Promote
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Decision Summary:</strong> {studentsToRetain.size} students will be retained to repeat current class. 
                  The remaining students will be promoted.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsPerformanceReviewOpen(false);
                  setStudentsToRetain(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setIsPerformanceReviewOpen(false);
                  handlePreviewPromotion();
                }}
              >
                Continue to Promotion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function PromotionMappingForm({ 
  classes, 
  onAdd 
}: { 
  classes: Class[]; 
  onAdd: (sourceId: string, targetId: string) => void;
}) {
  const [sourceClassId, setSourceClassId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");

  function handleAdd() {
    if (!sourceClassId || !targetClassId) {
      toast.error("Select both source and target class");
      return;
    }

    if (sourceClassId === targetClassId) {
      toast.error("Source and target must be different");
      return;
    }

    onAdd(sourceClassId, targetClassId);
    setSourceClassId("");
    setTargetClassId("");
  }

  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <label className="text-xs text-muted-foreground">From Class</label>
        <select
          value={sourceClassId}
          onChange={(e) => setSourceClassId(e.target.value)}
          className="w-full mt-1 border rounded-md p-2 text-sm"
        >
          <option value="">Select source class</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name} - {cls.level}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end">
        <ArrowUp className="h-8 w-8 text-muted-foreground mb-2" />
      </div>

      <div className="flex-1">
        <label className="text-xs text-muted-foreground">To Class</label>
        <select
          value={targetClassId}
          onChange={(e) => setTargetClassId(e.target.value)}
          className="w-full mt-1 border rounded-md p-2 text-sm"
        >
          <option value="">Select target class</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name} - {cls.level}
            </option>
          ))}
        </select>
      </div>

      <Button onClick={handleAdd} className="self-end">
        Add Mapping
      </Button>
    </div>
  );
}
