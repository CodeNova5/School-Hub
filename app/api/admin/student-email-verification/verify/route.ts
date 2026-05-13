import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIsAdmin() {
  const client = createRouteHandlerClient({ cookies });
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: isAdmin } = await client.rpc("is_admin");

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true };
}

async function getCallerSchoolId(): Promise<string | null> {
  const client = createRouteHandlerClient({ cookies });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.rpc("get_my_school_id");
  return data ?? null;
}

export async function POST(req: Request) {
  try {
    const adminCheck = await checkIsAdmin();
    if (!adminCheck.authorized) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const { email, code } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }

    const schoolId = await getCallerSchoolId();
    if (!schoolId) {
      return NextResponse.json({ error: "Unable to determine school context" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: verification, error } = await supabase
      .from("student_email_verifications")
      .select("id, code_hash, expires_at, used")
      .eq("school_id", schoolId)
      .eq("email", normalizedEmail)
      .single();

    if (error || !verification) {
      return NextResponse.json({ error: "Verification code not found" }, { status: 404 });
    }

    if (verification.used) {
      return NextResponse.json({ error: "Verification code already used" }, { status: 400 });
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Verification code expired" }, { status: 400 });
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    if (codeHash !== verification.code_hash) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("student_email_verifications")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", verification.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
