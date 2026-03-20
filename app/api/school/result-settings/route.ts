import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  validateResultSettingsPayload,
  type ResultSettingsPayload,
} from "@/lib/result-settings";

async function getSchoolIdOrError() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: schoolId, error: schoolError } = await supabase.rpc("get_my_school_id");

  if (schoolError || !schoolId) {
    return {
      supabase,
      error: NextResponse.json(
        { error: "Unable to determine school context" },
        { status: 400 }
      ),
    };
  }

  return { supabase, schoolId, error: null };
}

export async function GET() {
  try {
    const { supabase, schoolId, error } = await getSchoolIdOrError();
    if (error || !schoolId) return error as NextResponse;

    const [settingsRes, componentsRes, gradesRes] = await Promise.all([
      supabase
        .from("result_school_settings")
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("result_component_templates")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order", { ascending: true }),
      supabase
        .from("result_grade_scales")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order", { ascending: true }),
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (componentsRes.error) throw componentsRes.error;
    if (gradesRes.error) throw gradesRes.error;

    return NextResponse.json(
      {
        success: true,
        data: {
          settings: settingsRes.data,
          components: componentsRes.data || [],
          gradeScales: gradesRes.data || [],
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error loading result settings:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, schoolId, error } = await getSchoolIdOrError();
    if (error || !schoolId) return error as NextResponse;

    const body = (await request.json()) as ResultSettingsPayload & { activate?: boolean };
    const validation = validateResultSettingsPayload(body);

    if (!validation.ok || !validation.normalized) {
      return NextResponse.json({ error: validation.error || "Invalid payload" }, { status: 400 });
    }

    const { passPercentage, components, gradeScales } = validation.normalized;

    const { error: upsertSettingsError } = await supabase
      .from("result_school_settings")
      .upsert(
        {
          school_id: schoolId,
          pass_percentage: passPercentage,
          is_configured: false,
          configured_at: null,
        },
        { onConflict: "school_id" }
      );

    if (upsertSettingsError) throw upsertSettingsError;

    const { error: deleteComponentsError } = await supabase
      .from("result_component_templates")
      .delete()
      .eq("school_id", schoolId);

    if (deleteComponentsError) throw deleteComponentsError;

    const { error: deleteGradesError } = await supabase
      .from("result_grade_scales")
      .delete()
      .eq("school_id", schoolId);

    if (deleteGradesError) throw deleteGradesError;

    const componentRows = components.map((item, index) => ({
      school_id: schoolId,
      component_key: item.component_key,
      component_name: item.component_name,
      max_score: item.max_score,
      display_order: index + 1,
      is_active: item.is_active,
    }));

    const gradeRows = gradeScales.map((item, index) => ({
      school_id: schoolId,
      grade_label: item.grade_label,
      min_percentage: item.min_percentage,
      remark: item.remark || "",
      display_order: index + 1,
    }));

    const { error: insertComponentsError } = await supabase
      .from("result_component_templates")
      .insert(componentRows);

    if (insertComponentsError) throw insertComponentsError;

    const { error: insertGradesError } = await supabase
      .from("result_grade_scales")
      .insert(gradeRows);

    if (insertGradesError) throw insertGradesError;

    if (body.activate) {
      const { data: validityRows, error: validateRpcError } = await supabase.rpc(
        "validate_school_result_config",
        { p_school_id: schoolId }
      );

      if (validateRpcError) throw validateRpcError;

      const validity = Array.isArray(validityRows) ? validityRows[0] : null;

      if (!validity?.is_valid) {
        return NextResponse.json(
          { error: validity?.message || "Result configuration is invalid" },
          { status: 400 }
        );
      }

      const { error: activateError } = await supabase
        .from("result_school_settings")
        .update({
          is_configured: true,
          configured_at: new Date().toISOString(),
        })
        .eq("school_id", schoolId);

      if (activateError) throw activateError;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error saving result settings:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
