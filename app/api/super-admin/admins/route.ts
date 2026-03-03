import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import nodemailer from "nodemailer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Guard: Verify the caller is a super_admin
async function checkIsSuperAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess)
    return { ok: false, status: 403, error: "Forbidden – super admin only" };

  return { ok: true };
}

// GET: Fetch all school admins
export async function GET() {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { data: admins, error } = await supabaseAdmin
      .from("admins")
      .select(`
        *,
        schools (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ admins });
  } catch (error: any) {
    console.error("Error fetching admins:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch admins" },
      { status: 500 }
    );
  }
}

// POST: Create a new school admin
export async function POST(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { email, name, school_id } = await req.json();

    if (!email || !name || !school_id) {
      return NextResponse.json(
        { error: "Email, name, and school_id are required" },
        { status: 400 }
      );
    }

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingAdmin) {
      return NextResponse.json(
        { error: "Admin with this email already exists" },
        { status: 400 }
      );
    }

    // Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: Math.random().toString(36).slice(-12),
        email_confirm: false,
      });

    if (authError) throw authError;

    // Create admin record - simple, just insert with school_id
    const { error: adminError } = await supabaseAdmin.from("admins").insert({
      user_id: authData.user.id,
      email,
      name,
      school_id,
      is_active: true,
    });

    if (adminError) {
      // Cleanup auth user if record creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw adminError;
    }

    // Send activation email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
          .createHash("sha256")
          .update(rawToken)
          .digest("hex");

        await supabaseAdmin
          .from("admins")
          .update({
            activation_token_hash: tokenHash,
            activation_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
          })
          .eq("user_id", authData.user.id);

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/admin/activate?token=${rawToken}`;

        await transporter.sendMail({
          from: `"School Hub" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Activate Your School Admin Account",
          html: `
            <p>Hello ${name},</p>
            <p>You have been added as an administrator for your school on School Hub.</p>
            <p>Click the link below to activate your account and set your password:</p>
            <p>
              <a href="${activationLink}" style="color:#2563eb; text-decoration:none;">
                Activate Admin Account
              </a>
            </p>
            <p>This link expires in 24 hours.</p>
          `,
        });

        return NextResponse.json({
          success: true,
          message: "Admin created and email sent",
        });
      } catch (err: any) {
        console.error("Email sending error:", err);
        return NextResponse.json({
          success: true,
          message: "Admin created but failed to send email",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Admin created",
    });
  } catch (error: any) {
    console.error("Error creating admin:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create admin" },
      { status: 500 }
    );
  }
}

// DELETE: Remove school admin
export async function DELETE(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // Delete admin record
    await supabaseAdmin
      .from("admins")
      .delete()
      .eq("user_id", userId);

    // Delete auth user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

    if (deleteUserError) throw deleteUserError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting admin:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete admin" },
      { status: 500 }
    );
  }
}
