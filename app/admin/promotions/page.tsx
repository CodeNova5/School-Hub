"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  memo,
  useReducer,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  RowSelectionState,
  PaginationState,
} from "@tanstack/react-table";
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
  Search,
  Award,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Zap,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Session } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DashboardLayout } from "@/components/dashboard-layout";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PromotionSettings {
  minimum_pass_percentage: number;
  require_all_terms: boolean;
  auto_promote: boolean;
  last_processed_at?: string;
  is_locked?: boolean;
}

interface StudentPromotion {
  student_id: string;
  student_number: string;
  student_name: string;
  current_class_id: string;
  current_class_name: string;
  current_class_level: string;
  current_class_stream?: string;
  next_class_id?: string | null;
  next_class_name?: string | null;
  is_terminal_level?: boolean;
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

interface APIResponse {
  settings: PromotionSettings;
  students: StudentPromotion[];
  total_students: number;
  eligible_count: number;
  graduating_count: number;
  needs_review_count: number;
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}

interface ClassProgress {
  classId: string;
  className: string;
  classLevel: string;
  classLevelOrder: number;
  educationLevel: string;
  educationLevelOrder: number;
  totalStudents: number;
  status: "pending" | "in_progress" | "completed";
  processedStudents: number;
  promotedStudents: number;
  graduatedStudents: number;
  repeatedStudents: number;
  mapping: any;
  completedAt: string | null;
}

interface ClassMapping {
  source_class_id: string;
  destination_class_id: string | null;
}

interface DestinationOption {
  class_id: string;
  class_name: string;
  class_level: string;
  stream_name?: string;
  is_stream: boolean;
}

interface FilterState {
  search: string;
  statusFilter: "all" | "eligible" | "needs_review";
}

interface Stats {
  total_students: number;
  eligible_count: number;
  graduating_count: number;
  needs_review_count: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const calculateGrade = (average: number): string => {
  if (average >= 75) return "A1";
  if (average >= 70) return "B2";
  if (average >= 65) return "B3";
  if (average >= 60) return "C4";
  if (average >= 55) return "C5";
  if (average >= 50) return "C6";
  if (average >= 45) return "D7";
  if (average >= 40) return "E8";
  return "F9";
};

const determineAction = (
  student: StudentPromotion
): "promote" | "graduate" | "repeat" => {
  if (student.is_terminal_level && student.is_eligible) {
    return "graduate";
  }
  return student.is_eligible ? "promote" : "repeat";
};

// ============================================================================
// MEMOIZED COMPONENTS
// ============================================================================

// Student Row Component - Memoized for performance
const StudentPromotionRow = memo(
  ({
    student,
    isSelected,
    onSelectionChange,
    promotionActions,
    settings,
  }: {
    student: StudentPromotion;
    isSelected: boolean;
    onSelectionChange: (checked: boolean) => void;
    promotionActions: Record<string, "promote" | "graduate" | "repeat">;
    settings: PromotionSettings;
  }) => {
    const action = determineAction(student);

    return (
      <tr
        className={`border-t transition-colors ${
          isSelected ? "bg-blue-50" : "hover:bg-muted/50"
        }`}
      >
        <td className="p-3 w-12">
          <Checkbox checked={isSelected} onCheckedChange={onSelectionChange} />
        </td>
        <td className="p-3">
          <div>
            <p className="font-medium text-sm">{student.student_name}</p>
            <p className="text-xs text-muted-foreground">
              {student.student_number}
            </p>
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
                student.is_eligible ? "text-green-600" : "text-red-600"
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
          {action === "graduate" && (
            <Badge className="bg-purple-100 text-purple-700 border-purple-300">
              <GraduationCap className="h-3 w-3 mr-1" />
              Graduating
            </Badge>
          )}
          {action === "promote" && (
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Eligible
            </Badge>
          )}
          {action === "repeat" && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Needs Review
            </Badge>
          )}
        </td>
        <td className="p-3 text-center">
          {action === "graduate" && (
            <Badge variant="outline" className="bg-purple-50">
              <Award className="h-3 w-3 mr-1" />
              Graduate
            </Badge>
          )}
          {action === "promote" && (
            <Badge variant="outline" className="bg-green-50">
              <ArrowRight className="h-3 w-3 mr-1" />
              Promote
            </Badge>
          )}
          {action === "repeat" && (
            <Badge variant="outline" className="bg-orange-50">
              <RefreshCw className="h-3 w-3 mr-1" />
              Repeat
            </Badge>
          )}
        </td>
      </tr>
    );
  }
);

StudentPromotionRow.displayName = "StudentPromotionRow";

// Class Progress Card
const ClassProgressCard = memo(
  ({ progress, isSelected, onselect }: { progress: ClassProgress; isSelected: boolean; onselect: () => void }) => {
    const completionPercent = progress.totalStudents > 0
      ? Math.round((progress.processedStudents / progress.totalStudents) * 100)
      : 0;

    return (
      <Card
        className={`cursor-pointer transition-all ${
          isSelected
            ? "border-blue-500 bg-blue-50 shadow-md"
            : "hover:shadow-md"
        } ${progress.status === "completed" ? "border-green-200 bg-green-50" : ""}`}
        onClick={onselect}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base">{progress.className}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {progress.classLevel}
              </CardDescription>
            </div>
            {progress.status === "completed" && (
              <Badge className="bg-green-600">✓ Done</Badge>
            )}
            {progress.status === "in_progress" && (
              <Badge className="bg-blue-600">In Progress</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {progress.processedStudents}/{progress.totalStudents} processed
              </span>
              <span className="font-medium">{completionPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  progress.status === "completed"
                    ? "bg-green-600"
                    : "bg-blue-600"
                }`}
                style={{ width: `${completionPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white p-2 rounded border">
              <div className="text-green-600 font-semibold">
                {progress.promotedStudents}
              </div>
              <div className="text-muted-foreground">Promoted</div>
            </div>
            <div className="bg-white p-2 rounded border">
              <div className="text-purple-600 font-semibold">
                {progress.graduatedStudents}
              </div>
              <div className="text-muted-foreground">Graduated</div>
            </div>
            <div className="bg-white p-2 rounded border">
              <div className="text-orange-600 font-semibold">
                {progress.repeatedStudents}
              </div>
              <div className="text-muted-foreground">Repeat</div>
            </div>
          </div>

          {/* Destination mapping */}
          {progress.mapping?.destination_class_id && (
            <div className="bg-gray-50 p-2 rounded text-xs">
              <div className="text-muted-foreground mb-1">Destination:</div>
              <div className="font-medium text-sm">
                → {progress.mapping.destination_class_name || progress.mapping.destination_class_id}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

ClassProgressCard.displayName = "ClassProgressCard";

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function PromotionsPage() {
  const { schoolId } = useSchoolContext();
  
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  // Workflow phases
  const [phase, setPhase] = useState<"overview" | "mapping" | "processing">("overview");
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  // Class-by-class workflow
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [classProgress, setClassProgress] = useState<ClassProgress[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<DestinationOption[]>([]);
  const [selectedDestinationClass, setSelectedDestinationClass] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Filter state for students
  const [filterState, dispatchFilter] = useReducer(
    (state: FilterState, action: Partial<FilterState>) => ({
      ...state,
      ...action,
    }),
    {
      search: "",
      statusFilter: "all" as const,
    }
  );

  const [settings, setSettings] = useState<PromotionSettings>({
    minimum_pass_percentage: 40,
    require_all_terms: false,
    auto_promote: true,
  });

  const [students, setStudents] = useState<StudentPromotion[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_students: 0,
    eligible_count: 0,
    graduating_count: 0,
    needs_review_count: 0,
  });

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Dialogs
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [totalPages, setTotalPages] = useState(0);

  // Promotion actions override
  const [promotionActions, setPromotionActions] = useState<
    Record<string, "promote" | "graduate" | "repeat">
  >({});

  // ========================================================================
  // CALLBACKS
  // ========================================================================

  const fetchSessions = useCallback(async () => {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSessions(data || []);

      const currentSession = (data as Session[] || []).find((s) => s.is_current);
      if (currentSession) {
        setSelectedSessionId(currentSession.id);
      }
    } catch (error: any) {
      console.error("Error fetching sessions:", error);
      toast.error("Failed to load sessions");
    }
  }, [schoolId]);

  const fetchClassProgress = useCallback(async () => {
    if (!selectedSessionId || !schoolId) return;
    setLoadingProgress(true);
    try {
      const response = await fetch(
        `/api/admin/promotions/class-progress?sessionId=${selectedSessionId}`
      );
      if (!response.ok) throw new Error("Failed to fetch class progress");

      const data = await response.json();
      setClassProgress(data.classProgress || []);
    } catch (error: any) {
      console.error("Error fetching class progress:", error);
      toast.error("Failed to load class progress");
    } finally {
      setLoadingProgress(false);
    }
  }, [selectedSessionId, schoolId]);

  const fetchDestinationOptions = useCallback(async () => {
    if (!selectedSessionId || !selectedClass?.id) return;
    try {
      const response = await fetch(
        `/api/admin/promotions/class-mappings?sessionId=${selectedSessionId}&sourceClassId=${selectedClass.id}`
      );
      if (!response.ok) throw new Error("Failed to fetch destination options");

      const data = await response.json();
      setDestinationOptions(data.destinationOptions || []);
      if (data.currentMapping?.destination_class_id) {
        setSelectedDestinationClass(data.currentMapping.destination_class_id);
      } else {
        setSelectedDestinationClass(null);
      }
    } catch (error: any) {
      console.error("Error fetching destination options:", error);
      toast.error("Failed to load destination options");
    }
  }, [selectedSessionId, selectedClass]);

  const saveClassMapping = useCallback(async () => {
    if (!selectedSessionId || !selectedClass?.id) return;
    try {
      const response = await fetch("/api/admin/promotions/class-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          sourceClassId: selectedClass.id,
          destinationClassId: selectedDestinationClass,
        }),
      });

      if (!response.ok) throw new Error("Failed to save mapping");
      toast.success("Class mapping saved successfully");
    } catch (error: any) {
      console.error("Error saving mapping:", error);
      toast.error(error.message || "Failed to save mapping");
    }
  }, [selectedSessionId, selectedClass, selectedDestinationClass]);

  const fetchPromotionData = useCallback(async () => {
    if (!selectedClass?.id || !selectedSessionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sessionId: selectedSessionId,
        classId: selectedClass.id,
        excludeProcessed: "true", // Exclude already processed students
        limit: String(pagination.pageSize),
        offset: String(pagination.pageIndex * pagination.pageSize),
        search: filterState.search,
        statusFilter: filterState.statusFilter,
      });

      const response = await fetch(`/api/admin/promotions?${params}`);

      if (!response.ok) throw new Error("Failed to fetch promotion data");

      const data: APIResponse = await response.json();

      setSettings(data.settings);
      setStudents(data.students);
      setStats({
        total_students: data.total_students,
        eligible_count: data.eligible_count,
        graduating_count: data.graduating_count,
        needs_review_count: data.needs_review_count,
      });

      setTotalPages(Math.ceil(data.pagination.total / pagination.pageSize));
    } catch (error: any) {
      console.error("Error fetching promotion data:", error);
      toast.error("Failed to load promotion data");
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId, selectedClass, pagination, filterState]);

  const handleUpdateSettings = useCallback(async () => {
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
    } catch (error: any) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    }
  }, [selectedSessionId, settings]);

  const handlePromote = useCallback(async () => {
    if (!schoolId || !selectedClass?.id) return;
    setProcessing(true);
    try {
      const selectedStudentsList = students.filter((s) =>
        Object.keys(rowSelection).includes(students.indexOf(s).toString())
      );

      const promotions = selectedStudentsList.map((student) => {
        const overrideAction = promotionActions[student.student_id];
        const action = overrideAction || determineAction(student);
        const isGraduating = action === "graduate";

        if (action === "promote" && !student.next_class_id) {
          throw new Error(
            `No next class configured for ${student.student_name} (${student.current_class_name}). Please configure the next class level in School Config.`
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
          action: action,
          next_class_id: action === "promote" ? student.next_class_id : null,
          notes: isGraduating
            ? "Graduated from final class level"
            : action === "promote"
            ? `Promoted to ${student.next_class_name || "next class"} with ${student.cumulative_average.toFixed(1)}% average`
            : `Repeated due to ${student.cumulative_average.toFixed(1)}% average (below ${settings.minimum_pass_percentage}%)`,
        };
      });

      const response = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          classId: selectedClass.id, // NEW: include classId for progress tracking
          idempotencyKey:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `promo_${Date.now()}`,
          promotions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to process promotions");
      }

      const result = await response.json();

      if (result.results?.errors?.length > 0) {
        toast.error(
          `Completed with ${result.results.errors.length} error(s). Check console for details.`
        );
        console.error("Promotion errors:", result.results.errors);
      } else {
        toast.success(result.message);
      }

      setShowConfirmDialog(false);
      setRowSelection({});
      setPromotionActions({});
      
      // Refresh class progress and return to overview
      await fetchClassProgress();
      setPhase("overview");
      setSelectedClass(null);
    } catch (error: any) {
      console.error("Error processing promotions:", error);
      toast.error(error?.message || "Failed to process promotions");
    } finally {
      setProcessing(false);
    }
  }, [schoolId, students, rowSelection, promotionActions, settings, selectedSessionId, selectedClass, fetchClassProgress]);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  useEffect(() => {
    if (schoolId) {
      fetchSessions();
    }
  }, [schoolId, fetchSessions]);

  // When session changes, fetch class progress
  useEffect(() => {
    if (selectedSessionId && schoolId) {
      fetchClassProgress();
      setPhase("overview");
      setSelectedClass(null);
    }
  }, [selectedSessionId, schoolId, fetchClassProgress]);

  // When selected class changes, fetch destination options and student data
  useEffect(() => {
    if (selectedClass?.id && selectedSessionId) {
      fetchDestinationOptions();
      setPagination({ pageIndex: 0, pageSize: 50 });
    }
  }, [selectedClass, selectedSessionId, fetchDestinationOptions]);

  // When pagination or filters change, fetch data
  useEffect(() => {
    if (selectedClass?.id && selectedSessionId && phase === "processing") {
      fetchPromotionData();
    }
  }, [selectedSessionId, selectedClass, pagination, filterState, phase, fetchPromotionData]);

  // ========================================================================
  // MEMOIZED VALUES
  // ========================================================================

  const selectedCount = useMemo(
    () => Object.keys(rowSelection).length,
    [rowSelection]
  );

  const needsReviewCount = useMemo(
    () =>
      students.filter(
        (s) => (promotionActions[s.student_id] || determineAction(s)) === "repeat"
      ).length,
    [students, promotionActions]
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Student Promotions</h1>
            <p className="text-muted-foreground mt-1">
              Class-by-class promotion workflow
            </p>
          </div>
          <Button
            onClick={() => setShowSettingsDialog(true)}
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Session Selection */}
        {!selectedSessionId ? (
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
                  {sessions
                    .filter((session) => session.is_current)
                    .map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name} (Current)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* PHASE 1: OVERVIEW & CLASS SELECTION */}
            {phase === "overview" && (
              <div className="space-y-6">
                {/* Progress Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListChecks className="h-5 w-5" />
                      Overall Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingProgress ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Loading progress...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold">
                            {classProgress.filter((c) => c.status === "completed").length}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Classes Completed
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold">
                            {classProgress.filter((c) => c.status === "in_progress").length}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            In Progress
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold">
                            {classProgress.filter((c) => c.status === "pending").length}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Pending
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold">
                            {classProgress.length}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Total Classes
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Classes Grid - Grouped by Education Level */}
                {loadingProgress ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Loading classes...
                  </div>
                ) : classProgress.length === 0 ? (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center text-muted-foreground">
                        No classes found for this session
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-8">
                    {Array.from(
                      classProgress
                        .sort((a, b) => a.educationLevelOrder - b.educationLevelOrder)
                        .reduce((groups, cp) => {
                          const key = cp.educationLevel;
                          const existing = groups.get(key) || [];
                          groups.set(key, [...existing, cp]);
                          return groups;
                        }, new Map<string, ClassProgress[]>())
                        .entries()
                    ).map(([educationLevel, classes]) => (
                      <div key={educationLevel} className="space-y-4">
                        {/* Education Level Header */}
                        <div className="flex items-center gap-3 px-2 py-3 border-b-2 border-blue-200">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {educationLevel}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {classes.length} class{classes.length !== 1 ? "es" : ""}
                            </p>
                          </div>
                          <div className="flex gap-6 text-sm">
                            <div className="text-center">
                              <div className="font-semibold text-green-600">
                                {classes.filter(c => c.status === "completed").length}
                              </div>
                              <div className="text-muted-foreground text-xs">Completed</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-blue-600">
                                {classes.filter(c => c.status === "in_progress").length}
                              </div>
                              <div className="text-muted-foreground text-xs">In Progress</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-gray-600">
                                {classes.filter(c => c.status === "pending").length}
                              </div>
                              <div className="text-muted-foreground text-xs">Pending</div>
                            </div>
                          </div>
                        </div>

                        {/* Classes for this Education Level */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {classes
                            .sort((a, b) => a.classLevelOrder - b.classLevelOrder)
                            .map((cp) => (
                              <ClassProgressCard
                                key={cp.classId}
                                progress={cp}
                                isSelected={selectedClass?.id === cp.classId}
                                onselect={() => {
                                  setSelectedClass({ id: cp.classId, name: cp.className });
                                  setPhase("mapping");
                                }}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PHASE 2: CLASS MAPPING */}
            {phase === "mapping" && selectedClass && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setPhase("overview")}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Overview
                  </Button>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Configure Class Mapping
                    </CardTitle>
                    <CardDescription>
                      {selectedClass.name} → Select destination class
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Destination Class</Label>
                      <Select
                        value={selectedDestinationClass || ""}
                        onValueChange={setSelectedDestinationClass}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            destinationOptions.length === 0 
                              ? "No destination classes available"
                              : "Select destination class..."
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {destinationOptions.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No destination classes found
                            </div>
                          ) : (
                            destinationOptions.map((option) => (
                              <SelectItem 
                                key={option.class_id} 
                                value={option.class_id}
                              >
                                {option.class_name}
                                {option.stream_name && ` (${option.stream_name})`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedDestinationClass && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm">
                          <strong>{selectedClass.name}</strong> will promote students to{" "}
                          <strong>
                            {destinationOptions.find(
                              (o) => o.class_id === selectedDestinationClass
                            )?.class_name}
                          </strong>
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={saveClassMapping}
                        disabled={!selectedDestinationClass}
                      >
                        Save Mapping
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPhase("processing");
                          setRowSelection({});
                        }}
                        disabled={destinationOptions.length === 0 && !selectedDestinationClass}
                      >
                        Continue to Processing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* PHASE 3: PROCESS STUDENTS */}
            {phase === "processing" && selectedClass && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setPhase("mapping")}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Mapping
                  </Button>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Students
                      </CardTitle>
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.total_students}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Eligible
                      </CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {stats.eligible_count}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Graduating
                      </CardTitle>
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
                      <CardTitle className="text-sm font-medium">
                        Review
                      </CardTitle>
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {stats.needs_review_count}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Students Table */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <CardTitle>Students for {selectedClass.name}</CardTitle>
                        <CardDescription>
                          Not yet processed in this class
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => {
                          setPromotionActions({});
                          setShowConfirmDialog(true);
                        }}
                        disabled={selectedCount === 0 || processing}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Process {selectedCount} Student{selectedCount !== 1 ? "s" : ""}
                      </Button>
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
                          value={filterState.search}
                          onChange={(e) =>
                            dispatchFilter({ search: e.target.value })
                          }
                        />
                      </div>

                      <Select
                        value={filterState.statusFilter}
                        onValueChange={(v: any) =>
                          dispatchFilter({ statusFilter: v })
                        }
                      >
                        <SelectTrigger className="w-full md:w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="eligible">Eligible</SelectItem>
                          <SelectItem value="needs_review">Needs Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Students Table */}
                    {loading ? (
                      <div className="text-center py-12 text-muted-foreground">
                        Loading students...
                      </div>
                    ) : students.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No students found - this class may be completed
                      </div>
                    ) : (
                      <>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="p-3 text-left w-12"></th>
                                <th className="p-3 text-left">Student</th>
                                <th className="p-3 text-center">Terms</th>
                                <th className="p-3 text-center">Average</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {students.map((student, idx) => (
                                <StudentPromotionRow
                                  key={student.student_id}
                                  student={student}
                                  isSelected={rowSelection[idx] === true}
                                  onSelectionChange={(checked) => {
                                    setRowSelection((prev) => ({
                                      ...prev,
                                      [idx]: checked ? true : undefined,
                                    }));
                                  }}
                                  promotionActions={promotionActions}
                                  settings={settings}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm text-muted-foreground">
                            Page {pagination.pageIndex + 1} of{" "}
                            {totalPages || 1}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() =>
                                setPagination((prev) => ({
                                  ...prev,
                                  pageIndex: Math.max(0, prev.pageIndex - 1),
                                }))
                              }
                              disabled={pagination.pageIndex === 0}
                              variant="outline"
                              size="sm"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() =>
                                setPagination((prev) => ({
                                  ...prev,
                                  pageIndex: prev.pageIndex + 1,
                                }))
                              }
                              disabled={pagination.pageIndex >= totalPages - 1}
                              variant="outline"
                              size="sm"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Settings Dialog */}
            <Dialog
              open={showSettingsDialog}
              onOpenChange={setShowSettingsDialog}
            >
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
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="require_all_terms"
                      checked={settings.require_all_terms}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          require_all_terms: !!checked,
                        })
                      }
                    />
                    <Label htmlFor="require_all_terms">
                      Require all terms to have results
                    </Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowSettingsDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateSettings}>Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Promotions</AlertDialogTitle>
                  <AlertDialogDescription>
                    Review and confirm the promotion of {selectedCount} student(s)
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Student Actions Summary */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {students
                    .filter(
                      (_, idx) =>
                        rowSelection[idx] === true &&
                        (promotionActions[students[idx].student_id] ||
                          determineAction(students[idx])) === "repeat"
                    )
                    .map((student) => {
                      const defaultAction = determineAction(student);
                      const currentAction =
                        promotionActions[student.student_id] || defaultAction;

                      return (
                        <div
                          key={student.student_id}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {student.student_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {student.student_number} • Average:{" "}
                                {student.cumulative_average.toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          {/* Action Selector */}
                          <div className="flex gap-2 flex-wrap">
                            {(
                              ["promote", "graduate", "repeat"] as const
                            ).map((action) => {
                              const isSelected = currentAction === action;
                              const isDefault = defaultAction === action;

                              return (
                                <button
                                  key={action}
                                  onClick={() =>
                                    setPromotionActions({
                                      ...promotionActions,
                                      [student.student_id]: action,
                                    })
                                  }
                                  className={`flex-1 min-w-[80px] px-2 py-2 text-xs rounded border-2 transition-all ${
                                    isSelected
                                      ? "border-blue-500 bg-blue-50"
                                      : "border-gray-200"
                                  } ${isDefault ? "ring-1 ring-green-500" : ""}`}
                                >
                                  <div className="font-medium">
                                    {action === "promote" && "Promote"}
                                    {action === "graduate" && "Graduate"}
                                    {action === "repeat" && "Repeat"}
                                  </div>
                                  {isDefault && (
                                    <div className="text-xs text-green-600">
                                      (default)
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Summary */}
                <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                  <div className="font-medium">Summary:</div>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li>
                      • Promoted:{" "}
                      {
                        students
                          .filter((_, idx) => rowSelection[idx] === true)
                          .filter(
                            (s) =>
                              (promotionActions[s.student_id] ||
                                determineAction(s)) === "promote"
                          ).length
                      }
                    </li>
                    <li>
                      • Graduated:{" "}
                      {
                        students
                          .filter((_, idx) => rowSelection[idx] === true)
                          .filter(
                            (s) =>
                              (promotionActions[s.student_id] ||
                                determineAction(s)) === "graduate"
                          ).length
                      }
                    </li>
                    <li>
                      • Repeating:{" "}
                      {
                        students
                          .filter((_, idx) => rowSelection[idx] === true)
                          .filter(
                            (s) =>
                              (promotionActions[s.student_id] ||
                                determineAction(s)) === "repeat"
                          ).length
                      }
                    </li>
                  </ul>
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={processing}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handlePromote}
                    disabled={processing}
                  >
                    {processing ? "Processing..." : "Confirm & Process"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
