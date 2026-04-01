import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { buildSchoolSenderName, sendEmailSafe } from "@/lib/email";
import { resolveSchoolName } from "@/lib/school-branding";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// Middleware to check if user is admin
async function checkIsAdmin(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true };
}


export async function POST(req: Request) {
  try {
    // Initialize Supabase client inside the request handler
    const supabase = createRouteHandlerClient({ cookies });

    // Verify admin authentication
    const authCheck = await checkIsAdmin(supabase);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { applicationId, classId, department, religion } = await req.json();

    // Resolve the school_id of the approving admin to forward to create-student
    const { data: schoolId } = await supabase.rpc("get_my_school_id");

    // Get application details
    const { data: application, error: fetchError } = await supabaseAdmin
      .from("admissions")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (fetchError || !application) {
      throw new Error("Application not found");
    }

    if (application.status !== "pending") {
      throw new Error("Application has already been processed");
    }

    // Update application status
    const { error: updateError } = await supabaseAdmin
      .from("admissions")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (updateError) throw updateError;

    // Create student using the create-student API
    const studentData = {
      first_name: application.first_name,
      last_name: application.last_name,
      email: application.email,
      phone: application.phone,
      date_of_birth: application.date_of_birth,
      gender: application.gender,
      address: application.address,
      parent_name: application.parent_name,
      parent_email: application.parent_email,
      parent_phone: application.parent_phone,
      class_id: classId,
      department: department || null,
      religion: religion || null,
      admission_date: new Date().toISOString().split("T")[0],
      school_id: schoolId ?? undefined,
    };

    // Call create-student API
    const createStudentResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/create-student`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentData),
      }
    );

    const createStudentResult = await createStudentResponse.json();

    if (!createStudentResponse.ok) {
      throw new Error(createStudentResult.error || "Failed to create student");
    }

    const schoolName = await resolveSchoolName(
      supabaseAdmin,
      application.school_id || schoolId
    );

    await sendEmailSafe({
      to: application.parent_email,
      fromName: buildSchoolSenderName(schoolName, "Admissions"),
      subject: `Application Approved - Welcome to ${schoolName}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">🎉 Application Approved!</h2>
          
          <p>Dear ${application.parent_name},</p>
          
          <p>Congratulations! We are pleased to inform you that the admission application for <strong>${application.first_name} ${application.last_name}</strong> has been approved.</p>
          
          <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Student ID:</strong></p>
            <p style="font-size: 20px; font-weight: bold; color: #059669; margin: 5px 0;">${createStudentResult.studentId}</p>
          </div>
          
          <h3>Next Steps:</h3>
          <ol style="line-height: 1.8;">
            <li>Check your email for parent portal activation instructions</li>
            <li>Activate your parent portal account to access student information</li>
            <li>Complete any additional registration requirements as needed</li>
            <li>Contact the school for orientation schedule and other details</li>
          </ol>
          
          <p>Welcome to our school community! We look forward to partnering with you in your child's educational journey.</p>
          
          <p>Best regards,<br>
          <strong>${schoolName} Admissions Team</strong></p>
          <p style="color: #666; font-size: 12px;">Powered by School Deck.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      studentId: createStudentResult.studentId,
      message: "Application approved and student created successfully",
    });
  } catch (error: any) {
    console.error("Error approving application:", error);
    return NextResponse.json(
      { error: error.message || "Failed to approve application" },
      { status: 500 }
    );
  }
}