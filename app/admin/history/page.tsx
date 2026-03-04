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
import { useSchoolContext } from "@/hooks/use-school-context";
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
  const { schoolId } = useSchoolContext();
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
    if (schoolId) {
      fetchMetadata();
    }
  }, [schoolId]);

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
        supabase.from("sessions").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
        supabase.from("classes").select("*").eq("school_id", schoolId).order("name"),
      ]);

      if (sessionsRes.error) throw sessionsRes.error;
      if (classesRes.error) throw classesRes.error;

      setSessions(sessionsRes.data || []);
      setClasses(classesRes.data || []);

      // Auto-select current session
      const currentSession = sessionsRes.data?.find((s: any) => s.is_current);
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

        {/* Results Section - Mode-Specific UI */}
        {loading ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                Loading history...
              </div>
            </CardContent>
          </Card>
        ) : modeFilteredHistory.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
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
            </CardContent>
          </Card>
        ) : (
          <>
            {/* CLASS ROSTER VIEW - Card Grid */}
            {queryMode === "class_roster" && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modeFilteredHistory.map((record) => (
                  <Card key={record.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{record.student_name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Users className="h-3 w-3" />
                            {record.student_number}
                          </CardDescription>
                        </div>
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
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Class</span>
                          <span className="font-medium">{record.class_name}</span>
                        </div>
                        {record.department && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Department</span>
                            <span className="font-medium">{record.department}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Performance</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{record.cumulative_grade}</Badge>
                            <span className="font-bold">{record.average_score.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Position</span>
                          <span className="font-semibold">
                            {record.position || "—"}/{record.total_students || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Terms</span>
                          <Badge variant="outline">{record.terms_completed}/3</Badge>
                        </div>
                      </div>
                      {record.promotion_notes && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground italic">
                            "{record.promotion_notes}"
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* STUDENT HISTORY VIEW - Timeline */}
            {queryMode === "student_history" && (
              <Card>
                <CardHeader>
                  <CardTitle>Academic Journey</CardTitle>
                  <CardDescription>
                    {modeFilteredHistory.length} record{modeFilteredHistory.length !== 1 ? "s" : ""} found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {modeFilteredHistory.map((record, index) => (
                      <div key={record.id} className="relative pl-8 pb-4">
                        {/* Timeline line */}
                        {index !== modeFilteredHistory.length - 1 && (
                          <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
                        )}
                        
                        {/* Timeline dot */}
                        <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4 hover:bg-muted transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-lg flex items-center gap-2">
                                {record.class_name}
                                {record.department && (
                                  <Badge variant="outline" className="text-xs">
                                    {record.department}
                                  </Badge>
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="h-3 w-3" />
                                {record.session_name}
                              </p>
                            </div>
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
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Average Score</p>
                              <p className="text-xl font-bold">{record.average_score.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Grade</p>
                              <Badge className="mt-1">{record.cumulative_grade}</Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Position</p>
                              <p className="text-lg font-semibold mt-1">
                                {record.position || "—"}/{record.total_students || "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Terms Completed</p>
                              <Badge variant="outline" className="mt-1">
                                {record.terms_completed}/3
                              </Badge>
                            </div>
                          </div>

                          {record.promotion_notes && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm text-muted-foreground italic">
                                "{record.promotion_notes}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* GRADUATES VIEW - Certificate Style Cards */}
            {queryMode === "graduates" && (
              <div className="grid gap-6 md:grid-cols-2">
                {modeFilteredHistory.map((record) => (
                  <Card 
                    key={record.id} 
                    className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:shadow-xl transition-shadow"
                  >
                    <CardHeader className="text-center pb-2">
                      <div className="mx-auto w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                        <GraduationCap className="h-8 w-8 text-purple-600" />
                      </div>
                      <CardTitle className="text-2xl">{record.student_name}</CardTitle>
                      <CardDescription className="text-base">
                        {record.student_number}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                      <div className="py-3 px-4 bg-white rounded-lg border border-purple-100">
                        <p className="text-sm text-muted-foreground">Graduated From</p>
                        <p className="text-xl font-bold text-purple-900">{record.class_name}</p>
                        {record.department && (
                          <p className="text-sm text-purple-600 font-medium">{record.department}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <p className="text-xs text-muted-foreground mb-1">Final Grade</p>
                          <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                            {record.cumulative_grade}
                          </Badge>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-100">
                          <p className="text-xs text-muted-foreground mb-1">Average</p>
                          <p className="font-bold text-purple-900">{record.average_score.toFixed(1)}%</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-100">
                          <p className="text-xs text-muted-foreground mb-1">Rank</p>
                          <p className="font-bold text-purple-900">
                            {record.position || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-purple-200">
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {record.session_name}
                        </p>
                        {record.promoted_at && (
                          <p className="text-xs text-purple-600 mt-1">
                            Graduated: {new Date(record.promoted_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* REPEATERS VIEW - Warning Style List */}
            {queryMode === "repeaters" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-orange-600" />
                    Students Who Repeated
                  </CardTitle>
                  <CardDescription>
                    {modeFilteredHistory.length} student{modeFilteredHistory.length !== 1 ? "s" : ""} repeated a class
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {modeFilteredHistory.map((record) => (
                      <div 
                        key={record.id}
                        className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <History className="h-6 w-6 text-orange-600" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-lg">{record.student_name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {record.student_number}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Repeated <span className="font-medium text-orange-900">{record.class_name}</span>
                            {record.department && (
                              <span> ({record.department})</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {record.session_name}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Performance</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{record.cumulative_grade}</Badge>
                              <span className="font-bold text-orange-900">
                                {record.average_score.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {record.terms_completed}/3 terms
                          </Badge>
                        </div>

                        {record.promotion_notes && (
                          <div className="flex-shrink-0 max-w-xs">
                            <p className="text-xs text-orange-800 italic bg-orange-100 px-3 py-2 rounded">
                              "{record.promotion_notes}"
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PERFORMANCE VIEW handled below in separate section */}
            {queryMode === "performance" && (
              <Card>
                <CardHeader>
                  <CardTitle>Performance Comparison</CardTitle>
                  <CardDescription>
                    Ranked by average performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(
                      modeFilteredHistory.reduce((acc, record) => {
                        const key = record.class_name;
                        if (!acc[key]) {
                          acc[key] = { total: 0, count: 0, records: [] };
                        }
                        acc[key].total += record.average_score;
                        acc[key].count += 1;
                        acc[key].records.push(record);
                        return acc;
                      }, {} as Record<string, { total: number; count: number; records: typeof modeFilteredHistory }>)
                    )
                      .map(([className, data]) => ({
                        className,
                        average: data.total / data.count,
                        count: data.count,
                        topScore: Math.max(...data.records.map(r => r.average_score)),
                        lowestScore: Math.min(...data.records.map(r => r.average_score)),
                      }))
                      .sort((a, b) => b.average - a.average)
                      .map(({ className, average, count, topScore, lowestScore }, index) => (
                        <div
                          key={className}
                          className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors border-l-4"
                          style={{
                            borderLeftColor: average >= 70 ? '#16a34a' : average >= 60 ? '#ca8a04' : '#dc2626'
                          }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                                {index + 1}
                              </div>
                              <div>
                                <h4 className="font-semibold text-lg">{className}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {count} student{count !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">{average.toFixed(1)}%</p>
                              <Badge 
                                className={
                                  average >= 70 
                                    ? 'bg-green-100 text-green-700 border-green-300'
                                    : average >= 60 
                                    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                    : 'bg-red-100 text-red-700 border-red-300'
                                }
                              >
                                {average >= 70 ? 'Excellent' : average >= 60 ? 'Good' : 'Needs Improvement'}
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all ${
                                    average >= 70
                                      ? 'bg-green-600'
                                      : average >= 60
                                      ? 'bg-yellow-600'
                                      : 'bg-red-600'
                                  }`}
                                  style={{ width: `${Math.min(average, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-12 text-right">100%</span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Range: {lowestScore.toFixed(1)}% - {topScore.toFixed(1)}%</span>
                              <span>Spread: {(topScore - lowestScore).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CLASS STATS VIEW */}
            {queryMode === "class_stats" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Class Enrollment Statistics</CardTitle>
                    <CardDescription>
                      Student distribution across classes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(
                        modeFilteredHistory.reduce((acc, record) => {
                          const key = record.class_name;
                          if (!acc[key]) {
                            acc[key] = {
                              count: 0,
                              students: new Set(),
                              education_level: record.education_level,
                              department: record.department,
                            };
                          }
                          acc[key].count += 1;
                          acc[key].students.add(record.student_id);
                          return acc;
                        }, {} as Record<string, { count: number; students: Set<string>; education_level: string; department?: string }>)
                      )
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([className, data]) => {
                          const uniqueStudents = data.students.size;
                          const totalRecords = data.count;
                          const maxRecords = Math.max(
                            ...Object.values(
                              modeFilteredHistory.reduce((acc, r) => {
                                acc[r.class_name] = (acc[r.class_name] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            )
                          );

                          return (
                            <div
                              key={className}
                              className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold text-lg">{className}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {data.education_level}
                                    </Badge>
                                    {data.department && (
                                      <Badge variant="outline" className="text-xs">
                                        {data.department}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-3xl font-bold text-primary">{uniqueStudents}</p>
                                  <p className="text-xs text-muted-foreground">
                                    student{uniqueStudents !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="h-2 rounded-full bg-primary transition-all"
                                      style={{ width: `${(totalRecords / maxRecords) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium w-16 text-right">
                                    {totalRecords} records
                                  </span>
                                </div>
                                {totalRecords !== uniqueStudents && (
                                  <p className="text-xs text-muted-foreground">
                                    {totalRecords - uniqueStudents} duplicate record{totalRecords - uniqueStudents !== 1 ? 's' : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
