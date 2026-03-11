import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { EducationLevel, ClassLevel, Stream, Department, Religion } from "@/lib/types";

/**
 * GET /api/school/config
 * 
 * Fetch school configuration data (education levels, class levels, streams, departments, religions)
 * 
 * Query params:
 * - type: "education_levels" | "class_levels" | "streams" | "departments" | "religions" (required)
 * - education_level_id: uuid (optional, for filtering class_levels by education_level)
 */
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get school_id from admin/user context
    const { data: schoolId, error: schoolError } = await supabase.rpc("get_my_school_id");

    if (schoolError || !schoolId) {
      return NextResponse.json(
        { error: "Unable to determine school context" },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const educationLevelId = searchParams.get("education_level_id");

    if (!type) {
      return NextResponse.json(
        { error: "Missing 'type' query parameter" },
        { status: 400 }
      );
    }

    let data: any[] = [];

    switch (type) {
      case "education_levels": {
        const { data: levels, error } = await supabase
          .from("school_education_levels")
          .select("*")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("order_sequence", { ascending: true });

        if (error) throw error;
        data = levels || [];
        break;
      }

      case "class_levels": {
        let query = supabase
          .from("school_class_levels")
          .select("*, school_education_levels(*)")
          .eq("school_id", schoolId)
          .eq("is_active", true);

        if (educationLevelId) {
          query = query.eq("education_level_id", educationLevelId);
        }

        const { data: levels, error } = await query.order("order_sequence", {
          ascending: true,
        });

        if (error) throw error;
        data = levels || [];
        break;
      }

      case "streams": {
        const { data: streams, error } = await supabase
          .from("school_streams")
          .select("*")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;
        data = streams || [];
        break;
      }

      case "departments": {
        const { data: departments, error } = await supabase
          .from("school_departments")
          .select("*")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;
        data = departments || [];
        break;
      }

      case "religions": {
        const { data: religions, error } = await supabase
          .from("school_religions")
          .select("*")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;
        data = religions || [];
        break;
      }

      default: {
        return NextResponse.json(
          { error: `Unknown type: ${type}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true, data, schoolId }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching school config:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
