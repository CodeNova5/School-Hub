import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Middleware to check if user is admin
async function checkIsAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true };
}

// GET: Fetch dashboard statistics
export async function GET(req: NextRequest) {
  const permission = await checkIsAdmin();
  if (!permission.authorized) {
    return NextResponse.json(
      { error: permission.error },
      { status: permission.status }
    );
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current session and term
    const { data: currentSession } = await supabase
      .from("sessions")
      .select("*")
      .eq("is_current", true)
      .single();

    const { data: currentTerm } = await supabase
      .from("terms")
      .select("*")
      .eq("is_current", true)
      .single();

    // 1. Total Students
    const { count: totalStudents } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // 2. Active Teachers
    const { count: totalTeachers } = await supabase
      .from("teachers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // 3. Total Classes
    const { count: totalClasses } = await supabase
      .from("classes")
      .select("*", { count: "exact", head: true });

    // 4. Total Subjects
    const { count: totalSubjects } = await supabase
      .from("subjects")
      .select("*", { count: "exact", head: true });

    // 5. Attendance Rate (current term)
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("status")
      .eq("term_id", currentTerm?.id || "");

    const totalAttendance = attendanceData?.length || 0;
    const presentCount =
      attendanceData?.filter((a) => a.status === "present" || a.status === "late")
        .length || 0;
    const attendanceRate =
      totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

    // 6. Class Distribution (students per class)
    const { data: classDistribution } = await supabase
      .from("classes")
      .select(`
        id,
        name,
        level,
        education_level,
        students:students(count)
      `)
      .order("level");

    const classDistributionData = classDistribution?.map((cls) => ({
      name: cls.name,
      value: cls.students?.[0]?.count || 0,
    })) || [];

    // 7. Student Enrollment Trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: enrollmentData } = await supabase
      .from("students")
      .select("created_at")
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("created_at");

    // Group by month
    const enrollmentByMonth: Record<string, number> = {};
    enrollmentData?.forEach((student) => {
      const date = new Date(student.created_at);
      const monthKey = date.toLocaleString("en-US", { month: "short" });
      enrollmentByMonth[monthKey] = (enrollmentByMonth[monthKey] || 0) + 1;
    });

    // Calculate cumulative enrollment
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    const last6Months = [];
    let cumulative = totalStudents || 0;

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const monthName = months[monthIndex];
      const newEnrollments = enrollmentByMonth[monthName] || 0;
      cumulative -= newEnrollments;
      last6Months.push({
        month: monthName,
        students: cumulative + newEnrollments,
        capacity: Math.ceil((cumulative + newEnrollments) * 1.2), // 20% buffer
      });
      cumulative += newEnrollments;
    }

    // 8. Academic Performance by Class (current term)
    const { data: resultsData } = await supabase
      .from("results")
      .select(`
        total,
        student_id,
        students!inner(class_id, classes(name, level))
      `)
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

    // 9. Recent Activities (last 10 events + admissions)
    const { data: recentEvents } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentAdmissions } = await supabase
      .from("admissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentStudents } = await supabase
      .from("students")
      .select("first_name, last_name, created_at, classes(name)")
      .order("created_at", { ascending: false })
      .limit(5);

    // 10. System Status
    const { data: todayAttendance } = await supabase
      .from("attendance")
      .select("status")
      .gte("date", new Date().toISOString().split("T")[0]);

    const absentToday =
      todayAttendance?.filter((a) => a.status === "absent").length || 0;
    const lateToday =
      todayAttendance?.filter((a) => a.status === "late").length || 0;

    // 11. Pending Admissions
    const { count: pendingAdmissions } = await supabase
      .from("admissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // 12. Average Performance (current term)
    const { data: allResults } = await supabase
      .from("results")
      .select("total")
      .eq("term_id", currentTerm?.id || "");

    const totalScores = allResults?.reduce((sum, r) => sum + (r.total || 0), 0) || 0;
    const averagePerformance =
      allResults && allResults.length > 0
        ? Math.round((totalScores / allResults.length) * 10) / 10
        : 0;

    // 13. Pass Rate (students with total >= 50)
    const passCount =
      allResults?.filter((r) => (r.total || 0) >= 50).length || 0;
    const passRate =
      allResults && allResults.length > 0
        ? Math.round((passCount / allResults.length) * 100 * 10) / 10
        : 0;

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
