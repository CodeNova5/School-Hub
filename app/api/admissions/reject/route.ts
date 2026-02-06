import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabase = createRouteHandlerClient({ cookies });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware to check if user is admin

// Middleware to check if user is admin
async function checkIsAdmin() {
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
    // Verify admin authentication
    const authCheck = await checkIsAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json( 
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { applicationId, reason } = await req.json();

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
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        notes: reason || application.notes,
      })
      .eq("id", applicationId);

    if (updateError) throw updateError;

    // Send rejection email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"School Hub Admissions" <${process.env.EMAIL_USER}>`,
      to: application.parent_email,
      subject: "Application Status Update - School Hub",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #64748b;">Application Status Update</h2>
          
          <p>Dear ${application.parent_name},</p>
          
          <p>Thank you for your interest in School Hub and for submitting an admission application for <strong>${application.first_name} ${application.last_name}</strong>.</p>
          
          <p>After careful review, we regret to inform you that we are unable to offer admission at this time.</p>
          
          ${reason ? `
          <div style="background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold;">Reason:</p>
            <p style="margin: 5px 0;">${reason}</p>
          </div>
          ` : ''}
          
          <p>We appreciate your interest in our school and wish ${application.first_name} all the best in their educational journey.</p>
          
          <p>If you have any questions or would like to discuss this decision, please feel free to contact our admissions office.</p>
          
          <p>Best regards,<br>
          <strong>School Hub Admissions Team</strong></p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Application rejected successfully",
    });
  } catch (error: any) {
    console.error("Error rejecting application:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reject application" },
      { status: 500 }
    );
  }
}
