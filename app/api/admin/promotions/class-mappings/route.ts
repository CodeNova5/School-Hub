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

  return { authorized: true, user };
}

async function requireAdmin() {
  const check = await checkIsAdmin();
  if (!check.authorized) {
    throw new Error(check.error || "Unauthorized");
  }
  return check.user;
}

// GET - Get available destination classes for a source class
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
    const sourceClassId = searchParams.get("sourceClassId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    if (!sourceClassId) {
      return NextResponse.json(
        { error: "Source class ID is required" },
        { status: 400 }
      );
    }

    // Get session and school_id
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

    // Check if mapping already exists
    const { data: existingMapping } = await supabaseAdmin
      .from("promotion_class_mappings")
      .select("*")
      .eq("session_id", sessionId)
      .eq("source_class_id", sourceClassId)
      .single();

    // Get destination class options using the SQL function
    const { data: options, error: optionsError } = await supabaseAdmin.rpc(
      "get_next_class_options",
      {
        p_source_class_id: sourceClassId,
        p_school_id: session.school_id,
      }
    );

    if (optionsError) {
      console.error("Error fetching class options:", optionsError);
      return NextResponse.json(
        { error: "Failed to fetch destination classes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId,
      sourceClassId,
      destinationOptions: options || [],
      currentMapping: existingMapping || null,
    });
  } catch (error: any) {
    console.error("Error in class mappings GET:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Save a class mapping
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { sessionId, sourceClassId, destinationClassId } =
      await request.json();

    if (!sessionId || !sourceClassId) {
      return NextResponse.json(
        { error: "Session ID and source class ID are required" },
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

    // Upsert the mapping
    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from("promotion_class_mappings")
      .upsert(
        {
          session_id: sessionId,
          school_id: session.school_id,
          source_class_id: sourceClassId,
          destination_class_id: destinationClassId || null,
          mapped_by: user!.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id,source_class_id",
        }
      )
      .select()
      .single();

    if (mappingError) {
      console.error("Error saving mapping:", mappingError);
      return NextResponse.json(
        { error: "Failed to save mapping" },
        { status: 500 }
      );
    }

    // Initialize or update class progress
    const { error: progressError } = await supabaseAdmin
      .from("promotion_class_progress")
      .upsert(
        {
          session_id: sessionId,
          school_id: session.school_id,
          class_id: sourceClassId,
          status: "pending",
        },
        {
          onConflict: "session_id,class_id",
        }
      );

    if (progressError) {
      console.error("Error initializing progress:", progressError);
      // Don't fail the response, just log
    }

    return NextResponse.json({
      message: "Class mapping saved successfully",
      mapping,
    });
  } catch (error: any) {
    console.error("Error in class mappings POST:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
