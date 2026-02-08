"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  Search,
  Download,
  GraduationCap,
  TrendingUp,
  Users,
  Award,
  BookOpen,
  FileText,
  Filter,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Session, Class } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import * as XLSX from "xlsx-js-style";

interface ClassHistoryRecord {
  id: string;
  student_id: string;
  class_id: string;
  session_id: string;
  student_name: string;
  student_number: string;
  class_name: string;
  education_level: string;
  department?: string;
  terms_completed: number;
  average_score: number;
  cumulative_grade: string;
  position?: number;
  total_students?: number;
  promoted: boolean;
  promotion_status: string;
  promoted_to_class_id?: string;
  promotion_notes?: string;
  recorded_at: string;
  promoted_at?: string;
  session_name: string;
}

interface QueryMode {
  type:
    | "class_roster"
    | "student_history"
    | "class_stats"
    | "graduates"
    | "repeaters"
    | "performance";
  label: string;
  description: string;
  icon: any;
}

const QUERY_MODES: QueryMode[] = [
  {
    type: "class_roster",
    label: "Class Roster",
    description: "Who was in this class this year?",
    icon: Users,
  },
  {
    type: "student_history",
    label: "Student History",
    description: "Which classes has this student been in?",
    icon: BookOpen,
  },
  {
    type: "class_stats",
    label: "Class Statistics",
    description: "How many students per class/session?",
    icon: TrendingUp,
  },
  {
    type: "graduates",
    label: "Graduates",
    description: "Who graduated from SS3?",
    icon: GraduationCap,
  },
  {
    type: "repeaters",
    label: "Repeaters",
    description: "Who repeated a class?",
    icon: History,
  },
  {
    type: "performance",
    label: "Performance",
    description: "Class performance over time",
    icon: Award,
  },
];

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [history, setHistory] = useState<ClassHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Query mode
  const [queryMode, setQueryMode] = useState<string>("class_roster");

  // Filters
  const [selectedSessionId, setSelectedSessionId] = useState("all");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [search, setSearch] = useState("");
  const [promotionStatusFilter, setPromotionStatusFilter] = useState("all");
  const [educationLevelFilter, setEducationLevelFilter] = useState("all");

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [
    queryMode,
    selectedSessionId,
    selectedClassId,
    search,
    promotionStatusFilter,
    educationLevelFilter,
  ]);

  async function fetchMetadata() {
    try {
      const [sessionsRes, classesRes] = await Promise.all([
        supabase.from("sessions").select("*").order("created_at", { ascending: false }),
        supabase.from("classes").select("*").order("name"),
      ]);

      if (sessionsRes.error) throw sessionsRes.error;
      if (classesRes.error) throw classesRes.error;

      setSessions(sessionsRes.data || []);
      setClasses(classesRes.data || []);

      // Auto-select current session
      const currentSession = sessionsRes.data?.find((s) => s.is_current);
      if (currentSession) {
        setSelectedSessionId(currentSession.id);
      }
    } catch (error: any) {
      console.error("Error fetching metadata:", error);
      toast.error("Failed to load metadata");
    }
  }

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (selectedSessionId !== "all") params.append("sessionId", selectedSessionId);
      if (selectedClassId !== "all") params.append("classId", selectedClassId);
      if (promotionStatusFilter !== "all")
        params.append("promotionStatus", promotionStatusFilter);
      if (educationLevelFilter !== "all")
        params.append("educationLevel", educationLevelFilter);

      const response = await fetch(`/api/admin/history?${params.toString()}`);
      console.log("Fetch URL:", `/api/admin/history?${params.toString()}`);
      console.log("Response status:", response.status);

      if (!response.ok) throw new Error("Failed to fetch history");

      const data = await response.json();
      console.log("Fetched history data:", data);
      setHistory(data.history);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load class history");
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const exportData = filteredHistory.map((record) => ({
      "Session": record.session_name,
      "Student ID": record.student_number,
      "Student Name": record.student_name,
      "Class": record.class_name,
      "Education Level": record.education_level,
      "Department": record.department || "N/A",
      "Terms Completed": record.terms_completed,
      "Average Score": record.average_score.toFixed(2),
      "Grade": record.cumulative_grade,
      "Position": record.position || "N/A",
      "Promotion Status": record.promotion_status,
      "Promoted": record.promoted ? "Yes" : "No",
      "Promotion Notes": record.promotion_notes || "",
      "Recorded Date": new Date(record.recorded_at).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Class History");

    XLSX.writeFile(
      wb,
      `Class-History-${new Date().toISOString().split("T")[0]}.xlsx`
    );
    toast.success("History exported successfully");
  }

  const filteredHistory = history.filter((record) => {
    if (
      search &&
      !record.student_name.toLowerCase().includes(search.toLowerCase()) &&
      !record.student_number.toLowerCase().includes(search.toLowerCase()) &&
      !record.class_name.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  // Get unique education levels for filter
  const educationLevels = Array.from(
    new Set(classes.map((c) => c.education_level))
  ).filter(Boolean);

  const currentMode = QUERY_MODES.find((m) => m.type === queryMode);

  // Auto-filter based on query mode
  const modeFilteredHistory = (() => {
    let result = filteredHistory;
    
    if (queryMode === "graduates") {
      result = result.filter((h) => h.promotion_status === "graduated");
    } else if (queryMode === "repeaters") {
      result = result.filter((h) => h.promotion_status === "repeated");
    }
    
    return result;
  })();

  // Get relevant stats based on mode
  const relevantStats = {
    total_records: modeFilteredHistory.length,
    unique_students: new Set(modeFilteredHistory.map((h) => h.student_id)).size,
    unique_classes: new Set(modeFilteredHistory.map((h) => h.class_id)).size,
    promoted_count: modeFilteredHistory.filter((h) => h.promotion_status === "promoted")
      .length,
    graduated_count: modeFilteredHistory.filter((h) => h.promotion_status === "graduated")
      .length,
    repeated_count: modeFilteredHistory.filter((h) => h.promotion_status === "repeated")
      .length,
    average_performance:
      modeFilteredHistory.reduce((sum, h) => sum + h.average_score, 0) /
        modeFilteredHistory.length || 0,
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Class History</h1>
            <p className="text-muted-foreground mt-1">
              {currentMode?.description}
            </p>
          </div>
          <Button onClick={handleExport} disabled={modeFilteredHistory.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Query Mode Selection - Now as horizontal tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {QUERY_MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = queryMode === mode.type;

            return (
              <button
                key={mode.type}
                onClick={() => setQueryMode(mode.type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contextual Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Session</label>
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {queryMode !== "student_history" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Class</label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {queryMode !== "graduates" && queryMode !== "repeaters" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Education Level</label>
                  <Select
                    value={educationLevelFilter}
                    onValueChange={setEducationLevelFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      {educationLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {queryMode === "class_roster" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Promotion Status</label>
                  <Select
                    value={promotionStatusFilter}
                    onValueChange={setPromotionStatusFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="promoted">Promoted</SelectItem>
                      <SelectItem value="graduated">Graduated</SelectItem>
                      <SelectItem value="repeated">Repeated</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder={
                    queryMode === "student_history"
                      ? "Search by student name or ID..."
                      : "Search by student, ID, or class..."
                  }
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context-Aware Statistics */}
        {queryMode !== "performance" && queryMode !== "class_stats" && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {queryMode === "graduates"
                    ? "Graduates"
                    : queryMode === "repeaters"
                    ? "Repeaters"
                    : "Total Students"}
                </CardTitle>
                {queryMode === "graduates" && (
                  <GraduationCap className="h-4 w-4 text-purple-600" />
                )}
                {queryMode === "repeaters" && (
                  <History className="h-4 w-4 text-orange-600" />
                )}
                {queryMode !== "graduates" && queryMode !== "repeaters" && (
                  <Users className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {queryMode === "graduates"
                    ? relevantStats.graduated_count
                    : queryMode === "repeaters"
                    ? relevantStats.repeated_count
                    : relevantStats.unique_students}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Records</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{relevantStats.total_records}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Classes</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{relevantStats.unique_classes}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {currentMode && <currentMode.icon className="h-5 w-5" />}
                  {currentMode?.label || "Results"}
                </CardTitle>
              </div>
              <Badge variant="outline">
                {modeFilteredHistory.length} result{modeFilteredHistory.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading history...
              </div>
            ) : modeFilteredHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No results found for "{currentMode?.label}"</p>
                <p className="text-sm mt-2">
                  {queryMode === "graduates" && "Process promotions to mark students as graduated"}
                  {queryMode === "repeaters" && "Only students who have repeated a class will appear here"}
                  {queryMode !== "graduates" &&
                    queryMode !== "repeaters" &&
                    "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-center">Terms</TableHead>
                      <TableHead className="text-center">Average</TableHead>
                      {queryMode !== "repeaters" && <TableHead className="text-center">Position</TableHead>}
                      <TableHead className="text-center">Status</TableHead>
                      {queryMode !== "graduates" && queryMode !== "repeaters" && <TableHead>Notes</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modeFilteredHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{record.session_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.student_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {record.student_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.class_name}</p>
                            {record.department && (
                              <p className="text-xs text-muted-foreground">
                                {record.department}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{record.terms_completed}/3</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-semibold">
                              {record.average_score.toFixed(1)}%
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {record.cumulative_grade}
                            </Badge>
                          </div>
                        </TableCell>
                        {queryMode !== "repeaters" && (
                          <TableCell className="text-center">
                            {record.position ? (
                              <span className="font-semibold">
                                {record.position}/{record.total_students}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          {record.promotion_status === "promoted" && (
                            <Badge className="bg-green-100 text-green-700 border-green-300">
                              Promoted
                            </Badge>
                          )}
                          {record.promotion_status === "graduated" && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                              <GraduationCap className="h-3 w-3 mr-1" />
                              Graduated
                            </Badge>
                          )}
                          {record.promotion_status === "repeated" && (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                              Repeated
                            </Badge>
                          )}
                          {record.promotion_status === "pending" && (
                            <Badge variant="outline">Pending</Badge>
                          )}
                          {record.promotion_status === "withdrawn" && (
                            <Badge className="bg-gray-100 text-gray-700 border-gray-300">
                              Withdrawn
                            </Badge>
                          )}
                        </TableCell>
                        {queryMode !== "graduates" && queryMode !== "repeaters" && (
                          <TableCell>
                            <p className="text-sm text-muted-foreground max-w-xs truncate">
                              {record.promotion_notes || "—"}
                            </p>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Insights Based on Query Mode */}
        {modeFilteredHistory.length > 0 && queryMode === "class_stats" && (
          <Card>
            <CardHeader>
              <CardTitle>Class Size Breakdown</CardTitle>
              <CardDescription>
                Number of students per class
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(
                  modeFilteredHistory.reduce((acc, record) => {
                    const key = record.class_name;
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([className, count]) => {
                    const totalInClass = modeFilteredHistory.filter(
                      (h) => h.class_name === className
                    ).length;
                    return (
                      <div
                        key={className}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="font-semibold">{className}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Set(
                              modeFilteredHistory
                                .filter((h) => h.class_name === className)
                                .map((h) => h.student_id)
                            ).size}{" "}
                            unique student{
                              new Set(
                                modeFilteredHistory
                                  .filter((h) => h.class_name === className)
                                  .map((h) => h.student_id)
                              ).size !== 1
                                ? "s"
                                : ""
                            }
                          </p>
                        </div>
                        <Badge className="text-base px-3 py-1">{count} records</Badge>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {modeFilteredHistory.length > 0 && queryMode === "performance" && (
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>
                Average performance by class
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(
                  modeFilteredHistory.reduce((acc, record) => {
                    const key = record.class_name;
                    if (!acc[key]) {
                      acc[key] = { total: 0, count: 0 };
                    }
                    acc[key].total += record.average_score;
                    acc[key].count += 1;
                    return acc;
                  }, {} as Record<string, { total: number; count: number }>)
                )
                  .map(([className, data]) => ({
                    className,
                    average: data.total / data.count,
                  }))
                  .sort((a, b) => b.average - a.average)
                  .map(({ className, average }) => (
                    <div
                      key={className}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <span className="font-medium">{className}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              average >= 70
                                ? "bg-green-600"
                                : average >= 60
                                ? "bg-yellow-600"
                                : "bg-red-600"
                            }`}
                            style={{ width: `${Math.min(average, 100)}%` }}
                          />
                        </div>
                        <span className="font-bold w-12 text-right">
                          {average.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
