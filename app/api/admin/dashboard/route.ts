import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

// GET: Fetch dashboard statistics
export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const schoolId = permission.schoolId;

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current session and term (filtered by school)
    const { data: currentSession } = await supabase
      .from("sessions")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .single();

    const { data: currentTerm } = await supabase
      .from("terms")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .single();

    // 1. Total Students (filtered by school)
    const { count: totalStudents } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active");

    // 2. Active Teachers (filtered by school)
    const { count: totalTeachers } = await supabase
      .from("teachers")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active");

    // 3. Total Classes (filtered by school)
    const { count: totalClasses } = await supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId);

    // 4. Total Subjects (filtered by school)
    const { count: totalSubjects } = await supabase
      .from("subjects")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId);

    // 5. Attendance Rate (current term, filtered by school)
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .eq("term_id", currentTerm?.id || "");

    const totalAttendance = attendanceData?.length || 0;
    const presentCount =
      attendanceData?.filter((a) => a.status === "present" || a.status === "late")
        .length || 0;
    const attendanceRate =
      totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

    // 6. Class Distribution (students per class, filtered by school)
    const { data: classDistribution } = await supabase
      .from("classes")
      .select(`
        id,
        name,
        level,
        education_level,
        students:students(count)
      `)
      .eq("school_id", schoolId)
      .order("level");

    const classDistributionData = classDistribution?.map((cls) => ({
      name: cls.name,
      value: cls.students?.[0]?.count || 0,
    })) || [];

    // 7. Student Enrollment Trend (last 6 months from student created_at, filtered by school)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1); // Start from first day of month

    const { data: enrollmentData } = await supabase
      .from("students")
      .select("created_at")
      .eq("school_id", schoolId)
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("created_at");

    // Generate last 6 months
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const today = new Date();
    const last6Months = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      date.setDate(1);
      
      const monthName = months[date.getMonth()];
      const monthStart = new Date(date);
      const monthEnd = new Date(date);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      // Count students created up to end of this month
      const cumulativeCount = enrollmentData?.filter(student => {
        const studentDate = new Date(student.created_at);
        return studentDate < monthEnd;
      }).length || 0;
      
      last6Months.push({
        month: monthName,
        students: cumulativeCount,
      });
    }

    // 8. Academic Performance by Class (current term, filtered by school)
    const { data: resultsData } = await supabase
      .from("results")
      .select(`
        total,
        student_id,
        students!inner(class_id, classes(name, level))
      `)
      .eq("school_id", schoolId)
      .eq("term_id", currentTerm?.id || "");

    // Group by class and calculate averages
    const performanceByClass: Record<string, { total: number; count: number }> = {};
    resultsData?.forEach((result: any) => {
      const className = result.students?.classes?.name || "Unknown";
      if (!performanceByClass[className]) {
        performanceByClass[className] = { total: 0, count: 0 };
      }
      performanceByClass[className].total += result.total || 0;
      performanceByClass[className].count += 1;
    });

    const performanceData = Object.entries(performanceByClass).map(
      ([className, data]) => ({
        class: className,
        average: Math.round(data.total / data.count),
        target: 80, // Default target
      })
    );

    // 9. Recent Activities (last 10 events + admissions, filtered by school)
    const { data: recentEvents } = await supabase
      .from("events")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentAdmissions } = await supabase
      .from("admissions")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentStudents } = await supabase
      .from("students")
      .select("first_name, last_name, created_at, classes(name)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5);

    // 10. System Status (filtered by school)
    const { data: todayAttendance } = await supabase
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .gte("date", new Date().toISOString().split("T")[0]);

    const absentToday =
      todayAttendance?.filter((a) => a.status === "absent").length || 0;
    const lateToday =
      todayAttendance?.filter((a) => a.status === "late").length || 0;

    // 11. Pending Admissions (filtered by school)
    const { count: pendingAdmissions } = await supabase
      .from("admissions")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "pending");

    // 12. Average Performance (current term, filtered by school)
    const { data: allResults } = await supabase
      .from("results")
      .select("total")
      .eq("school_id", schoolId)
      .eq("term_id", currentTerm?.id || "");

    const totalScores = allResults?.reduce((sum, r) => sum + (r.total || 0), 0) || 0;
    const averagePerformance =
      allResults && allResults.length > 0
        ? Math.round((totalScores / allResults.length) * 10) / 10
        : 0;

    // 13. Pass Rate (students with total >= 50, filtered by school)
    const passCount =
      allResults?.filter((r) => (r.total || 0) >= 50).length || 0;
    const passRate =
      allResults && allResults.length > 0
        ? Math.round((passCount / allResults.length) * 100 * 10) / 10
        : 0;

    return successResponse({
      stats: {
        totalStudents: totalStudents || 0,
        totalTeachers: totalTeachers || 0,
        totalClasses: totalClasses || 0,
        totalSubjects: totalSubjects || 0,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        averagePerformance,
        passRate,
        pendingAdmissions: pendingAdmissions || 0,
      },
      classDistribution: classDistributionData,
      enrollmentTrend: last6Months,
      performanceByClass: performanceData,
      recentActivities: {
        events: recentEvents || [],
        admissions: recentAdmissions || [],
        students: recentStudents || [],
      },
      systemStatus: {
        absentToday,
        lateToday,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
      },
      currentSession,
      currentTerm,
    });
  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return errorResponse(error.message || "Failed to fetch dashboard data", 500);
  }
}
