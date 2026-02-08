import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Get class history with various filters
export async function GET(request: NextRequest) {
  try {
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
    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    if (classId) {
      query = query.eq("class_id", classId);
    }

    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    if (promotionStatus) {
      query = query.eq("promotion_status", promotionStatus);
    }

    if (educationLevel) {
      query = query.eq("education_level", educationLevel);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get related data for enrichment
    const sessionIds = Array.from(new Set(data?.map((h) => h.session_id) || []));
    const { data: sessions } = await supabase
      .from("sessions")
      .select("*")
      .in("id", sessionIds);

    // Enrich history data
    const enrichedData = data?.map((history) => ({
      ...history,
      session_name: sessions?.find((s) => s.id === history.session_id)?.name || "",
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
