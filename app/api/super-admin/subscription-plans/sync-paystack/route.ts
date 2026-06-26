import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIsSuperAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" } as const;
  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess) return { ok: false, status: 403, error: "Forbidden – super admin only" } as const;
  return { ok: true } as const;
}

interface PaystackPlanResponse {
  status: boolean;
  message: string;
  data: {
    plan_code: string;
    name: string;
    amount: number;
    interval: string;
    id: number;
  };
}

// ---------------------------------------------------------------------------
// POST /api/super-admin/subscription-plans/sync-paystack
// For each plan with a non-zero price, creates or updates a Paystack plan.
// Returns the Paystack plan codes.
// ---------------------------------------------------------------------------
export async function POST(_req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return NextResponse.json(
      { error: "PAYSTACK_SECRET_KEY is not configured. Add it to your environment variables." },
      { status: 500 }
    );
  }

  try {
    // Fetch all plans from DB
    const { data: plans, error: plansError } = await supabaseAdmin.rpc("get_subscription_plans");
    if (plansError) throw plansError;

    const results: {
      plan_key: string;
      monthly: { plan_code: string | null; error?: string };
      yearly: { plan_code: string | null; error?: string };
    }[] = [];

    for (const plan of plans ?? []) {
      const planResults: (typeof results)[0] = {
        plan_key: plan.plan_key,
        monthly: { plan_code: plan.monthly_paystack_plan_code ?? null },
        yearly: { plan_code: plan.yearly_paystack_plan_code ?? null },
      };

      // Sync monthly plan
      if (Number(plan.monthly_price) > 0) {
        try {
          const monthlyRes = await createOrUpdatePaystackPlan(
            paystackSecret,
            `${plan.name} - Monthly`,
            Math.round(Number(plan.monthly_price)),
            "monthly",
            plan.monthly_paystack_plan_code
          );
          planResults.monthly.plan_code = monthlyRes.plan_code;

          // Save the plan code to DB
          await supabaseAdmin.rpc("update_subscription_plan", {
            p_plan_id: plan.id,
            p_monthly_paystack_plan_code: monthlyRes.plan_code,
          });
        } catch (err: any) {
          planResults.monthly.error = err.message;
        }
      }

      // Sync yearly plan
      if (Number(plan.yearly_price) > 0) {
        try {
          const yearlyRes = await createOrUpdatePaystackPlan(
            paystackSecret,
            `${plan.name} - Yearly`,
            Math.round(Number(plan.yearly_price)),
            "annually",
            plan.yearly_paystack_plan_code
          );
          planResults.yearly.plan_code = yearlyRes.plan_code;

          await supabaseAdmin.rpc("update_subscription_plan", {
            p_plan_id: plan.id,
            p_yearly_paystack_plan_code: yearlyRes.plan_code,
          });
        } catch (err: any) {
          planResults.yearly.error = err.message;
        }
      }

      results.push(planResults);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function createOrUpdatePaystackPlan(
  secret: string,
  name: string,
  amountInKobo: number,
  interval: string,
  existingPlanCode: string | null
): Promise<{ plan_code: string }> {
  const headers = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };

  // If we have an existing plan code, try to update it
  if (existingPlanCode) {
    const updateRes = await fetch(
      `https://api.paystack.co/plan/${existingPlanCode}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name,
          amount: amountInKobo,
        }),
      }
    );
    const updateData = await updateRes.json() as PaystackPlanResponse;
    if (updateData.status) {
      return { plan_code: existingPlanCode };
    }
    // If update fails (e.g., plan deleted), fall through to create
    console.warn(`Failed to update plan ${existingPlanCode}: ${updateData.message}`);
  }

  // Create a new plan
  const createRes = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      amount: amountInKobo,
      interval,
    }),
  });

  const createData = await createRes.json() as PaystackPlanResponse;
  if (!createData.status) {
    throw new Error(`Paystack plan creation failed: ${createData.message}`);
  }

  return { plan_code: createData.data.plan_code };
}
