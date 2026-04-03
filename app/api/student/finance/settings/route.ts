import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { errorResponse, successResponse } from "@/lib/api-helpers";

interface SchoolFinanceSettings {
  paystack_subaccount_code?: string | null;
  enable_paystack_checkout: boolean;
  default_currency: string;
  school_name?: string;
}

export async function GET(_req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("user_id", user.id)
    .single();

  if (studentError || !student) {
    return errorResponse("Student profile not found", 404);
  }

  // Fetch both finance settings and school name
  const [{ data: settings }, { data: school }] = await Promise.all([
    supabase
      .from("finance_settings")
      .select("paystack_subaccount_code, enable_paystack_checkout, default_currency")
      .eq("school_id", student.school_id)
      .maybeSingle(),
    supabase
      .from("schools")
      .select("name")
      .eq("id", student.school_id)
      .single(),
  ]);

  const result: SchoolFinanceSettings = {
    paystack_subaccount_code: settings?.paystack_subaccount_code || null,
    enable_paystack_checkout: settings?.enable_paystack_checkout ?? true,
    default_currency: settings?.default_currency || "NGN",
    school_name: school?.name || "School",
  };

  return successResponse(result);
}
