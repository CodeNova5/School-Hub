import { createServerSupabaseClient } from "@/lib/supabase-server";

import { NextRequest } from "next/server";
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

async function getAuthenticatedTeacher(supabase: any) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id, school_id, first_name, last_name, email, phone, paystack_subaccount_code, bank_name, bank_code, account_number, account_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (teacherError || !teacher) {
    return null;
  }

  return teacher;
}

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return null;
  }
  return secret;
}

export async function GET() {
  const paystackSecret = getPaystackSecret();
  const supabase = await createServerSupabaseClient();
  const teacher = await getAuthenticatedTeacher(supabase);

  if (!teacher) {
    return errorResponse("Unauthorized", 401);
  }

  if (!teacher.paystack_subaccount_code) {
    return errorResponse("No subaccount configured", 404);
  }

  // Fetch subaccount details from Paystack
  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/subaccount/${teacher.paystack_subaccount_code}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      }
    );
    const paystackData = await paystackRes.json();

    return successResponse({
      subaccount_code: teacher.paystack_subaccount_code,
      bank_name: teacher.bank_name || paystackData.data?.settlement_bank,
      bank_code: teacher.bank_code,
      account_number: teacher.account_number || paystackData.data?.account_number,
      account_name: teacher.account_name || paystackData.data?.account_name,
      business_name: paystackData.data?.business_name || `${teacher.first_name} ${teacher.last_name}`,
      paystack_details: paystackData.data || null,
    });
  } catch {
    // Fallback to DB data if Paystack fetch fails
    return successResponse({
      subaccount_code: teacher.paystack_subaccount_code,
      bank_name: teacher.bank_name,
      bank_code: teacher.bank_code,
      account_number: teacher.account_number,
      account_name: teacher.account_name,
      business_name: `${teacher.first_name} ${teacher.last_name}`,
      paystack_details: null,
    });
  }
}

export async function POST(req: NextRequest) {
  const paystackSecret = getPaystackSecret();
  if (!paystackSecret) {
    return errorResponse("PAYSTACK_SECRET_KEY is not configured", 500);
  }

  const supabase = await createServerSupabaseClient();
  const teacher = await getAuthenticatedTeacher(supabase);

  if (!teacher) {
    return errorResponse("Unauthorized", 401);
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

  // Save subaccount code + bank details to teacher record
  const { error: updateError } = await supabase
    .from("teachers")
    .update({
      paystack_subaccount_code: paystackData.data.subaccount_code,
      bank_name: paystackData.data.settlement_bank,
      bank_code: body.settlementBank || null,
      account_number: body.accountNumber || null,
      account_name: body.accountName || null,
    })
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

export async function PUT(req: NextRequest) {
  const paystackSecret = getPaystackSecret();
  if (!paystackSecret) {
    return errorResponse("PAYSTACK_SECRET_KEY is not configured", 500);
  }

  const supabase = await createServerSupabaseClient();
  const teacher = await getAuthenticatedTeacher(supabase);

  if (!teacher) {
    return errorResponse("Unauthorized", 401);
  }

  if (!teacher.paystack_subaccount_code) {
    return errorResponse("No subaccount configured. Create one first.", 400);
  }

  const body = (await req.json()) as CreateSubaccountPayload;
  if (!body.settlementBank || !body.accountNumber) {
    return errorResponse("Settlement bank code and account number are required", 400);
  }

  const businessName = body.businessName || `${teacher.first_name} ${teacher.last_name}`;

  // Update subaccount on Paystack
  const paystackPayload = {
    business_name: businessName,
    settlement_bank: body.settlementBank,
    account_number: body.accountNumber,
    percentage_charge: body.percentageCharge ?? 0,
  };

  const paystackRes = await fetch(
    `https://api.paystack.co/subaccount/${teacher.paystack_subaccount_code}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    }
  );

  const paystackData = await paystackRes.json();
  if (!paystackRes.ok || !paystackData.status) {
    return errorResponse(paystackData.message || "Failed to update Paystack subaccount", 400);
  }

  // Update bank details in the teachers table
  const { error: updateError } = await supabase
    .from("teachers")
    .update({
      bank_name: paystackData.data?.settlement_bank,
      bank_code: body.settlementBank,
      account_number: body.accountNumber,
      account_name: body.accountName || null,
    })
    .eq("id", teacher.id);

  if (updateError) {
    return errorResponse(updateError.message, 500);
  }

  return successResponse({
    subaccount_code: teacher.paystack_subaccount_code,
    message: "Subaccount updated successfully.",
    paystack: paystackData.data || null,
  });
}
