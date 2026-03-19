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
    return { authorized: false, error: "Unauthorized", status: 401, schoolId: null };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden", status: 403, schoolId: null };
  }

  // Get user's school_id
  const { data: schoolId } = await supabase.rpc("get_my_school_id");

  return { authorized: true, schoolId };
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin and get school_id
    const authCheck = await checkIsAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error || "Unauthorized" },
        { status: authCheck.status || 401 }
      );
    }

    if (!authCheck.schoolId) {
      return NextResponse.json(
        { error: "User is not assigned to a school" },
        { status: 403 }
      );
    }

    const schoolId = authCheck.schoolId;

    // Query tokens using ADMIN client (bypasses RLS policies)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log("Fetching token diagnostics for school:", schoolId);

    // Get all tokens for this school using admin client
    const { data: allTokens, error: allError } = await supabaseAdmin
      .from("notification_tokens")
      .select("id, is_active, created_at, last_registered_at, role, user_id, school_id")
      .eq("school_id", schoolId);

    if (allError) {
      console.error("Error querying all tokens:", allError);
      throw allError;
    }

    // Get active tokens for this school
    const { data: activeTokens, error: activeError } = await supabaseAdmin
      .from("notification_tokens")
      .select("id, last_registered_at")
      .eq("school_id", schoolId)
      .eq("is_active", true);

    if (activeError) {
      console.error("Error querying active tokens:", activeError);
      throw activeError;
    }

    console.log(
      `✓ Token diagnostics fetched: Total=${allTokens?.length || 0}, Active=${activeTokens?.length || 0} for school ${schoolId}`
    );

    // Identify stale tokens
    const staleTokens = activeTokens?.filter(
      (t: any) => new Date(t.last_registered_at) < thirtyDaysAgo
    ) || [];

    // Count by role
    const roleStats: Record<string, { active: number; inactive: number }> = {};
    allTokens?.forEach((token: any) => {
      const role = token.role || "unknown";
      if (!roleStats[role]) {
        roleStats[role] = { active: 0, inactive: 0 };
      }
      if (token.is_active) {
        roleStats[role].active++;
      } else {
        roleStats[role].inactive++;
      }
    });

    const activeCount = activeTokens?.length || 0;
    const totalCount = allTokens?.length || 0;

    const diagnostics = {
      totalTokens: totalCount,
      activeTokens: activeCount,
      inactiveTokens: totalCount - activeCount,
      staleTokensCount: staleTokens.length,
      recentlyInactiveTokensCount: 0,
      roleStats,
      healthScore: totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0,
      recommendations: [
        ...((activeCount === 0 && totalCount > 0)
          ? [
              `⚠️ All ${totalCount} tokens are INACTIVE! This is why notifications aren't being sent. Check if tokens have is_active=false.`,
            ]
          : []),
        ...(totalCount === 0
          ? [
              `⚠️ No tokens registered! Make sure users have granted notification permissions.`,
            ]
          : []),
        ...(staleTokens.length > activeCount * 0.3
          ? [
              `⚠️ ${staleTokens.length} tokens are stale (30+ days old).`,
            ]
          : []),
      ],
    };

    return NextResponse.json({
      success: true,
      data: diagnostics,
    });
  } catch (error) {
    console.error("Diagnostics error:", error);
    return NextResponse.json(
      {
        error: "Failed to get diagnostics",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
