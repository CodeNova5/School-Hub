import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getTokenHealthDiagnostics } from "@/lib/notification-utils";

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

    // Get token health diagnostics
    const diagnostics = await getTokenHealthDiagnostics();

    if (!diagnostics) {
      throw new Error("Failed to get diagnostics");
    }

    return NextResponse.json({
      success: true,
      data: diagnostics,
    });
  } catch (error) {
    console.error("Diagnostics error:", error);
    return NextResponse.json(
      { error: "Failed to get diagnostics" },
      { status: 500 }
    );
  }
}
