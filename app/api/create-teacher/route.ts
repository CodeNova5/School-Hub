import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import crypto from "crypto";
import { buildSchoolSenderName, sendEmailSafe } from "@/lib/email";
import { resolveSchoolName } from "@/lib/school-branding";

// Generate unique staff ID
async function generateUniqueStaffId(supabase: any) {
  while (true) {
    const staffId = `TCH${Math.floor(100000 + Math.random() * 900000)}`;

    const { data, error } = await supabase
      .from("teachers")
      .select("id")
      .eq("staff_id", staffId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return staffId;

  }
}

export async function POST(req: Request) {
  try {
    const { email, teacherData, selectedClass } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve school_id for the calling admin

    const routeClient = createRouteHandlerClient({ cookies });
    const { data: schoolId } = await routeClient.rpc("get_my_school_id");
    if (!schoolId) {
      return NextResponse.json({ error: "Unable to determine school context" }, { status: 400 });
    }
    const schoolName = await resolveSchoolName(supabase, schoolId);

    // 1️⃣ Check if teacher already exists
    const { data: existingTeacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingTeacher) {
      return NextResponse.json(
        { error: "A teacher with this email already exists" },
        { status: 400 }
      );
    }

    // 2️⃣ Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { role: "teacher" },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create auth user" },
        { status: 400 }
      );
    }

    // Update user with name
    const fullName = teacherData.first_name + " " + teacherData.last_name;
    await supabase.auth.admin.updateUserById(authData.user.id, {
      user_metadata: { role: "teacher", name: fullName },
    });

    // 3️⃣ Generate staff ID
    const staff_id = await generateUniqueStaffId(supabase);

    // 4️⃣ Insert teacher
    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .insert({
        ...teacherData,
        staff_id,
        email,
        user_id: authData.user.id,
        is_active: false,
        status: "inactive",
        school_id: schoolId,
      })
      .select()
      .single();

    if (teacherError || !teacher) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: teacherError?.message }, { status: 400 });
    }

    // 5️⃣ Assign class (DIRECTLY ON classes TABLE)
    if (selectedClass) {
      const { error: classError } = await supabase
        .from("classes")
        .update({
          class_teacher_id: teacher.id,
        })
        .eq("id", selectedClass)
        .is("class_teacher_id", null); // safety: prevent double assign

      if (classError) {
        throw new Error("Class is already assigned to another teacher");
      }
    }

    // 6️⃣ Create user role entry for RBAC
    const roleType = selectedClass ? 'class_teacher' : 'subject_teacher';
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: roleType,
        teacher_id: teacher.id,
        managed_class_id: selectedClass || null,
        school_id: schoolId,
      });

    if (roleError) {
      console.warn('Warning: Failed to create user role:', roleError);
      // Don't fail the entire operation, but log the warning
    }

    // 7️⃣ Generate activation token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await supabase
      .from("teachers")
      .update({
        activation_token_hash: tokenHash,
        activation_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
      })
      .eq("id", teacher.id);

    // 8️⃣ Send email
    const headersList = headers();
    const host = headersList.get('host');
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const activationLink = `${protocol}://${host}/teacher/activate?token=${rawToken}`;

    const mailError = await sendEmailSafe({
      to: email,
      fromName: buildSchoolSenderName(schoolName),
      subject: `Activate Your Teacher Account - ${schoolName}`,
      html: `
        <p>Hello ${fullName},</p>
        <p>Your teacher account has been created for <strong>${schoolName}</strong>.</p>
        <p>Click the link below to activate your account:</p>
        <p><a href="${activationLink}">Activate Account</a></p>
        <p>This link expires in 24 hours.</p>
        <p>Powered by School Deck.</p>
      `,
    });

    if (mailError) {
      console.warn("Teacher activation email failed:", mailError);
    }

    return NextResponse.json({ success: true, teacher });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
