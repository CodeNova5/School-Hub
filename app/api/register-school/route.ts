import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client – bypasses RLS for administrative operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Validation ──────────────────────────────────────────────────────────

interface RegisterBody {
  plan: string;
  billingInterval: "termly" | "yearly";
  school: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  };
}

function validate(body: any): { ok: true; data: RegisterBody } | { ok: false; error: string } {
  if (!body) return { ok: false, error: "Request body is required" };

  const { plan, billingInterval, school, admin } = body;

  if (!plan || !["basic", "pro", "premium"].includes(plan)) {
    return { ok: false, error: "Invalid plan. Must be 'basic', 'pro', or 'premium'." };
  }

  if (!billingInterval || !["termly", "yearly"].includes(billingInterval)) {
    return { ok: false, error: "Invalid billing interval" };
  }

  if (!school || !school.name?.trim()) {
    return { ok: false, error: "School name is required" };
  }

  if (!school.email?.trim()) {
    return { ok: false, error: "School email is required" };
  }

  if (!admin || !admin.firstName?.trim() || !admin.lastName?.trim()) {
    return { ok: false, error: "Admin first and last name are required" };
  }

  if (!admin.email?.trim()) {
    return { ok: false, error: "Admin email is required" };
  }

  if (!admin.password || admin.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  return { ok: true, data: body as RegisterBody };
}

// ── POST /api/register-school ───────────────────────────────────────────
// Public endpoint for self-service school registration.
// Creates a school, an admin auth user, and links them together.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validate(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { plan, school, admin } = validation.data;

    // 1. Create the school
    // Note: We don't pre-check for duplicate emails because admin.listUsers() is paginated.
    // Instead, the createUser call below will return a "User already registered" error
    // which we handle gracefully.
    const { data: newSchool, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({
        name: school.name.trim(),
        email: school.email.trim() || null,
        phone: school.phone?.trim() || null,
        address: school.address?.trim() || null,
        plan,
        is_active: true,
      })
      .select()
      .single();

    if (schoolError) {
      console.error("[register-school] Failed to create school:", schoolError);
      return NextResponse.json({ error: "Failed to create school. Please try again." }, { status: 500 });
    }

    // 3. Create the admin auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: admin.email.trim(),
      password: admin.password,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        school_id: newSchool.id,
        first_name: admin.firstName.trim(),
        last_name: admin.lastName.trim(),
      },
    });

    if (authError) {
      console.error("[register-school] Failed to create admin user:", authError);
      // Rollback — delete the school we just created
      await supabaseAdmin.from("schools").delete().eq("id", newSchool.id);

      // Return a friendly message for duplicate emails
      const msg = (authError.message || "").toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: authError.message || "Failed to create admin account" },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 4. Add the admin user record in the public schema (if a users table exists)
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: userId,
          email: admin.email.trim(),
          role: "admin",
          school_id: newSchool.id,
          first_name: admin.firstName.trim(),
          last_name: admin.lastName.trim(),
          is_active: true,
        },
        { onConflict: "id", ignoreDuplicates: false }
      )
      .select()
      .maybeSingle();

    if (profileError && profileError.code !== "42P01") {
      // 42P01 = relation does not exist (no users table) — safe to ignore
      console.warn("[register-school] Profile upsert warning:", profileError.message);
    }

    console.log(`[register-school] School "${newSchool.name}" (${newSchool.id}) registered by ${admin.email}`);

    return NextResponse.json(
      {
        success: true,
        school: {
          id: newSchool.id,
          name: newSchool.name,
          plan: newSchool.plan,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[register-school] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
