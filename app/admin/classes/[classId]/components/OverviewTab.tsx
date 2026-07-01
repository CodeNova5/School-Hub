"use client";

import { useEffect, useState } from "react";
import { useSchoolContext } from "@/hooks/use-school-context";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

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
}

export function OverviewTab({
  classData,
  students,
  subjects,
  teachers,
  schoolId,
  classId,
  className,
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

  // ── Helpers ──
  function getGradeColor(grade: string) {
    const prefix = grade.charAt(0);
    switch (prefix) {
      case "A": return "bg-green-100 text-green-800 border-green-200";
      case "B": return "bg-blue-100 text-blue-800 border-blue-200";
      case "C": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "D": return "bg-orange-100 text-orange-800 border-orange-200";
      case "E": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-red-100 text-red-800 border-red-200";
    }
  }

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

      {/* ── SECTION 4: Performance Snapshot ── */}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {Object.entries(performanceData.gradeDistribution).map(([grade, count]) => {
                    const total = Object.values(performanceData.gradeDistribution).reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div
                        key={grade}
                        className={`p-3 rounded-lg border text-center ${getGradeColor(grade)}`}
                      >
                        <p className="text-lg font-bold">{grade}</p>
                        <p className="text-xs mt-0.5 opacity-75">{count} ({percentage.toFixed(0)}%)</p>
                      </div>
                    );
                  })}
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
