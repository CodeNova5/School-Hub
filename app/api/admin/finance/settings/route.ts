import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

interface UpdateFinanceSettingsPayload {
  paystackSubaccountCode?: string;
  enablePaystackCheckout?: boolean;
  defaultCurrency?: string;
  invoicePrefix?: string;
  receiptPrefix?: string;
}

export async function GET(_req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const supabase = createRouteHandlerClient({ cookies });

  const { data, error } = await supabase
    .from("finance_settings")
    .select("*")
    .eq("school_id", permission.schoolId)
    .maybeSingle();

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse(
    data || {
      school_id: permission.schoolId,
      paystack_subaccount_code: "",
      enable_paystack_checkout: true,
      default_currency: "NGN",
      invoice_prefix: "INV",
      receipt_prefix: "RCP",
    }
  );
}

export async function PUT(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const body = (await req.json()) as UpdateFinanceSettingsPayload;
  const supabase = createRouteHandlerClient({ cookies });

  const payload = {
    school_id: permission.schoolId,
    paystack_subaccount_code: (body.paystackSubaccountCode || "").trim() || null,
    enable_paystack_checkout: body.enablePaystackCheckout ?? true,
    default_currency: (body.defaultCurrency || "NGN").trim().toUpperCase(),
    invoice_prefix: (body.invoicePrefix || "INV").trim().toUpperCase(),
    receipt_prefix: (body.receiptPrefix || "RCP").trim().toUpperCase(),
  };

  const { data, error } = await supabase
    .from("finance_settings")
    .upsert(payload, { onConflict: "school_id" })
    .select("*")
    .single();

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse(data);
}
