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

// GET - Get progress for all classes in a session
export async function GET(request: NextRequest) {
  try {
    const authCheck = await checkIsAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error || "Unauthorized" },
        { status: authCheck.status || 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get session info
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

    // Get all classes for this school with student counts
    const { data: classes, error: classesError } = await supabaseAdmin
      .from("classes")
      .select(
        `
        id,
        name,
        school_class_levels(name),
        students(count)
      `
      )
      .eq("school_id", session.school_id);

    if (classesError) {
      console.error("Error fetching classes:", classesError);
      return NextResponse.json(
        { error: "Failed to fetch classes" },
        { status: 500 }
      );
    }

    // Get progress for each class
    const { data: progress, error: progressError } = await supabaseAdmin
      .from("promotion_class_progress")
      .select("*")
      .eq("session_id", sessionId);

    if (progressError) {
      console.error("Error fetching progress:", progressError);
      return NextResponse.json(
        { error: "Failed to fetch progress" },
        { status: 500 }
      );
    }

    // Get mappings
    const { data: mappings, error: mappingsError } = await supabaseAdmin
      .from("promotion_class_mappings")
      .select(
        `
        source_class_id,
        destination_class_id,
        classes:destination_class_id(name)
      `
      )
      .eq("session_id", sessionId);

    if (mappingsError) {
      console.error("Error fetching mappings:", mappingsError);
      return NextResponse.json(
        { error: "Failed to fetch mappings" },
        { status: 500 }
      );
    }

    // Combine data
    const progressMap = new Map(progress?.map((p: any) => [p.class_id, p]) || []);
    const mappingMap = new Map(
      mappings?.map((m: any) => [m.source_class_id, m]) || []
    );

    const classProgress = classes?.map((cls: any) => {
      const p = progressMap.get(cls.id);
      const m = mappingMap.get(cls.id);
      const destinationClass = Array.isArray(m?.classes)
        ? m.classes[0]
        : m?.classes;
      return {
        classId: cls.id,
        className: cls.name,
        classLevel: cls.school_class_levels?.name || "",
        totalStudents: cls.students?.[0]?.count || 0,
        status: p?.status || "pending",
        processedStudents: p?.processed_students || 0,
        promotedStudents: p?.promoted_students || 0,
        graduatedStudents: p?.graduated_students || 0,
        repeatedStudents: p?.repeated_students || 0,
        mapping: m
          ? {
              ...m,
              destination_class_name: destinationClass?.name || null,
            }
          : null,
        completedAt: p?.completed_at,
      };
    });

    return NextResponse.json({
      sessionId,
      classProgress: classProgress || [],
      summary: {
        totalClasses: classProgress?.length || 0,
        completedClasses:
          classProgress?.filter((c: any) => c.status === "completed").length ||
          0,
        inProgressClasses:
          classProgress?.filter((c: any) => c.status === "in_progress").length ||
          0,
        pendingClasses:
          classProgress?.filter((c: any) => c.status === "pending").length || 0,
      },
    });
  } catch (error: any) {
    console.error("Error in class progress GET:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update class progress status
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const { sessionId, classId, status } = await request.json();

    if (!sessionId || !classId || !status) {
      return NextResponse.json(
        { error: "Session ID, class ID, and status are required" },
        { status: 400 }
      );
    }

    if (!["pending", "in_progress", "completed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // Update progress
    const { data: progress, error: progressError } = await supabaseAdmin
      .from("promotion_class_progress")
      .update({
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("class_id", classId)
      .select()
      .single();

    if (progressError) {
      console.error("Error updating progress:", progressError);
      return NextResponse.json(
        { error: "Failed to update progress" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Progress updated successfully",
      progress,
    });
  } catch (error: any) {
    console.error("Error in class progress PUT:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
