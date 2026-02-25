import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin (can see all notifications)
    const { data: adminCheck } = await supabase
      .rpc("is_admin");

    if (!adminCheck) {
      return NextResponse.json(
        { error: "Only admins can access debug endpoint" },
        { status: 403 }
      );
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from("notification_logs")
      .select("*", { count: "exact", head: true });

    // Get all notifications
    const { data: allNotifications } = await supabase
      .from("notification_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    // Get notifications by target
    const { data: allUserNotifications } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("target", "all");

    const { data: studentNotifications } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("target", "role")
      .eq("target_value", "student");

    const { data: teacherNotifications } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("target", "role")
      .eq("target_value", "teacher");

    const { data: parentNotifications } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("target", "role")
      .eq("target_value", "parent");

    return NextResponse.json({
      debug: {
        totalNotifications: totalCount,
        recentNotifications: allNotifications,
        breakdown: {
          all: allUserNotifications?.length || 0,
          student: studentNotifications?.length || 0,
          teacher: teacherNotifications?.length || 0,
          parent: parentNotifications?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
