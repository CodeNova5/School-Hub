import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function requireAdmin() {
  const check = await checkIsAdmin();
  if (!check.authorized) {
    throw new Error(check.error || "Unauthorized");
  }
}

interface OrderedClassLevel {
  id: string;
  name: string;
  order_sequence: number | null;
  education_order_sequence: number | null;
}

interface PromotionClass {
  id: string;
  name: string;
  class_level_id: string;
  stream_id: string | null;
}

function sortClassLevels(levels: OrderedClassLevel[]): OrderedClassLevel[] {
  return [...levels].sort((a, b) => {
    const eduA = a.education_order_sequence ?? Number.MAX_SAFE_INTEGER;
    const eduB = b.education_order_sequence ?? Number.MAX_SAFE_INTEGER;

    if (eduA !== eduB) {
      return eduA - eduB;
    }

    const levelA = a.order_sequence ?? Number.MAX_SAFE_INTEGER;
    const levelB = b.order_sequence ?? Number.MAX_SAFE_INTEGER;

    if (levelA !== levelB) {
      return levelA - levelB;
    }

    return a.name.localeCompare(b.name);
  });
}

function resolveNextClass(
  currentClassId: string,
  classesById: Map<string, PromotionClass>,
  orderedLevelIds: string[],
  classesByLevelId: Map<string, PromotionClass[]>
): PromotionClass | undefined {
  const currentClass = classesById.get(currentClassId);
  if (!currentClass?.class_level_id) {
    return undefined;
  }

  const currentLevelIndex = orderedLevelIds.indexOf(currentClass.class_level_id);
  if (currentLevelIndex === -1) {
    return undefined;
  }

  const nextLevelId = orderedLevelIds[currentLevelIndex + 1];
  if (!nextLevelId) {
    return undefined;
  }

  const nextLevelClasses = classesByLevelId.get(nextLevelId) || [];
  if (nextLevelClasses.length === 0) {
    return undefined;
  }

  const sortedNextLevelClasses = [...nextLevelClasses].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Promotions are intentionally stream-agnostic. Prefer non-stream classes,
  // then fall back to the first deterministic class by name.
  return (
    sortedNextLevelClasses.find((cls) => !cls.stream_id) ||
    sortedNextLevelClasses[0]
  );
}


