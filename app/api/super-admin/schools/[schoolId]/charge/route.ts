import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { sendSuperAdminAtRiskAlert, sendPaymentFailureAlert } from "@/lib/subscription-email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIsSuperAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess) return { ok: false, status: 403, error: "Forbidden – super admin only" };
  return { ok: true };
}

interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: string;
    amount: number;
    gateway_response: string;
    authorization?: { authorization_code: string };
  };
}

function generateReference(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SUB-MANUAL-${timestamp}-${random}`;
}

type RouteParams = { params: { schoolId: string } };

// ---------------------------------------------------------------------------
// POST /api/super-admin/schools/[schoolId]/charge
// Manually charges a school's stored authorization code.
// Only usable by super admin.
// ---------------------------------------------------------------------------
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return NextResponse.json({ error: "PAYSTACK_SECRET_KEY is not configured" }, { status: 500 });
  }

  try {
    const schoolId = params.schoolId;

    // 1. Fetch school + subscription info
    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("id, name, email, plan")
      .eq("id", schoolId)
      .single();

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const { data: sub } = await supabaseAdmin
      .rpc("get_school_subscription", { p_school_id: schoolId });

    const subscription = Array.isArray(sub) ? sub[0] : sub;

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription record found for this school" },
        { status: 404 }
      );
    }

    if (!subscription.auth_code) {
      return NextResponse.json(
        { error: "No stored authorization code. School has no saved payment method." },
        { status: 400 }
      );
    }

    if (subscription.status !== "active" && subscription.status !== "past_due") {
      return NextResponse.json(
        { error: `Cannot charge a subscription with status "${subscription.status}".` },
        { status: 400 }
      );
    }

    const amount = subscription.billing_interval === "termly"
      ? subscription.termly_price
      : subscription.yearly_price;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "This plan has no chargeable amount" },
        { status: 400 }
      );
    }

    const amountInKobo = Math.round(Number(amount) * 100);
    const reference = generateReference();
    const email = subscription.customer_email || school.email || "";

    // 2. Create a pending transaction record
    await supabaseAdmin
      .from("school_subscription_transactions")
      .insert({
        school_id: schoolId,
        plan_id: subscription.plan_id,
        billing_interval: subscription.billing_interval,
        reference,
        amount,
        status: "pending",
        metadata: {
          source: "manual",
          charged_by: "super_admin",
          school_name: school.name,
        },
      });

    console.log(
      `Manual charge: ${school.name} (${schoolId}) — ` +
      `${subscription.plan_key} ${subscription.billing_interval} — ₦${amount}`
    );

    // 3. Charge via Paystack
    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/charge_authorization",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authorization_code: subscription.auth_code,
          email,
          amount: amountInKobo,
          reference,
          queue: true,
        }),
      }
    );

    const chargeData = (await paystackRes.json()) as PaystackChargeResponse;

    if (!chargeData.status) {
      // Charge failed immediately
      console.warn(`Manual charge failed for ${school.name}: ${chargeData.message}`);

      await supabaseAdmin
        .from("school_subscription_transactions")
        .update({
          status: "failed",
          metadata: {
            source: "manual",
            charged_by: "super_admin",
            school_name: school.name,
            gateway_response: chargeData.message || "Unknown error",
          },
        })
        .eq("reference", reference);

      return NextResponse.json({
        success: false,
        school: school.name,
        plan: subscription.plan_key,
        amount,
        reference,
        gateway_response: chargeData.message || "Unknown error",
        message: `Charge failed: ${chargeData.message}`,
      });
    }

    const isSuccess = chargeData.data?.status === "success";

    // 4. Update transaction record
    await supabaseAdmin
      .from("school_subscription_transactions")
      .update({
        status: isSuccess ? "success" : "failed",
        paid_at: isSuccess ? new Date().toISOString() : null,
        metadata: {
          source: "manual",
          charged_by: "super_admin",
          school_name: school.name,
          gateway_response: chargeData.data?.gateway_response || chargeData.message,
          paystack_reference: chargeData.data?.reference,
        },
      })
      .eq("reference", reference);

    // 5. Update subscription
    if (isSuccess) {
      // Fetch current term for next billing date calculation
      const { data: currentTerm } = await supabaseAdmin
        .from("terms")
        .select("id, end_date")
        .eq("school_id", schoolId)
        .eq("is_current", true)
        .maybeSingle();

      let nextBillingDate: Date;
      if (subscription.billing_interval === "termly" && currentTerm) {
        nextBillingDate = new Date(currentTerm.end_date);
        nextBillingDate.setDate(nextBillingDate.getDate() + 3);
      } else if (subscription.billing_interval === "yearly") {
        nextBillingDate = new Date();
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 4);
      }

      const periodEnd = subscription.billing_interval === "yearly"
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : currentTerm
          ? new Date(currentTerm.end_date)
          : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

      await supabaseAdmin.rpc("renew_school_subscription", {
        p_school_id: schoolId,
        p_plan_id: subscription.plan_id,
        p_billing_interval: subscription.billing_interval,
        p_next_billing_date: nextBillingDate.toISOString(),
        p_current_term_id: currentTerm?.id || null,
      });

      // Ensure school plan is up to date
      await supabaseAdmin
        .from("schools")
        .update({ plan: subscription.plan_key, updated_at: new Date().toISOString() })
        .eq("id", schoolId);

      console.log(`Manual charge: ✓ ${school.name} — charged successfully`);
    } else {
      // Failed — set to past_due with grace period
      await supabaseAdmin.rpc("expire_school_subscription", {
        p_school_id: schoolId,
        p_grace_days: 7,
      });

      console.warn(`Manual charge: ✗ ${school.name} — failed: ${chargeData.data?.gateway_response}`);

      // Notify the school's admin about the failed payment (non-fatal)
      try {
        await sendPaymentFailureAlert(schoolId, chargeData.data?.gateway_response || "Unknown error");
      } catch (err: any) {
        console.error(`Manual charge: Failed to send payment failure alert for ${school.name}:`, err.message);
      }

      // Notify super admins about the at-risk school (non-fatal)
      try {
        await sendSuperAdminAtRiskAlert(schoolId);
      } catch (err: any) {
        console.error(`Manual charge: Failed to send super admin alert for ${school.name}:`, err.message);
      }
    }

    return NextResponse.json({
      success: isSuccess,
      school: school.name,
      plan: subscription.plan_key,
      amount,
      reference,
      gateway_response: chargeData.data?.gateway_response || chargeData.message,
      message: isSuccess
        ? `Successfully charged ${school.name} ₦${(amount / 100).toLocaleString()}`
        : `Charge failed: ${chargeData.data?.gateway_response || chargeData.message}`,
    });
  } catch (err: any) {
    console.error("Manual charge error:", err.message);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
