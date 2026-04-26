import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";
import { normalizeOptionalSocialUrl } from "@/lib/alumni-server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const id = context.params.id;
    if (!id) return errorResponse("Profile id is required", 400);

    const body = await req.json();
    const payload: Record<string, any> = {};

    if (typeof body.full_name === "string") payload.full_name = body.full_name.trim();
    if (typeof body.occupation === "string") payload.occupation = body.occupation.trim();
    if (typeof body.story === "string") payload.story = body.story.trim();
    if (typeof body.image_url === "string") payload.image_url = body.image_url.trim();
    if (typeof body.is_visible === "boolean") payload.is_visible = body.is_visible;

    payload.linkedin_url = normalizeOptionalSocialUrl(body.linkedin_url);
    payload.x_url = normalizeOptionalSocialUrl(body.x_url);
    payload.tiktok_url = normalizeOptionalSocialUrl(body.tiktok_url);
    payload.instagram_url = normalizeOptionalSocialUrl(body.instagram_url);
    payload.facebook_url = normalizeOptionalSocialUrl(body.facebook_url);
    payload.website_url = normalizeOptionalSocialUrl(body.website_url);

    if (Object.keys(payload).length === 0) {
      return errorResponse("No valid fields provided", 400);
    }

    const { error } = await supabaseAdmin
      .from("website_alumni_profiles")
      .update(payload)
      .eq("id", id)
      .eq("school_id", permission.schoolId);

    if (error) throw error;

    return successResponse({ updated: true });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update alumni profile", 500);
  }
}

export async function DELETE(_req: NextRequest, context: { params: { id: string } }) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const id = context.params.id;
    if (!id) return errorResponse("Profile id is required", 400);

    const { error } = await supabaseAdmin
      .from("website_alumni_profiles")
      .delete()
      .eq("id", id)
      .eq("school_id", permission.schoolId);

    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to delete alumni profile", 500);
  }
}
