import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// GET /api/features
// Returns all active feature metadata (label, icon, description, etc.)
// Accessible to any authenticated user — no super admin check needed.
// Used by client components to render feature info from the DB.
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("get_features");
    if (error) throw error;

    // Return as a map for easy client-side lookup: { feature_key: { ... } }
    const featuresMap: Record<string, Record<string, string>> = {};
    for (const feat of data ?? []) {
      featuresMap[feat.feature_key] = {
        label: feat.label,
        label_short: feat.label_short,
        description: feat.description,
        icon: feat.icon,
        category: feat.category,
      };
    }

    return NextResponse.json({ features: featuresMap });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
