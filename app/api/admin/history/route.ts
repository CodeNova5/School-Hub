import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const supabase = createRouteHandlerClient({ cookies });

// Middleware to check if user is admin
async function checkIsAdmin() {
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

// GET - Get class history with various filters
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const authCheck = await checkIsAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error || "Unauthorized" },
        { status: authCheck.status || 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");
    const classId = searchParams.get("classId");
    const studentId = searchParams.get("studentId");
    const promotionStatus = searchParams.get("promotionStatus");
    const educationLevel = searchParams.get("educationLevel");

    let query = supabase
      .from("class_history")
      .select("*")
      .order("recorded_at", { ascending: false });

    // Apply filters
    if (sessionId && sessionId !== "all") {
      query = query.eq("session_id", sessionId);
    }

    if (classId && classId !== "all") {
      query = query.eq("class_id", classId);
    }

    if (studentId && studentId !== "all") {
      query = query.eq("student_id", studentId);
    }

    if (promotionStatus && promotionStatus !== "all") {
      query = query.eq("promotion_status", promotionStatus);
    }

    if (educationLevel && educationLevel !== "all") {
      query = query.eq("education_level", educationLevel);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching class history:", error);
      throw error;
    }

    console.log("Fetched class history records:", data?.length || 0);

    // Get related data for enrichment
    const sessionIds = Array.from(new Set(data?.map((h) => h.session_id) || [])).filter(Boolean);
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("*")
      .in("id", sessionIds);

    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
    }

    // Enrich history data
    const enrichedData = data?.map((history) => ({
      ...history,
      session_name: sessions?.find((s) => s.id === history.session_id)?.name || "Unknown",
    }));

    return NextResponse.json({
      success: true,
      history: enrichedData || [],
      total_records: enrichedData?.length || 0,
    });
  } catch (error: any) {
    console.error("Error fetching class history:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch class history" },
      { status: 500 }
    );
  }
}
