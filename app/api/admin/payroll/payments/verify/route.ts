import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: "success" | "failed" | "abandoned";
    paid_at?: string;
    amount: number;
  };
}

export async function GET(req: NextRequest) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return errorResponse("PAYSTACK_SECRET_KEY is not configured", 500);
  }

  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return errorResponse("reference is required", 400);
  }

  const supabase = await createServerSupabaseClient();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return errorResponse("Service role key not configured", 500);
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  // Verify with Paystack
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
    },
  });

  const verifyData = (await verifyRes.json()) as PaystackVerifyResponse;
  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return errorResponse(verifyData.message || "Failed to verify payment", 400);
  }

  const mappedStatus = verifyData.data.status === "success" ? "success"
    : verifyData.data.status === "abandoned" ? "cancelled"
    : "failed";

  // Update the payroll payment record using admin client
  const { data: updatedPayments, error: updateError } = await supabaseAdmin
    .from("teacher_payroll_payments")
    .update({
      status: mappedStatus,
      paid_at: mappedStatus === "success" ? verifyData.data.paid_at || new Date().toISOString() : null,
    })
    .eq("reference", reference)
    .eq("school_id", permission.schoolId)
    .select("*, teachers(id, first_name, last_name, staff_id, email, photo_url)")
    .limit(1);

  if (updateError) {
    return errorResponse(updateError.message, 500);
  }

  const payment = Array.isArray(updatedPayments) && updatedPayments.length > 0
    ? updatedPayments[0]
    : null;

  return successResponse({
    payment,
    paystack: verifyData.data,
    status: mappedStatus,
  });
}
