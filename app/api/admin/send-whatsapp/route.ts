export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppToMany, normalizeToE164 } from "@/lib/whatsapp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Auth helper ───────────────────────────────────────────────────────────────

async function checkIsAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401, user: null, schoolId: null };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden", status: 403, user: null, schoolId: null };
  }

  const { data: schoolId } = await supabase.rpc("get_my_school_id");
  return { authorized: true, user, schoolId };
}

// ── Log helper ────────────────────────────────────────────────────────────────

async function logWhatsApp(
  title: string,
  body: string,
  target: string,
  targetValue: string | undefined,
  successCount: number,
  failureCount: number,
  totalRecipients: number,
  sentBy: string,
  schoolId: string,
  targetName?: string
) {
  const { error } = await supabaseAdmin.from("whatsapp_logs").insert({
    title,
    body,
    target,
    target_value: targetValue,
    target_name: targetName,
    success_count: successCount,
    failure_count: failureCount,
    total_recipients: totalRecipients,
    sent_by: sentBy,
    school_id: schoolId,
  });

  if (error) {
    console.error("❌ Failed to log WhatsApp broadcast:", error);
    return false;
  }

  console.log("✅ WhatsApp broadcast logged to database successfully");
  return true;
}

// ── Phone collection helpers ──────────────────────────────────────────────────

async function getRecipientPhones(
  target: string,
  targetValue: string | undefined,
  schoolId: string
): Promise<string[]> {
  let phones: string[] = [];

  try {
    if (target === "all") {
      const [{ data: students }, { data: teachers }, { data: parents }] =
        await Promise.all([
          supabaseAdmin
            .from("students")
            .select("phone")
            .eq("school_id", schoolId)
            .eq("is_active", true),
          supabaseAdmin
            .from("teachers")
            .select("phone")
            .eq("school_id", schoolId)
            .eq("is_active", true),
          supabaseAdmin
            .from("parents")
            .select("phone")
            .eq("school_id", schoolId)
            .eq("is_active", true),
        ]);

      phones = [
        ...(students?.map((s) => s.phone) ?? []),
        ...(teachers?.map((t) => t.phone) ?? []),
        ...(parents?.map((p) => p.phone) ?? []),
      ].filter(Boolean);
    } else if (target === "role") {
      if (targetValue === "student") {
        const { data } = await supabaseAdmin
          .from("students")
          .select("phone")
          .eq("school_id", schoolId)
          .eq("is_active", true);
        phones = (data ?? []).map((s) => s.phone).filter(Boolean);
      } else if (targetValue === "teacher") {
        const { data } = await supabaseAdmin
          .from("teachers")
          .select("phone")
          .eq("school_id", schoolId)
          .eq("is_active", true);
        phones = (data ?? []).map((t) => t.phone).filter(Boolean);
      } else if (targetValue === "parent") {
        const { data } = await supabaseAdmin
          .from("parents")
          .select("phone")
          .eq("school_id", schoolId)
          .eq("is_active", true);
        phones = (data ?? []).map((p) => p.phone).filter(Boolean);
      }
    } else if (target === "class") {
      const { data: classStudents } = await supabaseAdmin
        .from("students")
        .select("phone")
        .eq("class_id", targetValue)
        .eq("school_id", schoolId)
        .eq("is_active", true);
      phones = (classStudents ?? []).map((s) => s.phone).filter(Boolean);
    } else if (target === "user") {
      // Search across all three user types
      const tables = [
        { table: "students", phoneCol: "phone" },
        { table: "teachers", phoneCol: "phone" },
        { table: "parents", phoneCol: "phone" },
      ];

      for (const { table, phoneCol } of tables) {
        const { data } = await supabaseAdmin
          .from(table)
          .select(phoneCol)
          .eq("id", targetValue)
          .eq("school_id", schoolId)
          .single();
        const typedData = data as Record<string, any> | null;
        if (typedData?.[phoneCol]) {
          phones = [typedData[phoneCol]];
          break;
        }
      }
    }
  } catch (err) {
    console.error("Error fetching recipient phones:", err);
  }

  // Normalise to E.164 and deduplicate
  const normalized = phones
    .map((p) => normalizeToE164(p))
    .filter((p): p is string => p !== null);

  return [...new Set(normalized)];
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authCheck = await checkIsAdmin();

    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status ?? 401 }
      );
    }

    const schoolId = authCheck.schoolId;
    const userId = authCheck.user?.id;

    if (!schoolId) {
      return NextResponse.json(
        { error: "User is not assigned to a school" },
        { status: 403 }
      );
    }

    const { title, body, target, targetValue, targetName } =
      await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      );
    }

    if (!target) {
      return NextResponse.json({ error: "Target is required" }, { status: 400 });
    }

    // Resolve phones for this cohort
    const phones = await getRecipientPhones(target, targetValue, schoolId);

    if (phones.length === 0) {
      return NextResponse.json(
        {
          success: true,
          successCount: 0,
          failureCount: 0,
          totalRecipients: 0,
          warning:
            "No recipients with valid phone numbers found for the selected target.",
        },
        { status: 200 }
      );
    }

    console.log(
      `📱 Sending WhatsApp to ${phones.length} recipients (school: ${schoolId})…`
    );

    // Compose message: prefix with title if distinct from body
    const fullMessage =
      title.trim() === body.trim()
        ? body
        : `*${title.trim()}*\n\n${body.trim()}`;

    const { successCount, failureCount, errors } = await sendWhatsAppToMany(
      phones,
      fullMessage
    );

    // Log broadcast
    if (userId) {
      await logWhatsApp(
        title,
        body,
        target,
        targetValue,
        successCount,
        failureCount,
        phones.length,
        userId,
        schoolId,
        targetName
      );
    }

    const successRate =
      phones.length > 0
        ? ((successCount / phones.length) * 100).toFixed(1)
        : "0";

    console.log(`
📊 WhatsApp Broadcast Summary (school: ${schoolId}):
├─ Total Recipients: ${phones.length}
├─ Successfully Sent: ${successCount}
├─ Failed: ${failureCount}
└─ Success Rate: ${successRate}%
    `);

    return NextResponse.json(
      {
        success: true,
        successCount,
        failureCount,
        totalRecipients: phones.length,
        successRate,
        errors: errors.slice(0, 10), // return at most 10 error samples
        message: `Sent ${successCount}/${phones.length} WhatsApp message${successCount !== 1 ? "s" : ""}, ${failureCount} failed.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Error in send-whatsapp endpoint:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to send WhatsApp messages" },
      { status: 500 }
    );
  }
}
