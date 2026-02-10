import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

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

async function requireAdmin() {
  const check = await checkIsAdmin();
  if (!check.authorized) {
    throw new Error(check.error || "Unauthorized");
  }
}


// GET - Get promotion eligibility for a session
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

    // Get promotion settings for this session
    const { data: settings, error: settingsError } = await supabase
      .from("promotion_settings")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (settingsError && settingsError.code !== "PGRST116") {
      throw settingsError;
    }

    const promotionSettings = settings || {
      minimum_pass_percentage: 40,
      require_all_terms: false,
      auto_promote: true,
    };

    // Get all students with their current class info
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select(
        `
        id,
        student_id,
        first_name,
        last_name,
        status,
        class_id,
        department,
        classes:class_id (
          id,
          name,
          level,
          stream,
          education_level,
          department
        )
      `
      )
      .in("status", ["active", "pending", "graduated", "withdrawn"]);

    if (studentsError) throw studentsError;

    // Get all terms for this session
    const { data: terms, error: termsError } = await supabase
      .from("terms")
      .select("*")
      .eq("session_id", sessionId)
      .order("name");

    if (termsError) throw termsError;

    // Get all results for this session
    const studentIds = students?.map((s) => s.id) || [];
    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select("*")
      .eq("session_id", sessionId)
      .in("student_id", studentIds);

    if (resultsError) throw resultsError;

    // Calculate eligibility for each student
    const eligibilityData = students?.map((student) => {
      const studentResults = results?.filter(
        (r) => r.student_id === student.id
      ) || [];

      // Group by term
      const termResults = new Map();
      studentResults.forEach((result) => {
        if (!termResults.has(result.term_id)) {
          termResults.set(result.term_id, []);
        }
        termResults.get(result.term_id).push(result);
      });

      // Calculate term averages
      const termAverages: { term_id: string; average: number }[] = [];
      let totalAverage = 0;
      let termsWithResults = 0;

      terms?.forEach((term) => {
        const termData = termResults.get(term.id);
        if (termData && termData.length > 0) {
          const avg =
            termData.reduce((sum: number, r: any) => sum + (r.total || 0), 0) /
            termData.length;
          termAverages.push({ term_id: term.id, average: avg });
          totalAverage += avg;
          termsWithResults++;
        } else {
          termAverages.push({ term_id: term.id, average: 0 });
        }
      });

      const cumulativeAverage =
        termsWithResults > 0 ? totalAverage / termsWithResults : 0;

      // Determine eligibility
      const hasRequiredTerms = promotionSettings.require_all_terms
        ? termsWithResults === terms?.length
        : termsWithResults > 0;

      const meetsPassMark =
        cumulativeAverage >= promotionSettings.minimum_pass_percentage;

      const isEligible = hasRequiredTerms && meetsPassMark;

      // Check if SSS 3 (graduating class)
      const classLevel = (student.classes as any)?.level || "";
      const isGraduating = classLevel === "SSS 3";

      return {
        student_id: student.id,
        student_number: student.student_id,
        student_name: `${student.first_name} ${student.last_name}`,
        current_class_id: student.class_id,
        current_class_name: (student.classes as any)?.name || "",
        current_class_level: classLevel,
        current_class_stream: (student.classes as any)?.stream || "",
        education_level: (student.classes as any)?.education_level || "",
        department: student.department,
        terms_completed: termsWithResults,
        total_terms: terms?.length || 0,
        cumulative_average: cumulativeAverage,
        is_eligible: isEligible,
        is_graduating: isGraduating,
        needs_manual_review: !isEligible && termsWithResults > 0,
        term_averages: termAverages,
      };
    }) || [];

    return NextResponse.json({
      settings: promotionSettings,
      students: eligibilityData,
      total_students: eligibilityData.length,
      eligible_count: eligibilityData.filter((s) => s.is_eligible).length,
      graduating_count: eligibilityData.filter(
        (s) => s.is_graduating && s.is_eligible
      ).length,
      needs_review_count: eligibilityData.filter((s) => s.needs_manual_review)
        .length,
    });
  } catch (error: any) {
    console.error("Error fetching promotion data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch promotion data" },
      { status: 500 }
    );
  }
}

