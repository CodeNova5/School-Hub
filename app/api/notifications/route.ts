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

    const role = request.nextUrl.searchParams.get("role") as
      | "student"
      | "teacher"
      | "parent"
      | null;

    if (!role || !["student", "teacher", "parent"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid or missing role parameter" },
        { status: 400 }
      );
    }

    // Validate user has the requested role
    let userHasRole = false;

    if (role === "student") {
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      userHasRole = !!student;
    } else if (role === "teacher") {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      userHasRole = !!teacher;
    } else if (role === "parent") {
      const { data: parent } = await supabase
        .from("parents")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      userHasRole = !!parent;
    }

    if (!userHasRole) {
      return NextResponse.json(
        { error: "User does not have this role" },
        { status: 403 }
      );
    }

    // Fetch recent notifications for this role
    // A user sees notifications if:
    // 1. target = 'all' (sent to all users)
    // 2. target = 'role' AND target_value matches their role
    
    // First, get notifications sent to all users
    const { data: allUserNotifications, error: allUsersError } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("target", "all")
      .order("created_at", { ascending: false })
      .limit(50);

    if (allUsersError) {
      console.error("Error fetching all-user notifications:", allUsersError);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    // Then, get role-specific notifications
    const { data: roleNotifications, error: roleError } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("target", "role")
      .eq("target_value", role)
      .order("created_at", { ascending: false })
      .limit(50);

    if (roleError) {
      console.error("Error fetching role notifications:", roleError);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    // Combine and deduplicate by ID, keeping the most recent
    const notificationMap = new Map();
    
    [...(allUserNotifications || []), ...(roleNotifications || [])].forEach((n) => {
      if (!notificationMap.has(n.id)) {
        notificationMap.set(n.id, n);
      }
    });

    const notifications = Array.from(notificationMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = notifications.filter(
      (n) => new Date(n.created_at) >= today
    ).length;

    // Get the last 7 days of data for trend
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      return date;
    }).reverse();

    const notificationTrend = last7Days.map((date) => {
      const count = notifications.filter((n) => {
        const nDate = new Date(n.created_at);
        nDate.setHours(0, 0, 0, 0);
        return nDate.getTime() === date.getTime();
      }).length;

      return {
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        received: count,
      };
    });

    // Format the response
    const recentNotifications = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      imageUrl: n.image_url,
      link: n.link,
      target: n.target,
      targetValue: n.target_value,
      createdAt: n.created_at,
      sentBy: n.sent_by,
    }));

    return NextResponse.json({
      data: {
        totalReceived: notifications.length,
        todayCount,
        recentNotifications: recentNotifications.slice(0, 10),
        notificationTrend,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
