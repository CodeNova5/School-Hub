
// app/api/create-teacher/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import crypto from "crypto";

// Function to generate a unique staff ID
async function generateUniqueStaffId(supabase: any) {
  while (true) {
    const staffId = `TCH${Math.floor(1000 + Math.random() * 9000)}`;

    const { data } = await supabase
      .from("teachers")
      .select("id")
      .eq("staff_id", staffId)
      .maybeSingle(); // ✅ IMPORTANT

    if (!data) return staffId; // unique
  }
}


export async function POST(req: Request) {
  try {
    const { email, teacherData, selectedClass, selectedSubjects } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1️⃣ Create auth user

    const { data: existingAuth } = await supabase.auth.admin.listUsers();

    if (existingAuth?.users?.some(u => u.email === email)) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }


    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { role: "teacher" },
      });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || "Failed to create auth user" }, { status: 400 });
    }

    // 2️⃣ Generate unique staff ID
    const staff_id = await generateUniqueStaffId(supabase);

    // 3️⃣ Insert teacher record
    const { data: teacher, error: teacherError } =
      await supabase
        .from("teachers")
        .insert({
          ...teacherData,
          staff_id,
          email,
          user_id: authData.user.id,
          is_active: false,
          status: "pending",
        })
        .select()
        .single();

    if (teacherError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: teacherError.message }, { status: 400 });
    }

    // 4️⃣ Assign class
    if (selectedClass) {
      await supabase
        .from('teacher_classes')
        .insert({ teacher_id: teacher.id, class_id: selectedClass });
    }

    // 5️⃣ Assign subjects
    if (selectedSubjects?.length > 0 && selectedClass) {
      const assignments = selectedSubjects.map((subjectId: string) => ({
        teacher_id: teacher.id,
        subject_id: subjectId,
        class_id: selectedClass,
      }));

      const { error: subjectError } = await supabase
        .from("subject_assignments")
        .insert(assignments);

      if (subjectError) {
        throw subjectError;
      }
    }


    // 6️⃣ Generate and save activation token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await supabase
      .from("teachers")
      .update({
        activation_token_hash: tokenHash,
        activation_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
      })
      .eq("id", teacher.id);

    // 7️⃣ Send activation email
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
        <p>Click the link below to activate your account and set your password:</p>
        <p><a href="${activationLink}" style="color:#2563eb;">Activate Account</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    });

    return NextResponse.json({ success: true, teacher });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Unexpected server error" }, { status: 500 });
  }
}
