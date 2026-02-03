import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const studentData = await req.json();

    // 1️⃣ Create auth user for student (won't be used for login, just for data association)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: studentData.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: {
        role: "student",
        student_id: studentData.student_id,
      },
    });

    if (authError) throw authError;

    // 2️⃣ Check if parent already exists
    const { data: existingParent } = await supabase
      .from("parents")
      .select("*")
      .eq("email", studentData.parent_email)
      .single();

    let parentUserId: string;
    let isNewParent = false;

    if (existingParent) {
      // Parent exists, use existing user_id
      parentUserId = existingParent.user_id;
    } else {
      // Create new parent auth user
      const { data: parentAuthData, error: parentAuthError } = await supabase.auth.admin.createUser({
        email: studentData.parent_email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: {
          role: "parent",
          name: studentData.parent_name,
        },
      });

      if (parentAuthError) throw parentAuthError;
      parentUserId = parentAuthData.user.id;
      isNewParent = true;

      // Generate activation token for parent
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      // Create parent record
      await supabase.from("parents").insert({
        user_id: parentUserId,
        email: studentData.parent_email,
        name: studentData.parent_name,
        phone: studentData.parent_phone || null,
        is_active: false,
        activation_token_hash: tokenHash,
        activation_expires_at: new Date(Date.now() + 86400000),
        activation_used: false,
      });

      // Send activation email to parent
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/parent/activate?token=${rawToken}`;

      await transporter.sendMail({
        from: `"School Hub" <${process.env.EMAIL_USER}>`,
        to: studentData.parent_email,
        subject: "Activate Your Parent Portal Account",
        html: `
          <p>Hello ${studentData.parent_name},</p>
          <p>A student account has been created for your child/ward: <strong>${studentData.first_name} ${studentData.last_name}</strong>.</p>
          <p>Click the link below to activate your parent portal account and set your password:</p>
          <p>
            <a href="${activationLink}" style="color:#2563eb;">
              Activate Parent Account
            </a>
          </p>
          <p>Once activated, you'll be able to view your child's academic progress, attendance, assignments, and more.</p>
          <p>This link expires in 24 hours.</p>
        `,
      });
    }

    // 3️⃣ Create student row with user_id and parent_email
    await supabase.from("students").insert({
      ...studentData,
      user_id: authData.user.id,
      is_active: true, // Student is active once parent activates
      status: "active",
    });

    // 3.5️⃣ Automatically assign subjects based on religion and department
    const { data: subjectClassesData, error: subjectClassesError } = await supabase
      .from("subject_classes")
      .select(`
        id,
        subject_id,
        subjects (
          id,
          name,
          department,
          religion,
          is_optional
        )
      `)
      .eq("class_id", studentData.class_id);

    if (!subjectClassesError && subjectClassesData) {
      // Filter subjects based on student's department and religion
      const eligibleSubjectClasses = subjectClassesData.filter((sc: any) => {
        const subject = Array.isArray(sc.subjects) ? sc.subjects[0] : sc.subjects;
        
        // Filter by department if applicable
        if (subject.department && studentData.department) {
          if (subject.department !== studentData.department) {
            return false;
          }
        }

        // Filter by religion if applicable
        if (subject.religion && studentData.religion) {
          if (subject.religion !== studentData.religion) {
            return false;
          }
        }

        // Only auto-assign compulsory subjects
        return !subject.is_optional;
      });

      // Insert student_subjects for all eligible compulsory subjects
      if (eligibleSubjectClasses.length > 0) {
        const studentSubjectsToInsert = eligibleSubjectClasses.map((sc: any) => ({
          student_id: studentData.student_id,
          subject_class_id: sc.id,
        }));

        const { error: studentSubjectsError } = await supabase
          .from("student_subjects")
          .insert(studentSubjectsToInsert);

        if (studentSubjectsError) {
          console.error("Error inserting student subjects:", studentSubjectsError);
          // Don't throw error, just log it - student creation should succeed
        }
      }
    }

    // 4️⃣ If parent already exists and is active, send notification email
    if (!isNewParent && existingParent?.is_active) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"School Hub" <${process.env.EMAIL_USER}>`,
        to: studentData.parent_email,
        subject: "New Student Added to Your Account",
        html: `
          <p>Hello ${studentData.parent_name},</p>
          <p>A new student has been added to your parent portal account:</p>
          <p><strong>${studentData.first_name} ${studentData.last_name}</strong> (ID: ${studentData.student_id})</p>
          <p>You can now view their information in your parent portal.</p>
        `,
      });
    }

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
