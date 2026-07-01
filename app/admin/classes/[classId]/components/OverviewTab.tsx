"use client";

import { useEffect, useMemo, useState } from "react";
import { useSchoolContext } from "@/hooks/use-school-context";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  BookOpen,
  UserPlus,
  CalendarCheck,
  GraduationCap,
  MapPin,
  Building2,
  Hash,
  User,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  School,
  ArrowUpRight,
  Calendar,
  Clock,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type ClassData = {
  id: string;
  school_id: string;
  name: string;
  class_level_id: string;
  stream_id: string | null;
  department_id: string | null;
  room_number: string | null;
  class_teacher_id: string | null;
  session_id: string | null;
  academic_year: string | null;
  created_at: string;
  updated_at: string;
  school_class_levels?: {
    id: string;
    name: string;
    code: string | null;
    school_education_levels?: {
      id: string;
      name: string;
      code: string | null;
    };
  };
};

type SubjectClass = {
  id: string;
  subject_code: string;
  subject_id: string;
  subject: { id: string; name: string; is_optional: boolean };
  teacher: { id: string; first_name: string; last_name: string } | null;
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  student_id: string;
  email?: string;
};

type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
};

interface OverviewTabProps {
  classData: ClassData;
  students: Student[];
  subjects: SubjectClass[];
  teachers: Teacher[];
  schoolId: string | null;
  classId: string;
  className: string;
  availableStudents: Student[];
  onAddStudents: (studentIds: string[]) => void;
}

