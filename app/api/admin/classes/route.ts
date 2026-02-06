import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
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

export async function GET(req: Request) {
  try {
    // Verify admin authentication
    const authCheck = await checkIsAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: classes, error } = await supabaseAdmin
      .from("classes")
      .select(`
        id,
        name,
        level,
        stream,
        level_id,
        levels (
          name
        )
      `)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      classes: classes || [],
    });
  } catch (error: any) {
    console.error("Error fetching classes:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch classes" },
      { status: 500 }
    );
  }
}
