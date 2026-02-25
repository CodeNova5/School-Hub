import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
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

    // Fetch recent notifications for this role
    // A user sees notifications if:
    // 1. target = 'all' (sent to all users)
    // 2. target = 'role' AND target_value matches their role
    const { data: notifications, error } = await supabase
      .from("notification_logs")
      .select("*")
      .or(
        `and(target.eq.all),and(target.eq.role,target_value.eq.${role})`,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

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
