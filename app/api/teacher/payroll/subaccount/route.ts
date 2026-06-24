import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { errorResponse, successResponse } from "@/lib/api-helpers";

interface CreateSubaccountPayload {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  accountName?: string;
  percentageCharge?: number;
}

interface PaystackCreateSubaccountResponse {
  status: boolean;
  message: string;
  data?: {
    subaccount_code: string;
    business_name: string;
    settlement_bank: string;
    account_number: string;
    percentage_charge: number;
  };
}

export async function POST(req: NextRequest) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return errorResponse("PAYSTACK_SECRET_KEY is not configured", 500);
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  // Get teacher profile
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id, school_id, first_name, last_name, email, phone, paystack_subaccount_code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (teacherError || !teacher) {
    return errorResponse("Teacher profile not found", 404);
  }

  // If teacher already has a subaccount, return it
  if (teacher.paystack_subaccount_code) {
    return successResponse({
      subaccount_code: teacher.paystack_subaccount_code,
      already_exists: true,
      message: "You already have a Paystack subaccount configured.",
    });
  }

  const body = (await req.json()) as CreateSubaccountPayload;
  if (!body.settlementBank || !body.accountNumber) {
    return errorResponse("Settlement bank code and account number are required", 400);
  }

  const businessName = body.businessName || `${teacher.first_name} ${teacher.last_name}`;

  const paystackPayload = {
    business_name: businessName,
    settlement_bank: body.settlementBank,
    account_number: body.accountNumber,
    percentage_charge: body.percentageCharge ?? 0,
    primary_contact_email: teacher.email,
    primary_contact_name: `${teacher.first_name} ${teacher.last_name}`,
    primary_contact_phone: teacher.phone || undefined,
  };

  const paystackRes = await fetch("https://api.paystack.co/subaccount", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paystackPayload),
  });

  const paystackData = (await paystackRes.json()) as PaystackCreateSubaccountResponse;
  if (!paystackRes.ok || !paystackData.status || !paystackData.data?.subaccount_code) {
    return errorResponse(paystackData.message || "Failed to create Paystack subaccount", 400);
  }

  // Save subaccount code to teacher record
  const { error: updateError } = await supabase
    .from("teachers")
    .update({ paystack_subaccount_code: paystackData.data.subaccount_code })
    .eq("id", teacher.id);

  if (updateError) {
    return errorResponse(updateError.message, 500);
  }

  // Also create/update payroll settings record if not exists
  const { data: existingSettings } = await supabase
    .from("teacher_payroll_settings")
    .select("id")
    .eq("school_id", teacher.school_id)
    .eq("teacher_id", teacher.id)
    .maybeSingle();

  if (!existingSettings) {
    await supabase.from("teacher_payroll_settings").insert({
      school_id: teacher.school_id,
      teacher_id: teacher.id,
      salary_amount: 0,
      is_active: true,
    });
  }

  return successResponse({
    subaccount_code: paystackData.data.subaccount_code,
    paystack: paystackData.data,
  });
}