// POST - Process promotions
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { sessionId, promotions } = body;

    if (!sessionId || !promotions || !Array.isArray(promotions)) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    // Check if session is current
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("is_current")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session?.is_current) {
      return NextResponse.json(
        { error: "Can only process promotions for the current session" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results = {
      promoted: 0,
      graduated: 0,
      repeated: 0,
      errors: [] as any[],
    };

    // Process each promotion
    for (const promotion of promotions) {
      try {
        const {
          student_id,
          student_name,
          student_number,
          current_class_id,
          current_class_name,
          education_level,
          department,
          terms_completed,
          cumulative_average,
          cumulative_grade,
          position,
          total_students,
          action, // 'promote', 'graduate', 'repeat'
          next_class_id,
          notes,
        } = promotion;

        // Validate next_class_id for promotion action
        if (action === "promote" && !next_class_id) {
          console.error(`No next class found for student ${student_name} (${student_number})`);
          results.errors.push({
            student_id,
            student_name,
            error: `No next class found for promotion from ${current_class_name}`,
          });
          continue;
        }

        // Record in class history
        const { error: historyError } = await supabaseAdmin.from("class_history").upsert({
          student_id,
          class_id: current_class_id,
          session_id: sessionId,
          student_name,
          student_number,
          class_name: current_class_name,
          education_level,
          department,
          terms_completed,
          average_score: cumulative_average,
          cumulative_grade,
          position,
          total_students,
          promoted: action === "promote" || action === "graduate",
          promotion_status: action === "graduate" ? "graduated" : action === "promote" ? "promoted" : "repeated",
          promoted_to_class_id: next_class_id,
          promotion_notes: notes,
          promoted_at: new Date().toISOString(),
        });

        if (historyError) {
          console.error(`Error recording class history for ${student_name}:`, historyError);
          throw new Error(`Failed to record class history: ${historyError.message}`);
        }

        // Update student record
        if (action === "promote") {
          console.log(`Promoting student ${student_name} from class ${current_class_id} to ${next_class_id}`);
          const { error: updateError } = await supabaseAdmin
            .from("students")
            .update({
              class_id: next_class_id,
              status: "active",
            })
            .eq("id", student_id);

          if (updateError) {
            console.error(`Error updating student ${student_name}:`, updateError);
            throw new Error(`Failed to update student record: ${updateError.message}`);
          }
          results.promoted++;
        } else if (action === "graduate") {
          const { error: updateError } = await supabaseAdmin
            .from("students")
            .update({
              status: "graduated",
              class_id: current_class_id, // Keep in SSS 3
            })
            .eq("id", student_id);

          if (updateError) {
            console.error(`Error graduating student ${student_name}:`, updateError);
            throw new Error(`Failed to graduate student: ${updateError.message}`);
          }
          results.graduated++;
        } else if (action === "repeat") {
          // Student stays in same class
          results.repeated++;
        }
      } catch (error: any) {
        console.error(`Error processing promotion for student:`, error);
        results.errors.push({
          student_id: promotion.student_id,
          student_name: promotion.student_name,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${promotions.length} students: ${results.promoted} promoted, ${results.graduated} graduated, ${results.repeated} repeated`,
    });
  } catch (error: any) {
    console.error("Error processing promotions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process promotions" },
      { status: 500 }
    );
  }
}

// PUT - Update promotion settings
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { sessionId, minimum_pass_percentage, require_all_terms, auto_promote } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if settings already exist for this session
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("promotion_settings")
      .select("id")
      .eq("session_id", sessionId)
      .single();

    let result: any;

    if (existing) {
      // Update existing settings
      result = await supabaseAdmin
        .from("promotion_settings")
        .update({
          minimum_pass_percentage,
          require_all_terms,
          auto_promote,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .select()
        .single();
    } else {
      // Insert new settings
      result = await supabaseAdmin
        .from("promotion_settings")
        .insert({
          session_id: sessionId,
          minimum_pass_percentage,
          require_all_terms,
          auto_promote,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      success: true,
      settings: result.data,
    });
  } catch (error: any) {
    console.error("Error updating promotion settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update promotion settings" },
      { status: 500 }
    );
  }
}
