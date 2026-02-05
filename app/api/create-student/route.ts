import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Generate unique student ID
    const generatedStudentId = await generateUniqueStudentId();

    // Determine if student has their own email or using parent's
    const hasOwnEmail = studentData.email && studentData.email.trim() !== '';
    const studentEmail = hasOwnEmail ? studentData.email : studentData.parent_email;
    const studentIsActive = !hasOwnEmail; // Only active if no own email (using parent's)

    // 1️⃣ Create auth user for student
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: studentEmail,
      password: crypto.randomUUID(),
      email_confirm: hasOwnEmail ? false : true, // Confirm if using parent email
      user_metadata: {
        role: "student",
        student_id: generatedStudentId,
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
      department: studentData.department || null,
      parent_name: studentData.parent_name,
      parent_email: studentData.parent_email,
      parent_phone: studentData.parent_phone || null,
      admission_date: studentData.admission_date,
      student_id: generatedStudentId,
      user_id: authData.user.id,
      is_active: studentIsActive,
      status: "active",
    };

    const { data: createdStudent, error: studentError } = await supabase
      .from("students")
      .insert(studentInsertData)
      .select()
      .single();

    if (studentError) throw studentError;

    // 3.5️⃣ If student has own email, generate and send activation code
    if (hasOwnEmail) {
      const activationCode = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char code
      const codeHash = crypto
        .createHash("sha256")
        .update(activationCode)
        .digest("hex");

      // Store activation code in students table
      await supabase
        .from("students")
        .update({
          activation_code_hash: codeHash,
          activation_code_expires_at: new Date(Date.now() + 3600000), // 1 hour expiry
        })
        .eq("user_id", authData.user.id);

      // Send activation code email to student
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"School Hub" <${process.env.EMAIL_USER}>`,
        to: studentData.email,
        subject: "Activate Your Student Account",
        html: `
          <p>Hello ${studentData.first_name},</p>
          <p>Your student account has been created in the School Hub system.</p>
          <p>Student ID: <strong>${generatedStudentId}</strong></p>
          <p>Enter the activation code below to activate your account:</p>
          <p style="font-size: 24px; font-weight: bold; color: #2563eb; letter-spacing: 2px;">
            ${activationCode}
          </p>
          <p>
            Or click the link below to activate your account and set your password:
            <br/>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/student/activate?code=${activationCode}&email=${encodeURIComponent(studentData.email)}" style="color:#2563eb;">
              Activate Student Account
            </a>
          </p>
          <p>This code expires in 1 hour.</p>
          <p>Once activated, you'll be able to access assignments, grades, attendance, and more.</p>
        `,
      });
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
            department,
            religion,
            is_optional
          )
        `)
        .eq("class_id", studentData.class_id);

      if (!subjectClassesError && subjectClassesData) {
        const eligibleSubjectClasses = subjectClassesData.filter((sc: any) => {
          const subject = Array.isArray(sc.subjects) ? sc.subjects[0] : sc.subjects;

          if (subject.department && studentData.department) {
            if (subject.department !== studentData.department) {
              return false;
            }
          }

          if (subject.religion && studentData.religion) {
            if (subject.religion !== studentData.religion) {
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

    // 4️⃣ Notify parent if new student added to existing account
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
          <p><strong>${studentData.first_name} ${studentData.last_name}</strong> (ID: ${generatedStudentId})</p>
          <p>You can now view their information in your parent portal.</p>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      studentId: generatedStudentId,
      message: hasOwnEmail ? "Student created. Activation code sent to student email." : "Student created. Using parent portal for now."
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}