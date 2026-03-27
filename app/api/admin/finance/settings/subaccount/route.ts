import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

interface CreateSubaccountPayload {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  percentageCharge?: number;
  primaryContactEmail?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
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
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return errorResponse("PAYSTACK_SECRET_KEY is not configured", 500);
  }

  const body = (await req.json()) as CreateSubaccountPayload;
  if (!body.businessName || !body.settlementBank || !body.accountNumber) {
    return errorResponse("businessName, settlementBank and accountNumber are required", 400);
  }

  const paystackPayload = {
    business_name: body.businessName,
    settlement_bank: body.settlementBank,
    account_number: body.accountNumber,
    percentage_charge: body.percentageCharge ?? 0,
    primary_contact_email: body.primaryContactEmail,
    primary_contact_name: body.primaryContactName,
    primary_contact_phone: body.primaryContactPhone,
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

  const supabase = createRouteHandlerClient({ cookies });

  const { data: settings, error } = await supabase
    .from("finance_settings")
    .upsert(
      {
        school_id: permission.schoolId,
        paystack_subaccount_code: paystackData.data.subaccount_code,
      },
      { onConflict: "school_id" }
    )
    .select("*")
    .single();

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse({
    settings,
    paystack: paystackData.data,
  });
}
