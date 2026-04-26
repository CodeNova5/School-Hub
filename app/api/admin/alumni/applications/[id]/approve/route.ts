import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "alumni";
}

async function generateUniqueProfileSlug(schoolId: string, fullName: string) {
  const base = slugify(fullName);
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

export async function POST(_req: NextRequest, context: { params: { id: string } }) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await routeClient.auth.getUser();

    const applicationId = context.params.id;
    if (!applicationId) {
      return errorResponse("Application id is required", 400);
    }

    const { data: application, error: fetchError } = await supabaseAdmin
      .from("website_alumni_applications")
      .select("*")
      .eq("id", applicationId)
      .eq("school_id", permission.schoolId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!application) {
      return errorResponse("Application not found", 404);
    }

    if (application.status !== "pending") {
      return errorResponse("Application has already been reviewed", 400);
    }

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
      .select("id, profile_slug")
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

    return successResponse({
      approved: true,
      profileId: profile.id,
      profileSlug: profile.profile_slug,
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to approve alumni application", 500);
  }
}
