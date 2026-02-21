import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
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

    const debugInfo: any = {};

    // 1. Check notification_tokens table
    console.log("Querying notification_tokens table...");
    const { data: allTokens, error: tableError } = await supabaseAdmin
      .from("notification_tokens")
      .select("*");

    debugInfo.notification_tokens_count = allTokens?.length || 0;
    debugInfo.notification_tokens_error = tableError;
    debugInfo.sample_notification_tokens = allTokens?.slice(0, 3);

    // 2. Count by is_active status
    const { data: activeCount } = await supabaseAdmin
      .from("notification_tokens")
      .select("id", { count: "exact" })
      .eq("is_active", true);

    const { data: inactiveCount } = await supabaseAdmin
      .from("notification_tokens")
      .select("id", { count: "exact" })
      .eq("is_active", false);

    debugInfo.active_tokens_count = activeCount?.length || 0;
    debugInfo.inactive_tokens_count = inactiveCount?.length || 0;

    // 3. Check table structure by getting one row
    const { data: sampleToken } = await supabaseAdmin
      .from("notification_tokens")
      .select("*")
      .limit(1)
      .single();

    debugInfo.sample_token_structure = sampleToken ? Object.keys(sampleToken) : null;
    debugInfo.sample_token_data = sampleToken;

    // 4. Try alternative table names if exist
    const alternativeTables = ["fcm_tokens", "push_tokens", "device_tokens", "user_tokens"];
    debugInfo.alternative_tables_search = {};

    for (const tableName of alternativeTables) {
      try {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select("id")
          .limit(1);
        debugInfo.alternative_tables_search[tableName] = {
          exists: !error,
          count: data?.length || 0,
          error: error?.message || null,
        };
      } catch (e) {
        debugInfo.alternative_tables_search[tableName] = { error: "Table query failed" };
      }
    }

    // 5. Check if there are any users at all
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    debugInfo.total_users_count = users?.users?.length || 0;
    debugInfo.sample_user_ids = users?.users?.slice(0, 3).map((u) => u.id) || [];

    // 6. List all tables in public schema
    const { data: tables } = await supabaseAdmin
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public");

    debugInfo.all_public_tables = tables?.map((t: any) => t.table_name) || [];

    return NextResponse.json({
      success: true,
      status: "Token Registration Debug Info",
      data: debugInfo,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
