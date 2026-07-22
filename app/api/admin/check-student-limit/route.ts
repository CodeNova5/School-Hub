import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkStudentLimit } from "@/lib/plan-features";
import type { SchoolPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get school_id
    const { data: schoolId } = await supabase.rpc("get_my_school_id");
    if (!schoolId) {
      return NextResponse.json({ error: "Unable to determine school" }, { status: 400 });
    }

    // Get the school's current plan
    const { data: planData } = await supabase
      .rpc("get_school_plan", { p_school_id: schoolId });

    const plan = (planData as SchoolPlan) || "basic";

    // Count active students
    const { count: activeStudentCount, error: countError } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active");

    if (countError) {
      console.error("Failed to count students:", countError);
      return NextResponse.json({ error: "Failed to count students" }, { status: 500 });
    }

    const limitCheck = checkStudentLimit(plan, activeStudentCount ?? 0);

    return NextResponse.json({
      plan,
      active_student_count: activeStudentCount ?? 0,
      student_limit: limitCheck.limit,
      remaining: limitCheck.remaining,
      allowed: limitCheck.allowed,
      message: limitCheck.message ?? null,
    });
  } catch (err: any) {
    console.error("Check student limit error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
