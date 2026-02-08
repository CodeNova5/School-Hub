"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  GraduationCap,
  UserCheck,
  AlertTriangle,
  Settings,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Search,
  Award,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Session } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";

interface PromotionSettings {
  minimum_pass_percentage: number;
  require_all_terms: boolean;
  auto_promote: boolean;
}

interface StudentPromotion {
  student_id: string;
  student_number: string;
  student_name: string;
  current_class_id: string;
  current_class_name: string;
  education_level: string;
  department?: string;
  terms_completed: number;
  total_terms: number;
  cumulative_average: number;
  is_eligible: boolean;
  is_graduating: boolean;
  needs_manual_review: boolean;
  term_averages: { term_id: string; average: number }[];
}

interface NextClass {
  id: string;
  name: string;
  education_level: string;
  department?: string;
}

export default function PromotionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [settings, setSettings] = useState<PromotionSettings>({
    minimum_pass_percentage: 40,
    require_all_terms: false,
    auto_promote: true,
  });
  const [students, setStudents] = useState<StudentPromotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "eligible" | "needs_review">("all");
  const [classFilter, setClassFilter] = useState<string>("all");

  // Dialogs
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // Stats
  const [stats, setStats] = useState({
    total_students: 0,
    eligible_count: 0,
    graduating_count: 0,
    needs_review_count: 0,
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchPromotionData();
    }
  }, [selectedSessionId]);

  async function fetchSessions() {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSessions(data || []);

      // Auto-select current session
      const currentSession = data?.find((s) => s.is_current);
      if (currentSession) {
        setSelectedSessionId(currentSession.id);
      }
    } catch (error: any) {
      console.error("Error fetching sessions:", error);
      toast.error("Failed to load sessions");
    }
  }

  async function fetchPromotionData() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/promotions?sessionId=${selectedSessionId}`
      );

      if (!response.ok) throw new Error("Failed to fetch promotion data");

      const data = await response.json();

      setSettings(data.settings);
      setStudents(data.students);
      setStats({
        total_students: data.total_students,
        eligible_count: data.eligible_count,
        graduating_count: data.graduating_count,
        needs_review_count: data.needs_review_count,
      });
    } catch (error: any) {
      console.error("Error fetching promotion data:", error);
      toast.error("Failed to load promotion data");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSettings() {
    try {
      const response = await fetch("/api/admin/promotions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          ...settings,
        }),
      });

      if (!response.ok) throw new Error("Failed to update settings");

      toast.success("Promotion settings updated");
      setShowSettingsDialog(false);
      fetchPromotionData();
    } catch (error: any) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    }
  }

  async function handlePromote() {
    setProcessing(true);
    try {
      // Get next class for each student
      const { data: allClasses, error: classesError } = await supabase
        .from("classes")
        .select("*");

      if (classesError) throw classesError;

      const promotions = students
        .filter((s) => selectedStudents.has(s.student_id))
        .map((student) => {
          const isGraduating = student.is_graduating;
          let nextClass: NextClass | undefined;

          if (!isGraduating) {
            // Find next class based on progression
            nextClass = getNextClass(
              student.current_class_name,
              student.education_level,
              student.department,
              allClasses || []
            );
          }

          return {
            student_id: student.student_id,
            student_name: student.student_name,
            student_number: student.student_number,
            current_class_id: student.current_class_id,
            current_class_name: student.current_class_name,
            education_level: student.education_level,
            department: student.department,
            terms_completed: student.terms_completed,
            cumulative_average: student.cumulative_average,
            cumulative_grade: calculateGrade(student.cumulative_average),
            action: isGraduating ? "graduate" : student.is_eligible ? "promote" : "repeat",
            next_class_id: nextClass?.id,
            notes: isGraduating
              ? "Graduated from SS3"
              : student.is_eligible
              ? `Promoted with ${student.cumulative_average.toFixed(1)}% average`
              : `Repeated due to ${student.cumulative_average.toFixed(1)}% average (below ${settings.minimum_pass_percentage}%)`,
          };
        });

      const response = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          promotions,
        }),
      });

      if (!response.ok) throw new Error("Failed to process promotions");

      const result = await response.json();

      toast.success(result.message);
      setShowConfirmDialog(false);
      setSelectedStudents(new Set());
      fetchPromotionData();
    } catch (error: any) {
      console.error("Error processing promotions:", error);
      toast.error("Failed to process promotions");
    } finally {
      setProcessing(false);
    }
  }

  function getNextClass(
    currentClassName: string,
    educationLevel: string,
    department: string | undefined,
    allClasses: any[]
  ): NextClass | undefined {
    const progressionMap: Record<string, string> = {
      "Creche": "Nursery 1",
      "Nursery 1": "Nursery 2",
      "Nursery 2": "KG 1",
      "KG 1": "KG 2",
      "KG 2": "Primary 1",
      "Primary 1": "Primary 2",
      "Primary 2": "Primary 3",
      "Primary 3": "Primary 4",
      "Primary 4": "Primary 5",
      "Primary 5": "Primary 6",
      "Primary 6": "JSS 1",
      "JSS 1": "JSS 2",
      "JSS 2": "JSS 3",
      "JSS 3": "SS 1",
      "SS 1": "SS 2",
      "SS 2": "SS 3",
    };

    const nextClassName = progressionMap[currentClassName];
    if (!nextClassName) return undefined;

    return allClasses.find(
      (c) =>
        c.name === nextClassName &&
        (nextClassName.startsWith("SS") ? c.department === department : true)
    );
  }

  function calculateGrade(average: number): string {
    if (average >= 75) return "A1";
    if (average >= 70) return "B2";
    if (average >= 65) return "B3";
    if (average >= 60) return "C4";
    if (average >= 55) return "C5";
    if (average >= 50) return "C6";
    if (average >= 45) return "D7";
    if (average >= 40) return "E8";
    return "F9";
  }

  const filteredStudents = students.filter((student) => {
    if (
      search &&
      !student.student_name.toLowerCase().includes(search.toLowerCase()) &&
      !student.student_number.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }

    if (statusFilter === "eligible" && !student.is_eligible) return false;
    if (statusFilter === "needs_review" && !student.needs_manual_review) return false;
    if (classFilter !== "all" && student.current_class_name !== classFilter) return false;

    return true;
  });

  const uniqueClasses = Array.from(new Set(students.map((s) => s.current_class_name))).sort();

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Student Promotions</h1>
            <p className="text-muted-foreground mt-1">
              Manage student promotions at the end of the session
            </p>
          </div>
          <Button onClick={() => setShowSettingsDialog(true)} variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Session Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Session</CardTitle>
            <CardDescription>
              Choose the session for which you want to process promotions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-full md:w-[300px]">
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
          </CardContent>
        </Card>

        {selectedSessionId && (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_students}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Eligible for Promotion</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {stats.eligible_count}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≥{settings.minimum_pass_percentage}% average
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Graduating (SS3)</CardTitle>
                  <GraduationCap className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.graduating_count}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.needs_review_count}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Below pass mark
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filters and Actions */}
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Students</CardTitle>
                    <CardDescription>
                      Select students to promote or graduate
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => fetchPromotionData()}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={selectedStudents.size === 0 || processing}
                      size="sm"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Promote {selectedStudents.size} Student{selectedStudents.size !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or student ID..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="eligible">Eligible</SelectItem>
                      <SelectItem value="needs_review">Needs Review</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {uniqueClasses.map((className) => (
                        <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk Select */}
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    checked={
                      filteredStudents.length > 0 &&
                      filteredStudents.every((s) => selectedStudents.has(s.student_id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedStudents(
                          new Set(filteredStudents.map((s) => s.student_id))
                        );
                      } else {
                        setSelectedStudents(new Set());
                      }
                    }}
                  />
                  <Label className="text-sm font-medium">
                    Select All ({filteredStudents.length} students)
                  </Label>
                </div>

                {/* Students Table */}
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Loading students...
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No students found
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left w-12"></th>
                          <th className="p-3 text-left">Student</th>
                          <th className="p-3 text-left">Current Class</th>
                          <th className="p-3 text-center">Terms</th>
                          <th className="p-3 text-center">Average</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => {
                          const isSelected = selectedStudents.has(student.student_id);
                          const StatusIcon = student.is_eligible
                            ? TrendingUp
                            : TrendingDown;

                          return (
                            <tr
                              key={student.student_id}
                              className={`border-t transition-colors ${
                                isSelected ? "bg-blue-50" : "hover:bg-muted/50"
                              }`}
                            >
                              <td className="p-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedStudents);
                                    if (checked) {
                                      newSelected.add(student.student_id);
                                    } else {
                                      newSelected.delete(student.student_id);
                                    }
                                    setSelectedStudents(newSelected);
                                  }}
                                />
                              </td>
                              <td className="p-3">
                                <div>
                                  <p className="font-medium">{student.student_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {student.student_number}
                                  </p>
                                </div>
                              </td>
                              <td className="p-3">
                                <div>
                                  <p className="font-medium">{student.current_class_name}</p>
                                  {student.department && (
                                    <p className="text-xs text-muted-foreground">
                                      {student.department}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="outline">
                                  {student.terms_completed}/{student.total_terms}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className={`font-bold text-lg ${
                                      student.is_eligible
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {student.cumulative_average.toFixed(1)}%
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      student.is_eligible
                                        ? "bg-green-100 text-green-700 border-green-300"
                                        : "bg-red-100 text-red-700 border-red-300"
                                    }
                                  >
                                    {calculateGrade(student.cumulative_average)}
                                  </Badge>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                {student.is_graduating ? (
                                  <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                                    <GraduationCap className="h-3 w-3 mr-1" />
                                    Graduating
                                  </Badge>
                                ) : student.is_eligible ? (
                                  <Badge className="bg-green-100 text-green-700 border-green-300">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Eligible
                                  </Badge>
                                ) : (
                                  <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Review
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {student.is_graduating ? (
                                  <Badge variant="outline" className="bg-purple-50">
                                    <Award className="h-3 w-3 mr-1" />
                                    Graduate
                                  </Badge>
                                ) : student.is_eligible ? (
                                  <Badge variant="outline" className="bg-green-50">
                                    <ArrowRight className="h-3 w-3 mr-1" />
                                    Promote
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-orange-50">
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Repeat
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Settings Dialog */}
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promotion Settings</DialogTitle>
              <DialogDescription>
                Configure promotion rules and thresholds
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Minimum Pass Percentage</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.minimum_pass_percentage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minimum_pass_percentage: parseFloat(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Students must achieve at least this average to be promoted
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="require_all_terms"
                  checked={settings.require_all_terms}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, require_all_terms: !!checked })
                  }
                />
                <Label htmlFor="require_all_terms">
                  Require all terms to have results
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto_promote"
                  checked={settings.auto_promote}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, auto_promote: !!checked })
                  }
                />
                <Label htmlFor="auto_promote">
                  Enable auto-promotion for eligible students
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSettings}>Save Settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Promotions</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to process promotions for {selectedStudents.size} student
                {selectedStudents.size !== 1 ? "s" : ""}. This action will:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Record class history for the selected students</li>
                  <li>Promote eligible students to the next class</li>
                  <li>Mark SS3 students as graduated</li>
                  <li>Keep failed students in their current class</li>
                </ul>
                <p className="mt-3 font-semibold text-foreground">
                  This action is permanent. Continue?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handlePromote} disabled={processing}>
                {processing ? "Processing..." : "Yes, Promote Students"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
