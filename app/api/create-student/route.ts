import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import crypto from "crypto";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getMailTransporter() {
  const host = process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = Number(process.env.EMAIL_PORT || "587");
  const secure = process.env.EMAIL_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

async function sendEmailSafe(payload: MailPayload): Promise<string | null> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return "Email not configured (missing EMAIL_USER/EMAIL_PASS).";
  }

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from: `"School Hub" <${process.env.EMAIL_USER}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return null;
  } catch (error: any) {
    console.error("Email delivery failed:", error);
    return error?.message || "Unknown email delivery error";
  }
}

/**
 * Resolve the school_id for the admin making the request.
 * Falls back to the default school id if no school is found.
 */
async function getCallerSchoolId(): Promise<string | null> {
  const routeClient = createRouteHandlerClient({ cookies });
  const { data: { user } } = await routeClient.auth.getUser();
  if (!user) return null;
  const { data } = await routeClient.rpc("get_my_school_id");
  return data ?? null;
}

// Function to generate unique student ID
async function generateUniqueStudentId(): Promise<string> {
  let studentId: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // Format: STU + 6 random digits (e.g., STU123456)
    const randomNum = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    studentId = `STU${randomNum}`;

    // Check if this ID already exists
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('student_id', studentId)
      .single();

    if (!existingStudent) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique student ID after multiple attempts');
  }

  return studentId!;
}

export async function POST(req: Request) {
  try {
    const studentData = await req.json();
    const warnings: string[] = [];

    // Resolve school_id: prefer explicit body param (internal calls), else from caller session
    let schoolId: string | null = studentData.school_id ?? null;
    if (!schoolId) {
      schoolId = await getCallerSchoolId();
    }
    if (!schoolId) {
      return NextResponse.json({ error: "Unable to determine school context" }, { status: 400 });
    }

    // Generate unique student ID
    const generatedStudentId = await generateUniqueStudentId();

    // Determine if student has their own email or using parent's
    const hasOwnEmail = studentData.email && studentData.email.trim() !== '';
    const studentEmail = hasOwnEmail ? studentData.email : studentData.parent_email;
    const studentIsActive = !hasOwnEmail; // Only active if no own email (using parent's)

    // 1️⃣ Create auth user for student ONLY if they have their own email
    let authUserId: string | null = null;
    
    if (hasOwnEmail) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: studentEmail,
        password: crypto.randomUUID(),
        email_confirm: false, // They need to activate
        user_metadata: {
          role: "student",
          student_id: generatedStudentId,
          first_name: studentData.first_name,
          last_name: studentData.last_name,
          name: `${studentData.first_name} ${studentData.last_name}`.trim(),
        },
      });

      if (authError) throw authError;
      authUserId = authData.user.id;
    }

    // 2️⃣ Check if parent already exists
    const { data: existingParent } = await supabase
      .from("parents")
      .select("*")
      .eq("email", studentData.parent_email)
      .single();

    let parentUserId: string;
    let isNewParent = false;

    if (existingParent) {
      parentUserId = existingParent.user_id;
      // Do not create new parent or send activation email
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
      const { error: parentInsertError } = await supabase.from("parents").insert({
        user_id: parentUserId,
        email: studentData.parent_email,
        name: studentData.parent_name,
        phone: studentData.parent_phone || null,
        is_active: false,
        activation_token_hash: tokenHash,
        activation_expires_at: new Date(Date.now() + 86400000),
        activation_used: false,
        school_id: schoolId,
      });

      if (parentInsertError) throw parentInsertError;

      // Store token for email after core create flow succeeds
      (studentData as any).__parentActivationToken = rawToken;
    }

    // 3️⃣ Create student row with generated ID
    const studentInsertData = {
      first_name: studentData.first_name,
      last_name: studentData.last_name,
      email: studentEmail,
      phone: studentData.phone || studentData.parent_phone || null,
      date_of_birth: studentData.date_of_birth || null,
      gender: studentData.gender || null,
      address: studentData.address || null,
      class_id: studentData.class_id || null,
      department_id: studentData.department_id || null,
      religion_id: studentData.religion_id || null,
      parent_name: studentData.parent_name,
      parent_email: studentData.parent_email,
      parent_phone: studentData.parent_phone || null,
      admission_date: studentData.admission_date,
      student_id: generatedStudentId,
      user_id: authUserId, // Will be null if no own email
      is_active: studentIsActive,
      status: "active",
      school_id: schoolId,
    };

    const { data: createdStudent, error: studentError } = await supabase
      .from("students")
      .insert(studentInsertData)
      .select()
      .single();

    if (studentError) throw studentError;
    // 3.5️⃣ If student has own email, generate and send activation token link
    if (hasOwnEmail) {
      // Generate activation token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      // Save token in students table
      const { error: studentTokenError } = await supabase
        .from("students")
        .update({
          activation_token_hash: tokenHash,
          activation_expires_at: new Date(Date.now() + 86400000), // 24 hours expiry
          activation_used: false,
        })
        .eq("id", createdStudent.id);

      if (studentTokenError) {
        throw studentTokenError;
      }

      const activationLink =
        `${process.env.NEXT_PUBLIC_APP_URL}/student/activate?token=${rawToken}`;

      const studentMailError = await sendEmailSafe({
        to: studentData.email,
        subject: "Activate Your Student Account",
        html: `
      <p>Hello ${studentData.first_name},</p>
      <p>Your student account has been created.</p>
      <p>Click the link below to activate your account and set your password:</p>
      <p>
        <a href="${activationLink}" style="color:#2563eb;">
          Activate Account
        </a>
      </p>
      <p>This link expires in 24 hours.</p>
    `,
      });

      if (studentMailError) {
        warnings.push(`Student activation email was not delivered: ${studentMailError}`);
      }
    }

    // 3.6️⃣ Automatically assign subjects based on religion and department
    if (studentData.class_id) {
      const { data: subjectClassesData, error: subjectClassesError } = await supabase
        .from("subject_classes")
        .select(`
          id,
          subject_id,
          subjects (
            id,
            name,
            department_id,
            religion_id,
            is_optional
          )
        `)
        .eq("class_id", studentData.class_id);

      if (!subjectClassesError && subjectClassesData) {
        const eligibleSubjectClasses = subjectClassesData.filter((sc: any) => {
          const subject = Array.isArray(sc.subjects) ? sc.subjects[0] : sc.subjects;

          if (subject.department_id && studentData.department_id) {
            if (subject.department_id !== studentData.department_id) {
              return false;
            }
          }

          if (subject.religion_id && studentData.religion_id) {
            if (subject.religion_id !== studentData.religion_id) {
              return false;
            }
          }

          return !subject.is_optional;
        });

        if (eligibleSubjectClasses.length > 0) {
          const studentSubjectsToInsert = eligibleSubjectClasses.map((sc: any) => ({
            student_id: createdStudent.id,
            subject_class_id: sc.id,
          }));

          const { error: studentSubjectsError } = await supabase
            .from("student_subjects")
            .insert(studentSubjectsToInsert);

          if (studentSubjectsError) {
            console.error("Error inserting student subjects:", studentSubjectsError);
          }
        }
      }
    }

    // 4️⃣ Send parent notifications (best effort; do not fail student creation)
    if (isNewParent) {
      const parentActivationToken = (studentData as any).__parentActivationToken;
      if (parentActivationToken) {
        const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/parent/activate?token=${parentActivationToken}`;

        const parentMailError = await sendEmailSafe({
          to: studentData.parent_email,
          subject: "Activate Your Parent Portal Account",
          html: `
          <p>Hello ${studentData.parent_name},</p>
          <p>A student account has been created for your child/ward: <strong>${studentData.first_name} ${studentData.last_name}</strong>.</p>
          <p>Student ID: <strong>${generatedStudentId}</strong></p>
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

        if (parentMailError) {
          warnings.push(`Parent activation email was not delivered: ${parentMailError}`);
        }
      }
    }

    if (!isNewParent && existingParent?.is_active) {
      const existingParentMailError = await sendEmailSafe({
        to: studentData.parent_email,
        subject: "New Student Added to Your Account",
        html: `
          <p>Hello ${studentData.parent_name},</p>
          <p>A new student has been added to your parent portal account:</p>
          <p><strong>${studentData.first_name} ${studentData.last_name}</strong> (ID: ${generatedStudentId})</p>
          <p>You can now view their information in your parent portal.</p>
        `,
      });

      if (existingParentMailError) {
        warnings.push(`Parent notification email was not delivered: ${existingParentMailError}`);
      }
    }

    return NextResponse.json({
      success: true,
      studentId: generatedStudentId,
      message: warnings.length > 0
        ? `Student created, but email delivery failed (${warnings.length} issue${warnings.length > 1 ? "s" : ""}).`
        : hasOwnEmail
          ? "Student created. Activation link sent to student email."
          : "Student created. Using parent portal for now.",
      warnings,
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}