// Extract eligibility calculation into a reusable function
async function calculateStudentEligibility(
  student: any,
  terms: any[],
  results: any[],
  subjectClasses: any[],
  classesById: Map<string, PromotionClass>,
  orderedClassLevelIds: string[],
  classesByLevelId: Map<string, PromotionClass[]>,
  promotionSettings: any
) {
  const currentClassSubjects = subjectClasses?.filter(
    (sc) => sc.class_id === student.class_id
  ) || [];

  const currentClassSubjectIds = currentClassSubjects.map((sc) => sc.id);

  const studentResults = results?.filter(
    (r) => r.student_id === student.id && currentClassSubjectIds.includes(r.subject_class_id)
  ) || [];

  const termResults = new Map();
  studentResults.forEach((result: any) => {
    if (!termResults.has(result.term_id)) {
      termResults.set(result.term_id, []);
    }
    termResults.get(result.term_id).push(result);
  });

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

  const meetsPassMark =
    cumulativeAverage >= promotionSettings.minimum_pass_percentage;

  const hasRequiredTerms = promotionSettings.require_all_terms
    ? termsWithResults === terms?.length
    : termsWithResults > 0;

  const isEligible = promotionSettings.require_all_terms
    ? (hasRequiredTerms && meetsPassMark)
    : meetsPassMark;

  const classLevel = (student.classes as any)?.school_class_levels?.name || "";
  const nextClass = resolveNextClass(
    student.class_id,
    classesById,
    orderedClassLevelIds,
    classesByLevelId
  );
  const isTerminalLevel = !nextClass;
  const isGraduating = isTerminalLevel;

  return {
    student_id: student.id,
    student_number: student.student_id,
    student_name: `${student.first_name} ${student.last_name}`,
    current_class_id: student.class_id,
    current_class_name: (student.classes as any)?.name || "",
    current_class_level: classLevel,
    current_class_stream: (student.classes as any)?.school_streams?.name || "",
    next_class_id: nextClass?.id || null,
    next_class_name: nextClass?.name || null,
    is_terminal_level: isTerminalLevel,
    education_level: "",
    department: (student.classes as any)?.school_departments?.name || "",
    terms_completed: termsWithResults,
    total_terms: terms?.length || 0,
    cumulative_average: cumulativeAverage,
    is_eligible: isEligible,
    is_graduating: isGraduating,
    needs_manual_review: !isEligible && termsWithResults > 0,
    term_averages: termAverages,
  };
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const search = searchParams.get("search") || "";
    const statusFilter = searchParams.get("statusFilter") || "all";
    const classFilter = searchParams.get("classFilter") || "all";

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("id, school_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Get promotion settings for this session
    const { data: settings, error: settingsError } = await supabaseAdmin
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
    const { data: students, error: studentsError } = await supabaseAdmin
      .from("students")
      .select(
        `
        id,
        student_id,
        first_name,
        last_name,
        status,
        class_id,
        department_id,
        classes:class_id (
          id,
          name,
          class_level_id,
          stream_id,
          school_class_levels (
            name
          ),
          school_streams (
            name
          ),
          school_departments (
            name
          )
        )
      `
      )
      .eq("school_id", session.school_id)
      .in("status", ["active", "pending", "graduated", "withdrawn"]);

    if (studentsError) throw studentsError;

    // Get all terms for this session
    const { data: terms, error: termsError } = await supabaseAdmin
      .from("terms")
      .select("*")
      .eq("session_id", sessionId)
      .order("name");

    if (termsError) throw termsError;

    // Get all results for this session
    const studentIds = students?.map((s) => s.id) || [];

    // Get all subject_classes to map results to classes
    const { data: subjectClasses, error: subjectError } = await supabaseAdmin
      .from("subject_classes")
      .select("*")
      .eq("school_id", session.school_id);

    if (subjectError) throw subjectError;

    const { data: classLevels, error: classLevelsError } = await supabaseAdmin
      .from("school_class_levels")
      .select(
        `
          id,
          name,
          order_sequence,
          school_education_levels (
            order_sequence
          )
        `
      )
      .eq("school_id", session.school_id)
      .eq("is_active", true);

    if (classLevelsError) throw classLevelsError;

    const orderedClassLevels = sortClassLevels(
      ((classLevels as any[]) || []).map((level) => ({
        id: level.id,
        name: level.name,
        order_sequence: level.order_sequence ?? null,
        education_order_sequence:
          level.school_education_levels?.order_sequence ?? null,
      }))
    );

    const orderedClassLevelIds = orderedClassLevels.map((level) => level.id);

    const { data: classes, error: classesError } = await supabaseAdmin
      .from("classes")
      .select("id, name, class_level_id, stream_id")
      .eq("school_id", session.school_id);

    if (classesError) throw classesError;

    const classesById = new Map<string, PromotionClass>();
    const classesByLevelId = new Map<string, PromotionClass[]>();

    ((classes as PromotionClass[]) || []).forEach((cls) => {
      classesById.set(cls.id, cls);
      const current = classesByLevelId.get(cls.class_level_id) || [];
      current.push(cls);
      classesByLevelId.set(cls.class_level_id, current);
    });

    const { data: results, error: resultsError } = await supabaseAdmin
      .from("results")
      .select("*")
      .eq("session_id", sessionId)
      .in("student_id", studentIds);

    if (resultsError) throw resultsError;

    // Calculate eligibility for each student
    const eligibilityData = await Promise.all(
      (students || []).map((student: any) =>
        calculateStudentEligibility(
          student,
          terms,
          results,
          subjectClasses,
          classesById,
          orderedClassLevelIds,
          classesByLevelId,
          promotionSettings
        )
      )
    );

    // Apply client-side filters (search, status, class)
    let filteredData = eligibilityData;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(
        (s: any) =>
          s.student_name.toLowerCase().includes(searchLower) ||
          s.student_number.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter === "eligible") {
      filteredData = filteredData.filter((s: any) => s.is_eligible);
    } else if (statusFilter === "needs_review") {
      filteredData = filteredData.filter((s: any) => s.needs_manual_review);
    }

    // Class filter
    if (classFilter !== "all") {
      filteredData = filteredData.filter(
        (s: any) => s.current_class_name === classFilter
      );
    }

    // Sort by student name for consistency
    filteredData.sort((a: any, b: any) =>
      a.student_name.localeCompare(b.student_name)
    );

    // Apply pagination
    const totalCount = filteredData.length;
    const paginatedData = filteredData.slice(offset, offset + limit);

    interface PromotionResponse {
      settings: {
        minimum_pass_percentage: number;
        require_all_terms: boolean;
        auto_promote: boolean;
      };
      students: typeof paginatedData;
      total_students: number;
      eligible_count: number;
      graduating_count: number;
      needs_review_count: number;
      pagination: {
        offset: number;
        limit: number;
        total: number;
      };
    }

    interface PromotionStudent {
      student_id: string;
      student_number: string;
      student_name: string;
      current_class_id: string;
      current_class_name: string;
      current_class_level: string;
      current_class_stream: string;
      next_class_id?: string | null;
      next_class_name?: string | null;
      is_terminal_level?: boolean;
      education_level: string;
      department: string;
      terms_completed: number;
      total_terms: number;
      cumulative_average: number;
      is_eligible: boolean;
      is_graduating: boolean;
      needs_manual_review: boolean;
      term_averages: { term_id: string; average: number }[];
    }

    interface PromotionSettings {
      minimum_pass_percentage: number;
      require_all_terms: boolean;
      auto_promote: boolean;
    }

    const response: PromotionResponse = {
      settings: promotionSettings,
      students: paginatedData,
      total_students: eligibilityData.length,
      eligible_count: eligibilityData.filter((s: PromotionStudent) => s.is_eligible).length,
      graduating_count: eligibilityData.filter(
        (s: PromotionStudent) => s.is_graduating && s.is_eligible
      ).length,
      needs_review_count: eligibilityData.filter((s: PromotionStudent) => s.needs_manual_review)
        .length,
      pagination: {
        offset,
        limit,
        total: totalCount,
      },
    };

    return NextResponse.json(response);
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
  let lockAcquired = false;
  let lockId = "";
  let sessionIdForLock = "";

  try {
    await requireAdmin();

    const body = await request.json();
    const { sessionId, promotions } = body;
    const idempotencyKey =
      typeof body?.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0
        ? body.idempotencyKey.trim()
        : `promo_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    lockId = `${sessionId}:${idempotencyKey}`;
    sessionIdForLock = sessionId || "";

    if (!sessionId || !promotions || !Array.isArray(promotions)) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    // Check if session is current
    const { data: session, error: sessionError } = await supabaseAdmin
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

    // Server-side guard against reprocessing an already-promoted session.
    const { count: existingHistoryCount, error: existingHistoryError } =
      await supabaseAdmin
        .from("class_history")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .limit(1);

    if (existingHistoryError) {
      throw existingHistoryError;
    }

    if ((existingHistoryCount || 0) > 0) {
      return NextResponse.json(
        { error: "Promotions have already been processed for this session" },
        { status: 409 }
      );
    }

    const { data: acquired, error: lockError } = await supabaseAdmin.rpc(
      "acquire_promotion_processing_lock",
      {
        p_session_id: sessionId,
        p_lock_id: lockId,
        p_lock_ttl_seconds: 900,
      }
    );

    if (lockError) {
      throw new Error(
        `Failed to acquire promotion lock. Ensure latest migrations are applied. ${lockError.message}`
      );
    }

    if (!acquired) {
      return NextResponse.json(
        {
          error:
            "Promotions are currently being processed for this session, or have already been completed.",
        },
        { status: 409 }
      );
    }

    lockAcquired = true;

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

        const { data: outcome, error: processError } = await supabaseAdmin.rpc(
          "process_student_promotion_tx",
          {
            p_session_id: sessionId,
            p_student_id: student_id,
            p_student_name: student_name,
            p_student_number: student_number,
            p_current_class_id: current_class_id,
            p_current_class_name: current_class_name,
            p_education_level: education_level,
            p_department: department ?? null,
            p_terms_completed: terms_completed ?? 0,
            p_cumulative_average: cumulative_average ?? 0,
            p_cumulative_grade: cumulative_grade ?? null,
            p_position: position ?? null,
            p_total_students: total_students ?? null,
            p_action: action,
            p_next_class_id: next_class_id ?? null,
            p_notes: notes ?? null,
          }
        );

        if (processError) {
          throw new Error(processError.message);
        }

        if (outcome === "promoted") {
          results.promoted++;
        } else if (outcome === "graduated") {
          results.graduated++;
        } else {
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

    await supabaseAdmin
      .from("promotion_settings")
      .update(
        {
          last_processed_at: new Date().toISOString(),
          processing_lock_id: null,
          processing_started_at: null,
          updated_at: new Date().toISOString(),
        }
      )
      .eq("session_id", sessionId)
      .eq("processing_lock_id", lockId);

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
  } finally {
    if (lockAcquired && lockId && sessionIdForLock) {
      await supabaseAdmin.rpc("release_promotion_processing_lock", {
        p_session_id: sessionIdForLock,
        p_lock_id: lockId,
      });
    }
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
