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
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
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

      if (selectedSessionId) params.append("sessionId", selectedSessionId);
      if (selectedClassId) params.append("classId", selectedClassId);
      if (promotionStatusFilter !== "all")
        params.append("promotionStatus", promotionStatusFilter);
      if (educationLevelFilter !== "all")
        params.append("educationLevel", educationLevelFilter);

      const response = await fetch(`/api/admin/history?${params.toString()}`);

      if (!response.ok) throw new Error("Failed to fetch history");

      const data = await response.json();
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

  // Calculate stats based on query mode
  const stats = {
    total_records: filteredHistory.length,
    unique_students: new Set(filteredHistory.map((h) => h.student_id)).size,
    unique_classes: new Set(filteredHistory.map((h) => h.class_id)).size,
    promoted_count: filteredHistory.filter((h) => h.promotion_status === "promoted")
      .length,
    graduated_count: filteredHistory.filter((h) => h.promotion_status === "graduated")
      .length,
    repeated_count: filteredHistory.filter((h) => h.promotion_status === "repeated")
      .length,
    average_performance:
      filteredHistory.reduce((sum, h) => sum + h.average_score, 0) /
        filteredHistory.length || 0,
  };

  // Get unique education levels for filter
  const educationLevels = Array.from(
    new Set(classes.map((c) => c.education_level))
  ).filter(Boolean);

  const currentMode = QUERY_MODES.find((m) => m.type === queryMode);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Class History</h1>
            <p className="text-muted-foreground mt-1">
              Track student class memberships and academic progression
            </p>
          </div>
          <Button onClick={handleExport} disabled={filteredHistory.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Query Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              What do you want to know?
            </CardTitle>
            <CardDescription>
              Choose a query type to explore class history data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {QUERY_MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = queryMode === mode.type;

                return (
                  <button
                    key={mode.type}
                    onClick={() => setQueryMode(mode.type)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`h-5 w-5 mt-0.5 ${
                          isSelected ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <div className="flex-1">
                        <p
                          className={`font-semibold ${
                            isSelected ? "text-primary" : ""
                          }`}
                        >
                          {mode.label}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {mode.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Narrow down the results using filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Session</label>
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sessions</SelectItem>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
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
            </div>

            <div className="mt-4">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search by student name, ID, or class..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_records}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unique_students}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promoted</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.promoted_count}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Graduated</CardTitle>
              <GraduationCap className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.graduated_count}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {currentMode && <currentMode.icon className="h-5 w-5" />}
                  {currentMode?.label || "Results"}
                </CardTitle>
                <CardDescription className="mt-1">
                  {currentMode?.description}
                </CardDescription>
              </div>
              <Badge variant="outline">
                {filteredHistory.length} record{filteredHistory.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading history...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No class history records found</p>
                <p className="text-sm mt-2">
                  Try adjusting your filters or process promotions first
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
                      <TableHead className="text-center">Position</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((record) => (
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
                        <TableCell className="text-center">
                          {record.position ? (
                            <span className="font-semibold">
                              {record.position}/{record.total_students}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
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
                        <TableCell>
                          <p className="text-sm text-muted-foreground max-w-xs truncate">
                            {record.promotion_notes || "—"}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Insights Based on Query Mode */}
        {filteredHistory.length > 0 && queryMode === "class_stats" && (
          <Card>
            <CardHeader>
              <CardTitle>Class Size Breakdown</CardTitle>
              <CardDescription>
                Number of students per class in the selected session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(
                  filteredHistory.reduce((acc, record) => {
                    const key = record.class_name;
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([className, count]) => (
                    <div
                      key={className}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <span className="font-medium">{className}</span>
                      <Badge>{count} students</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {filteredHistory.length > 0 && queryMode === "performance" && (
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>
                Average performance across classes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(
                  filteredHistory.reduce((acc, record) => {
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
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <span className="font-medium">{className}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {average >= 60 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-orange-600" />
                          )}
                          <span
                            className={`font-bold ${
                              average >= 60 ? "text-green-600" : "text-orange-600"
                            }`}
                          >
                            {average.toFixed(1)}%
                          </span>
                        </div>
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
