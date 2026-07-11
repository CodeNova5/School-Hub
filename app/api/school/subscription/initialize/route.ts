import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InitializePayload {
  planId: string;
  billingInterval: "termly" | "yearly";
  termId?: string | null;
  termIds?: string | null;
  callbackUrl?: string;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

function generateReference(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SUB-${timestamp}-${random}`;
}

// ---------------------------------------------------------------------------
// POST /api/school/subscription/initialize
// Initializes a Paystack transaction for a school subscription purchase.
// On success, creates a pending transaction and returns the authorization URL.
//
// Body: { planId, billingInterval, termId?, callbackUrl? }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return NextResponse.json(
      { error: "PAYSTACK_SECRET_KEY is not configured" },
      { status: 500 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the admin's school_id
  const { data: admin } = await supabase
    .from("admins")
    .select("school_id, name, email")
    .eq("user_id", user.id)
    .single();

  if (!admin?.school_id) {
    return NextResponse.json(
      { error: "Only school admins can manage subscriptions" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as InitializePayload;

  if (!body.planId || !body.billingInterval) {
    return NextResponse.json(
      { error: "planId and billingInterval are required" },
      { status: 400 }
    );
  }

  if (!["termly", "yearly"].includes(body.billingInterval)) {
    return NextResponse.json(
      { error: "billingInterval must be 'termly' or 'yearly'" },
      { status: 400 }
    );
  }

  // Validate termId for termly billing
  if (body.billingInterval === "termly" && !body.termId) {
    return NextResponse.json(
      { error: "termId is required for termly billing" },
      { status: 400 }
    );
  }

  // Parse termIds for yearly billing
  const selectedTermIds: string[] | null =
    body.billingInterval === "yearly" && body.termIds
      ? body.termIds.split(",").filter(Boolean)
      : null;

  if (body.billingInterval === "yearly" && selectedTermIds && selectedTermIds.length === 0) {
    return NextResponse.json(
      { error: "termIds are required for yearly billing" },
      { status: 400 }
    );
  }

  // Accept plan_key (e.g., "pro") instead of UUID for convenience
  // plan_key is UNIQUE so this is safe
  const { data: plan, error: planError } = await supabaseAdmin
    .from("subscription_plans")
    .select("id, plan_key, name, termly_price, yearly_price")
    .eq("plan_key", body.planId)
    .maybeSingle();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const amount =
    body.billingInterval === "termly" ? plan.termly_price : plan.yearly_price;

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: "This plan is free. No payment required." },
      { status: 400 }
    );
  }

  const reference = generateReference();
  const email = admin.email || user.email!;
  // Redirect back to /checkout page after Paystack completes so the
  // verification useEffect on the checkout page can handle the result.
  // The checkout page will then navigate to /checkout/success on success.
  const callbackUrl =
    body.callbackUrl ||
    `${req.nextUrl.origin}/checkout?reference=${reference}&plan=${body.planId}&interval=${body.billingInterval}${body.termId ? `&termId=${body.termId}` : ""}${body.termIds ? `&termIds=${body.termIds}` : ""}`;

  // Create or retrieve Paystack customer
  // First, try to find existing customer by email
  const { data: existingSub } = await supabaseAdmin
    .from("school_subscriptions")
    .select("customer_code, auth_code")
    .eq("school_id", admin.school_id)
    .maybeSingle();

  let customerCode = existingSub?.customer_code;

  // If no existing customer code, create one via Paystack
  if (!customerCode) {
    try {
      const customerRes = await fetch("https://api.paystack.co/customer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          first_name: admin.name?.split(" ")[0] || "School",
          metadata: {
            school_id: admin.school_id,
          },
        }),
      });

      const customerData = await customerRes.json();
      if (customerData.status && customerData.data?.customer_code) {
        customerCode = customerData.data.customer_code;
      }
    } catch {
      // Continue without customer code — it's optional
    }
  }

  // Initialize Paystack transaction
  const paystackPayload: Record<string, unknown> = {
    email,
    amount: Math.round(amount * 100), // Paystack uses kobo
    reference,
    callback_url: callbackUrl,
    metadata: {
      school_id: admin.school_id,
      plan_id: body.planId,
      plan_key: plan.plan_key,
      billing_interval: body.billingInterval,
      type: "subscription",
      ...(body.termId ? { selected_term_id: body.termId } : {}),
      ...(selectedTermIds ? { selected_term_ids: selectedTermIds } : {}),
    },
  };

  if (customerCode) {
    paystackPayload.customer_code = customerCode;
  }

  const paystackRes = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    }
  );

  const paystackData = (await paystackRes.json()) as PaystackInitializeResponse;

  if (!paystackRes.ok || !paystackData.status || !paystackData.data) {
    return NextResponse.json(
      { error: paystackData.message || "Failed to initialize payment" },
      { status: 400 }
    );
  }

  // Create a subscription_transactions record (separate from student finance transactions)
  const { error: txError } = await supabaseAdmin
    .from("school_subscription_transactions")
    .insert({
      school_id: admin.school_id,
      plan_id: body.planId,
      billing_interval: body.billingInterval,
      reference,
      amount,
      status: "pending",
      metadata: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        ...(body.termId ? { selected_term_id: body.termId } : {}),
        ...(selectedTermIds ? { selected_term_ids: selectedTermIds } : {}),
      },
      created_by: user.id,
    });

  if (txError) {
    console.error("Failed to create subscription transaction:", txError);
    // Non-fatal — the webhook will handle this
  }

  return NextResponse.json({
    authorizationUrl: paystackData.data.authorization_url,
    accessCode: paystackData.data.access_code,
    reference,
  });
}