export function OverviewTab({
  classData,
  students,
  subjects,
  teachers,
  schoolId,
  classId,
  className,
  availableStudents,
  onAddStudents,
}: OverviewTabProps) {
  // ── Attendance Snapshot ──
  const [todayAttendance, setTodayAttendance] = useState<{
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // ── 7-Day Attendance Trend ──
  const [attendanceTrend, setAttendanceTrend] = useState<
    Array<{ date: string; fullDate: string; rate: number | null; present: number; total: number }>
  >([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // ── Performance Snapshot ──
  const [performanceData, setPerformanceData] = useState<{
    classAverage: number;
    totalWithResults: number;
    highestAverage: number;
    lowestAverage: number;
    gradeDistribution: Record<string, number>;
    topPerformers: Array<{ name: string; average: number }>;
  } | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // Find class teacher
  const classTeacher = teachers.find((t) => t.id === classData.class_teacher_id);

  // Gender distribution
  const maleCount = students.filter((s) => s.gender?.toLowerCase() === "male").length;
  const femaleCount = students.filter((s) => s.gender?.toLowerCase() === "female").length;
  const totalStudents = students.length;

  // Subjects statistics
  const subjectsWithTeacher = subjects.filter((s) => s.teacher !== null).length;
  const subjectsWithoutTeacher = subjects.filter((s) => s.teacher === null).length;
  const totalSubjects = subjects.length;

  // ── Fetch today's attendance ──
  useEffect(() => {
    if (schoolId && classId) {
      fetchTodayAttendance();
      fetchAttendanceTrend();
      fetchPerformanceSnapshot();
    }
  }, [schoolId, classId]);

  async function fetchTodayAttendance() {
    if (!schoolId) return;
    setAttendanceLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("attendance")
        .select("status")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("date", today);

      if (error) throw error;

      const records = data || [];
      setTodayAttendance({
        present: records.filter((r: any) => r.status === "present").length,
        absent: records.filter((r: any) => r.status === "absent").length,
        late: records.filter((r: any) => r.status === "late").length,
        excused: records.filter((r: any) => r.status === "excused").length,
        total: records.length,
      });
    } catch (error) {
      console.warn("Failed to fetch today's attendance:", error);
      setTodayAttendance(null);
    } finally {
      setAttendanceLoading(false);
    }
  }

  // ── Fetch 7-day attendance trend ──
  async function fetchAttendanceTrend() {
    if (!schoolId) return;
    setTrendLoading(true);
    try {
      const dates: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }

      const { data, error } = await supabase
        .from("attendance")
        .select("date, status")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .gte("date", dates[0])
        .lte("date", dates[6]);

      if (error) throw error;

      const records = data || [];

      const trend = dates.map((date) => {
        const dayRecords = records.filter((r: any) => r.date === date);
        const total = dayRecords.length;
        const present = dayRecords.filter(
          (r: any) => r.status === "present" || r.status === "late"
        ).length;
        const rate = total > 0 ? Math.round((present / total) * 100) : null;

        // Format date for display
        const d = new Date(date + "T00:00:00");
        const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
        const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        return {
          date: dayName,
          fullDate: monthDay,
          rate,
          present,
          total,
        };
      });

      setAttendanceTrend(trend);
    } catch (error) {
      console.warn("Failed to fetch attendance trend:", error);
      setAttendanceTrend([]);
    } finally {
      setTrendLoading(false);
    }
  }

  // ── Fetch performance snapshot ──
  async function fetchPerformanceSnapshot() {
    if (!schoolId) return;
    setPerformanceLoading(true);
    try {
      // Get current session and term
      const [{ data: sessions }, { data: terms }] = await Promise.all([
        supabase.from("sessions").select("id").eq("school_id", schoolId).eq("is_current", true).single(),
        supabase.from("terms").select("id, name").eq("school_id", schoolId).eq("is_current", true).single(),
      ]);

      if (!sessions?.id || !terms?.id) {
        setPerformanceLoading(false);
        return;
      }

      const currentStudentIds = students.map((s) => s.id);
      if (currentStudentIds.length === 0) {
        setPerformanceLoading(false);
        return;
      }

      // Get subject_classes for this class
      const { data: subjectClasses } = await supabase
        .from("subject_classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_id", classId);

      const subjectClassIds = subjectClasses?.map((sc: any) => sc.id) || [];
      if (subjectClassIds.length === 0) {
        setPerformanceLoading(false);
        return;
      }

      // Fetch results
      const { data: resultsData } = await supabase
        .from("results")
        .select("student_id, total, grade")
        .eq("term_id", terms.id)
        .eq("session_id", sessions.id)
        .in("student_id", currentStudentIds)
        .in("subject_class_id", subjectClassIds);

      if (!resultsData || resultsData.length === 0) {
        setPerformanceLoading(false);
        return;
      }

      // Group by student
      const studentMap = new Map<string, { total: number; count: number }>();
      const gradeCount: Record<string, number> = { A1: 0, B2: 0, B3: 0, C4: 0, C5: 0, C6: 0, D7: 0, E8: 0, F9: 0 };

      resultsData.forEach((r: any) => {
        if (!studentMap.has(r.student_id)) {
          studentMap.set(r.student_id, { total: 0, count: 0 });
        }
        const entry = studentMap.get(r.student_id)!;
        entry.total += r.total || 0;
        entry.count += 1;

        if (r.grade && gradeCount[r.grade.toUpperCase()] !== undefined) {
          gradeCount[r.grade.toUpperCase()]++;
        }
      });

      const studentAverages = Array.from(studentMap.entries()).map(([id, data]) => ({
        studentId: id,
        average: data.count > 0 ? data.total / data.count : 0,
      }));

      const sorted = studentAverages.sort((a, b) => b.average - a.average);

      const totalAverage =
        sorted.reduce((sum, s) => sum + s.average, 0) / sorted.length;

      // Top 3 performers
      const topPerformers = sorted.slice(0, 3).map((s) => {
        const student = students.find((st) => st.id === s.studentId);
        return {
          name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
          average: s.average,
        };
      });

      setPerformanceData({
        classAverage: totalAverage,
        totalWithResults: sorted.length,
        highestAverage: sorted.length > 0 ? sorted[0].average : 0,
        lowestAverage: sorted.length > 0 ? sorted[sorted.length - 1].average : 0,
        gradeDistribution: gradeCount,
        topPerformers,
      });
    } catch (error) {
      console.warn("Failed to fetch performance snapshot:", error);
    } finally {
      setPerformanceLoading(false);
    }
  }

  // ── Quick Add Student Modal ──
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [addStudentSearch, setAddStudentSearch] = useState("");

  const filteredAvailableStudents = useMemo(() => {
    return availableStudents.filter((s) => {
      if (!addStudentSearch) return true;
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      return (
        fullName.includes(addStudentSearch.toLowerCase()) ||
        s.student_id.toLowerCase().includes(addStudentSearch.toLowerCase())
      );
    });
  }, [availableStudents, addStudentSearch]);

  function handleToggleSelectStudent(studentId: string) {
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  }

  function handleAddStudents() {
    if (selectedStudentIds.size === 0) return;
    onAddStudents(Array.from(selectedStudentIds));
    setSelectedStudentIds(new Set());
    setAddStudentSearch("");
    setIsAddStudentOpen(false);
  }

  function handleCloseAddStudent() {
    setIsAddStudentOpen(false);
    setSelectedStudentIds(new Set());
    setAddStudentSearch("");
  }

  // ── Helpers ──
  function getPerformanceIndicator(average: number) {
    if (average >= 70) return { icon: TrendingUp, color: "text-green-600", label: "Excellent" };
    if (average >= 60) return { icon: TrendingUp, color: "text-blue-600", label: "Good" };
    if (average >= 50) return { icon: Minus, color: "text-yellow-600", label: "Average" };
    return { icon: TrendingDown, color: "text-red-600", label: "Needs Improvement" };
  }

  const attendanceRate =
    todayAttendance && todayAttendance.total > 0
      ? Math.round(
          ((todayAttendance.present + todayAttendance.late) / todayAttendance.total) * 100
        )
      : null;

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: Class Info & Teacher ── */}
      <Card className="overflow-hidden border-slate-200">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2" />
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Class Name & Level */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <GraduationCap className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-500">Class Details</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{classData.name}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {classData.school_class_levels?.school_education_levels && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0">
                      {classData.school_class_levels.school_education_levels.name}
                    </Badge>
                  )}
                  {classData.school_class_levels && (
                    <Badge variant="outline" className="border-slate-300 text-slate-700">
                      {classData.school_class_levels.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg">
                  <MapPin className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-500">Location & Period</span>
              </div>
              <div className="space-y-2">
                {classData.room_number && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                    <span>Room: <strong>{classData.room_number}</strong></span>
                  </div>
                )}
                {classData.academic_year && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Academic Year: <strong>{classData.academic_year}</strong></span>
                  </div>
                )}
                {classData.stream_id && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span>Stream: <strong>Stream assigned</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Class Teacher */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg">
                  <User className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-slate-500">Class Teacher</span>
              </div>
              <div>
                {classTeacher ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                      {classTeacher.first_name[0]}{classTeacher.last_name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {classTeacher.first_name} {classTeacher.last_name}
                      </p>
                      <p className="text-xs text-slate-500">Assigned as Class Teacher</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    <UserPlus className="h-4 w-4" />
                    <span>No class teacher assigned</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Add Student Button */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{totalStudents}</span> student{totalStudents !== 1 ? "s" : ""} enrolled
                {availableStudents.length > 0 && (
                  <span className="text-slate-400"> &middot; {availableStudents.length} unassigned available</span>
                )}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddStudentOpen(true)}
              disabled={availableStudents.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Quick Add Student
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 2: Key Stats Grid ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          icon={Users}
          color="blue"
          subtitle={`${maleCount}M / ${femaleCount}F`}
        />
        <StatCard
          title="Subjects"
          value={totalSubjects}
          icon={BookOpen}
          color="purple"
          subtitle={`${subjectsWithTeacher} with teacher`}
        />
        <StatCard
          title="Teachers"
          value={teachers.length}
          icon={UserPlus}
          color="emerald"
          subtitle={`${subjectsWithoutTeacher} subjects unassigned`}
        />
        <StatCard
          title="Attendance Rate"
          value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
          icon={CalendarCheck}
          color="orange"
          subtitle={todayAttendance ? `Today: ${todayAttendance.present + todayAttendance.late}/${todayAttendance.total}` : "No records today"}
        />
      </div>

      {/* ── SECTION 3: Gender Distribution + Today's Attendance ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gender Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              Gender Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalStudents > 0 ? (
              <div className="space-y-4">
                {/* Visual Bar */}
                <div className="relative h-8 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                    style={{ width: `${(maleCount / totalStudents) * 100}%` }}
                  >
                    {maleCount > 0 && maleCount / totalStudents > 0.15 && (
                      <span className="text-xs font-bold text-white">{maleCount}</span>
                    )}
                  </div>
                  <div
                    className="absolute inset-y-0 right-0 bg-rose-400 rounded-full transition-all duration-500 ease-out flex items-center pl-2"
                    style={{ width: `${(femaleCount / totalStudents) * 100}%` }}
                  >
                    {femaleCount > 0 && femaleCount / totalStudents > 0.15 && (
                      <span className="text-xs font-bold text-white">{femaleCount}</span>
                    )}
                  </div>
                </div>

                {/* Labels */}
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="font-medium text-slate-700">Male</span>
                    <span className="text-slate-500">
                      {maleCount} ({totalStudents > 0 ? Math.round((maleCount / totalStudents) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="font-medium text-slate-700">Female</span>
                    <span className="text-slate-500">
                      {femaleCount} ({totalStudents > 0 ? Math.round((femaleCount / totalStudents) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm">No students in this class</div>
            )}
          </CardContent>
        </Card>

        {/* Today's Attendance Snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-slate-500" />
              Today&apos;s Attendance
              <span className="text-xs font-normal text-slate-400 ml-auto">
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : todayAttendance ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <AttendanceStat label="Present" count={todayAttendance.present} color="green" />
                  <AttendanceStat label="Absent" count={todayAttendance.absent} color="red" />
                  <AttendanceStat label="Late" count={todayAttendance.late} color="yellow" />
                  <AttendanceStat label="Excused" count={todayAttendance.excused} color="blue" />
                </div>
                {attendanceRate !== null && (
                  <div className="mt-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Attendance Rate</span>
                      <span className={`text-lg font-bold ${
                        attendanceRate >= 90 ? "text-green-600" : attendanceRate >= 75 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {attendanceRate}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          attendanceRate >= 90 ? "bg-green-500" : attendanceRate >= 75 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-slate-400 text-sm">No attendance records for today</p>
                <p className="text-xs text-slate-300 mt-1">Mark attendance in the Attendance tab</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── SECTION 4: 7-Day Attendance Trend ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            7-Day Attendance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : attendanceTrend.some((d) => d.total > 0) ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={attendanceTrend}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-semibold text-slate-900 mb-1">
                            {data.fullDate || label}
                          </p>
                          <p className="text-blue-600 font-medium">
                            Rate: {data.rate}%
                          </p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {data.present}/{data.total} present
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Mini stats row */}
              <div className="grid grid-cols-7 gap-1">
                {attendanceTrend.map((day, idx) => {
                  const isToday = idx === attendanceTrend.length - 1;
                  return (
                    <div
                      key={idx}
                      className={`text-center p-2 rounded-lg ${
                        isToday ? "bg-blue-50 ring-1 ring-blue-200" : ""
                      }`}
                    >
                      <p className="text-xs text-slate-500 font-medium">{day.date}</p>
                      <p
                        className={`text-sm font-bold mt-0.5 ${
                          day.total === 0 || day.rate === null
                            ? "text-slate-300"
                            : day.rate >= 90
                            ? "text-green-600"
                            : day.rate >= 75
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {day.total > 0 && day.rate !== null ? `${day.rate}%` : "—"}
                      </p>
                      {day.total > 0 && (
                        <p className="text-[10px] text-slate-400">
                          {day.present}/{day.total}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Weekly average */}
              {(() => {
                const daysWithData = attendanceTrend.filter((d): d is typeof d & { rate: number } => d.total > 0 && d.rate !== null);
                if (daysWithData.length === 0) return null;
                const avg =
                  daysWithData.reduce((sum, d) => sum + d.rate, 0) /
                  daysWithData.length;
                return (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Weekly Average ({daysWithData.length} days with data)
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        avg >= 90
                          ? "text-green-600"
                          : avg >= 75
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {Math.round(avg)}%
                    </span>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No attendance data this week</p>
              <p className="text-sm text-slate-400 mt-1">
                Start marking attendance to see trends
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 5: Performance Snapshot ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            Performance Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {performanceLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : performanceData && performanceData.totalWithResults > 0 ? (
            <div className="space-y-5">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Class Average</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {performanceData.classAverage.toFixed(1)}%
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {(() => {
                      const perf = getPerformanceIndicator(performanceData.classAverage);
                      const Icon = perf.icon;
                      return (
                        <>
                          <Icon className={`h-3 w-3 ${perf.color}`} />
                          <span className={`text-xs ${perf.color}`}>{perf.label}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Highest Avg</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {performanceData.highestAverage.toFixed(1)}%
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">Top performer</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                  <p className="text-xs font-medium text-orange-600 uppercase tracking-wider">Lowest Avg</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {performanceData.lowestAverage.toFixed(1)}%
                  </p>
                  <p className="text-xs text-orange-600 mt-1">Needs support</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                  <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">With Results</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">
                    {performanceData.totalWithResults}/{totalStudents}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">Students assessed</p>
                </div>
              </div>

              {/* Top Performers */}
              {performanceData.topPerformers.length > 0 && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
                  <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
                    <GraduationCap className="h-4 w-4" />
                    Top Performers
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {performanceData.topPerformers.map((performer, idx) => (
                      <div
                        key={performer.name}
                        className="flex items-center gap-3 bg-white rounded-lg p-3 shadow-sm border border-amber-100"
                      >
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                          idx === 0
                            ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                            : idx === 1
                            ? "bg-gradient-to-br from-gray-300 to-gray-500"
                            : "bg-gradient-to-br from-amber-500 to-amber-700"
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{performer.name}</p>
                          <p className="text-xs text-slate-500">{performer.average.toFixed(1)}% average</p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-green-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grade Distribution */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3">Grade Distribution</h4>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Bar Chart */}
                  <div className="lg:col-span-3">
                    {(() => {
                      const gradeOrder = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];
                      const chartData = gradeOrder.map((grade) => ({
                        grade,
                        count: performanceData.gradeDistribution[grade] || 0,
                      }));
                      const maxCount = Math.max(...chartData.map((d) => d.count), 1);

                      const gradeToBarColor = (grade: string) => {
                        const prefix = grade.charAt(0);
                        switch (prefix) {
                          case "A": return "#22c55e"; // green-500
                          case "B": return "#3b82f6"; // blue-500
                          case "C": return "#eab308"; // yellow-500
                          case "D": return "#f97316"; // orange-500
                          case "E": return "#f97316"; // orange-500
                          default: return "#ef4444";  // red-500
                        }
                      };

                      return (
                        <div className="bg-white rounded-lg p-2">
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                              <XAxis
                                dataKey="grade"
                                tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
                                axisLine={{ stroke: "#e2e8f0" }}
                                tickLine={false}
                              />
                              <YAxis
                                allowDecimals={false}
                                domain={[0, maxCount + 1]}
                                tick={{ fontSize: 11, fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const data = payload[0].payload;
                                  const total = Object.values(performanceData.gradeDistribution).reduce((a, b) => a + b, 0);
                                  const pct = total > 0 ? ((data.count / total) * 100).toFixed(1) : "0";
                                  return (
                                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                                      <p className="font-semibold text-slate-900">Grade {data.grade}</p>
                                      <p className="text-blue-600 font-medium mt-1">{data.count} student{data.count !== 1 ? "s" : ""}</p>
                                      <p className="text-slate-500 text-xs mt-0.5">{pct}% of class</p>
                                    </div>
                                  );
                                }}
                              />
                              <Bar
                                dataKey="count"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={40}
                              >
                                {chartData.map((entry, idx) => (
                                  <Cell key={idx} fill={gradeToBarColor(entry.grade)} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Summary legend */}
                  <div className="lg:col-span-2 space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Summary</p>
                    {(() => {
                      const total = Object.values(performanceData.gradeDistribution).reduce((a, b) => a + b, 0);
                      const gradeOrder = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];
                      const passGrades = ["A1", "B2", "B3", "C4", "C5", "C6"];
                      const passCount = passGrades.reduce((sum, g) => sum + (performanceData.gradeDistribution[g] || 0), 0);
                      const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
                      const maxCount = Math.max(...gradeOrder.map((g) => performanceData.gradeDistribution[g] || 0));
                      const mostCommonGrade = gradeOrder.find((g) => (performanceData.gradeDistribution[g] || 0) === maxCount) || "—";

                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2.5 bg-green-50 rounded-lg border border-green-200">
                            <span className="text-sm text-green-700">Pass Rate (A1-C6)</span>
                            <span className="text-lg font-bold text-green-700">{passRate}%</span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                            <span className="text-sm text-blue-700">Most Common Grade</span>
                            <span className="text-lg font-bold text-blue-700">{mostCommonGrade}</span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                            <span className="text-sm text-purple-700">Total Grade Entries</span>
                            <span className="text-lg font-bold text-purple-700">{total}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No results data yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Enter results in the Results tab to see performance analytics
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── QUICK ADD STUDENT DIALOG ── */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Add Students to {className}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select unassigned students to add to this class. Their previous results and subject assignments will be cleared.
            </p>

            {/* Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search students by name or ID..."
                className="pl-9"
                value={addStudentSearch}
                onChange={(e) => setAddStudentSearch(e.target.value)}
              />
            </div>

            {filteredAvailableStudents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {availableStudents.length === 0
                  ? "No unassigned students available."
                  : "No students match your search."}
              </div>
            ) : (
              <div className="border rounded-md">
                <div className="max-h-72 overflow-y-auto">
                  {filteredAvailableStudents.map((student) => {
                    const isSelected = selectedStudentIds.has(student.id);
                    return (
                      <div
                        key={student.id}
                        className={`flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                        onClick={() => handleToggleSelectStudent(student.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(student.id)}
                          className="cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {student.student_id} &middot; {student.email || "No email"}
                          </p>
                        </div>
                        {student.gender && (
                          <Badge variant="outline" className="capitalize text-xs">
                            {student.gender}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedStudentIds.size > 0
                  ? `${selectedStudentIds.size} student(s) selected`
                  : "Select students to add"}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCloseAddStudent}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddStudents}
                  disabled={selectedStudentIds.size === 0}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Add {selectedStudentIds.size > 0 && `(${selectedStudentIds.size})`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({
  title,
  value,
  icon: Icon,
  color = "blue",
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: any;
  color?: "blue" | "purple" | "emerald" | "orange" | "rose";
  subtitle?: string;
}) {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
    orange: "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100",
    rose: "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100",
  };

  const iconBg = {
    blue: "bg-blue-100",
    purple: "bg-purple-100",
    emerald: "bg-emerald-100",
    orange: "bg-orange-100",
    rose: "bg-rose-100",
  };

  return (
    <Card className={`border-2 transition-all duration-200 hover:shadow-md cursor-default ${colorStyles[color]}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-lg ${iconBg[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "green" | "red" | "yellow" | "blue";
}) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-xl font-bold mt-0.5">{count}</p>
    </div>
  );
}
