import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await routeClient.auth.getUser();

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    const applicationId = context.params.id;
    if (!applicationId) {
      return errorResponse("Application id is required", 400);
    }

    const { data: application, error: fetchError } = await supabaseAdmin
      .from("website_alumni_applications")
      .select("id, status")
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

    const { error: updateError } = await supabaseAdmin
      .from("website_alumni_applications")
      .update({
        status: "rejected",
        review_notes: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: user?.id || null,
      })
      .eq("id", application.id);

    if (updateError) throw updateError;

    return successResponse({ rejected: true });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to reject alumni application", 500);
  }
}
