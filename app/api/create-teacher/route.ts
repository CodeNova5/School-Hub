import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import crypto from "crypto";

// Generate unique staff ID
async function generateUniqueStaffId(supabase: any) {
  while (true) {
    const staffId = `TCH${Math.floor(1000 + Math.random() * 9000)}`;

    const { data } = await supabase
      .from("teachers")
      .select("id")
      .eq("staff_id", staffId)
      .maybeSingle();

    if (!data) return staffId;
  }
}

export async function POST(req: Request) {
  try {
    const { email, teacherData, selectedClass, selectedSubjects } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    // 6️⃣ Assign subjects
    if (selectedSubjects?.length > 0 && selectedClass) {
      const assignments = selectedSubjects.map((subjectId: string) => ({
        teacher_id: teacher.id,
        subject_id: subjectId,
        class_id: selectedClass,
      }));

      const { error: subjectError } = await supabase
        .from("subject_assignments")
        .insert(assignments);

      if (subjectError) throw subjectError;
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
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/teacher/activate?token=${rawToken}`;

    await transporter.sendMail({
      from: `"School Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Activate Your Teacher Account",
      html: `
        <p>Hello,</p>
        <p>Your teacher account has been created.</p>
        <p>Click the link below to activate your account:</p>
        <p><a href="${activationLink}">Activate Account</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    });

    return NextResponse.json({ success: true, teacher });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
