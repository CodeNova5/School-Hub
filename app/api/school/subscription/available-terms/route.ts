import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AvailableTerm {
  id: string;
  name: string;
  session_name: string;
  session_id: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  weeks: number;
}

// ---------------------------------------------------------------------------
// GET /api/school/subscription/available-terms
// Returns upcoming terms for the authenticated school.
// Used by the checkout page to let subscribers pick which term to pay for.
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the admin's school_id
  const { data: admin } = await supabase
    .from("admins")
    .select("school_id")
    .eq("user_id", user.id)
    .single();

  if (!admin?.school_id) {
    return NextResponse.json(
      { error: "Only school admins can manage subscriptions" },
      { status: 403 }
    );
  }

  try {
    // Fetch all upcoming terms (end_date >= today) for this school
    const today = new Date().toISOString().split("T")[0];

    const { data: terms, error: termsError } = await supabaseAdmin
      .from("terms")
      .select(`
        id,
        name,
        start_date,
        end_date,
        is_current,
        session_id,
        sessions!inner(name)
      `)
      .eq("school_id", admin.school_id)
      .gte("end_date", today)
      .order("start_date", { ascending: true });

    if (termsError) {
      console.error("Failed to fetch available terms:", termsError);
      return NextResponse.json(
        { error: "Failed to fetch terms" },
        { status: 500 }
      );
    }

    const availableTerms: AvailableTerm[] = (terms ?? []).map((t: any) => {
      const ms = new Date(t.end_date).getTime() - new Date(t.start_date).getTime();
      const weeks = Math.round(ms / (1000 * 60 * 60 * 24 * 7));
      return {
        id: t.id,
        name: t.name,
        session_name: t.sessions?.name || "",
        session_id: t.session_id,
        start_date: t.start_date,
        end_date: t.end_date,
        is_current: t.is_current,
        weeks,
      };
    });

    return NextResponse.json({ terms: availableTerms });
  } catch (err: any) {
    console.error("Available terms error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
