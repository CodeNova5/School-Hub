import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";
import { slugifyAlumniName } from "@/lib/alumni-server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateUniqueProfileSlug(schoolId: string, fullName: string) {
  const base = slugifyAlumniName(fullName);
  let nextSlug = base;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("website_alumni_profiles")
      .select("id")
      .eq("school_id", schoolId)
      .eq("profile_slug", nextSlug)
      .maybeSingle();

    if (error) throw error;
    if (!data) return nextSlug;

    nextSlug = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await routeClient.auth.getUser();

    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.filter((value) => typeof value === "string") : [];
    const action = typeof body?.action === "string" ? body.action.toLowerCase() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (ids.length === 0) {
      return errorResponse("No applications selected", 400);
    }

    if (!["approve", "reject"].includes(action)) {
      return errorResponse("Unsupported bulk action", 400);
    }

    const { data: applications, error: listError } = await supabaseAdmin
      .from("website_alumni_applications")
      .select("*")
      .eq("school_id", permission.schoolId)
      .in("id", ids);

    if (listError) throw listError;

    const pendingApplications = (applications || []).filter((item) => item.status === "pending");
    if (pendingApplications.length === 0) {
      return errorResponse("Selected applications are already reviewed", 400);
    }

    let processedCount = 0;

    if (action === "approve") {
      for (const application of pendingApplications) {
        const profileSlug = await generateUniqueProfileSlug(permission.schoolId, application.full_name);

        const { data: profile, error: insertError } = await supabaseAdmin
          .from("website_alumni_profiles")
          .insert({
            school_id: permission.schoolId,
            profile_slug: profileSlug,
            full_name: application.full_name,
            occupation: application.occupation,
            story: application.story,
            image_url: application.image_url,
            linkedin_url: application.linkedin_url || "",
            x_url: application.x_url || "",
            tiktok_url: application.tiktok_url || "",
            instagram_url: application.instagram_url || "",
            facebook_url: application.facebook_url || "",
            website_url: application.website_url || "",
            is_visible: true,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        const { error: updateError } = await supabaseAdmin
          .from("website_alumni_applications")
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by_user_id: user?.id || null,
            approved_profile_id: profile.id,
          })
          .eq("id", application.id);

        if (updateError) throw updateError;
        processedCount += 1;
      }
    }

    if (action === "reject") {
      const pendingIds = pendingApplications.map((item) => item.id);
      const { error: rejectError } = await supabaseAdmin
        .from("website_alumni_applications")
        .update({
          status: "rejected",
          review_notes: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: user?.id || null,
        })
        .in("id", pendingIds);

      if (rejectError) throw rejectError;
      processedCount = pendingIds.length;
    }

    return successResponse({ processedCount, action });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to apply bulk alumni action", 500);
  }
}
