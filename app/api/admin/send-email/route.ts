export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendEmailSafe, buildSchoolSenderName } from "@/lib/email";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware to check if user is admin
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

    // Get user's school_id
    const { data: schoolId } = await supabase.rpc("get_my_school_id");

    return { authorized: true, user, schoolId };
}

// Function to log email to the database
async function logEmail(
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
    try {
        const { data, error } = await supabaseAdmin
            .from("email_logs")
            .insert({
                title,
                body,
                target,
                target_value: targetValue,
                target_name: targetName,
                success_count: successCount,
                failure_count: failureCount,
                total_recipients: totalRecipients,
                sent_by: sentBy,
                school_id: schoolId
            });

        if (error) {
            console.error("❌ Error logging email to database:", error);
            return false;
        }
        
        console.log("✅ Email logged to database successfully");
        return true;
    } catch (error) {
        console.error("❌ Failed to log email - Exception caught:", error);
        return false;
    }
}

// Function to build email HTML template
function buildEmailTemplate(subject: string, body: string, schoolName?: string): string {
    const brandColor = "#3B82F6";
    const schoolDisplay = schoolName ?? "School Deck";
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${brandColor} 0%, #2563EB 100%); color: white; padding: 32px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700;">${schoolDisplay}</h1>
        </div>

        <!-- Content -->
        <div style="padding: 32px 20px;">
            <h2 style="margin-top: 0; color: #1f2937;">${subject}</h2>
            <div style="color: #4b5563; line-height: 1.8;">
                ${body.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 24px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
                This is a message from ${schoolDisplay}. Please do not reply to this email.
            </p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} ${schoolDisplay}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

// Function to get school name
async function getSchoolName(schoolId: string): Promise<string | null> {
    try {
        const { data } = await supabaseAdmin
            .from("schools")
            .select("name")
            .eq("id", schoolId)
            .single();
        return data?.name || null;
    } catch {
        return null;
    }
}

// Function to fetch recipient emails based on targeting
async function getRecipientEmails(
    target: string,
    targetValue: string | undefined,
    schoolId: string
): Promise<string[]> {
    let emails: string[] = [];

    try {
        if (target === "all") {
            // Get all active users' emails
            const { data: students } = await supabaseAdmin
                .from("students")
                .select("email")
                .eq("school_id", schoolId)
                .eq("is_active", true);

            const { data: teachers } = await supabaseAdmin
                .from("teachers")
                .select("email")
                .eq("school_id", schoolId)
                .eq("is_active", true);

            const { data: parents } = await supabaseAdmin
                .from("parents")
                .select("email")
                .eq("school_id", schoolId)
                .eq("is_active", true);

            emails = [
                ...(students?.map(s => s.email) || []),
                ...(teachers?.map(t => t.email) || []),
                ...(parents?.map(p => p.email) || []),
            ].filter(e => e && e.includes("@"));

        } else if (target === "role") {
            if (targetValue === "student") {
                const { data } = await supabaseAdmin
                    .from("students")
                    .select("email")
                    .eq("school_id", schoolId)
                    .eq("is_active", true);
                emails = data?.map(s => s.email).filter(e => e && e.includes("@")) || [];
            } else if (targetValue === "teacher") {
                const { data } = await supabaseAdmin
                    .from("teachers")
                    .select("email")
                    .eq("school_id", schoolId)
                    .eq("is_active", true);
                emails = data?.map(t => t.email).filter(e => e && e.includes("@")) || [];
            } else if (targetValue === "parent") {
                const { data } = await supabaseAdmin
                    .from("parents")
                    .select("email")
                    .eq("school_id", schoolId)
                    .eq("is_active", true);
                emails = data?.map(p => p.email).filter(e => e && e.includes("@")) || [];
            }
        } else if (target === "class") {
            // Get emails of all students in a specific class
            const { data: classStudents } = await supabaseAdmin
                .from("students")
                .select("email")
                .eq("class_id", targetValue)
                .eq("school_id", schoolId)
                .eq("is_active", true);
            emails = classStudents?.map(s => s.email).filter(e => e && e.includes("@")) || [];

        } else if (target === "multiple_classes") {
            // Get emails of students in multiple classes
            if (Array.isArray(targetValue)) {
                const { data: classStudents } = await supabaseAdmin
                    .from("students")
                    .select("email")
                    .in("class_id", targetValue)
                    .eq("school_id", schoolId)
                    .eq("is_active", true);
                emails = classStudents?.map(s => s.email).filter(e => e && e.includes("@")) || [];
            }

        } else if (target === "class_teachers") {
            // Get all teachers assigned to a specific class
            const { data: classTeachers } = await supabaseAdmin
                .from("class_teachers")
                .select("teacher_id")
                .eq("class_id", targetValue)
                .eq("school_id", schoolId);

            if (classTeachers && classTeachers.length > 0) {
                const teacherIds = classTeachers.map(ct => ct.teacher_id);
                const { data: teachers } = await supabaseAdmin
                    .from("teachers")
                    .select("email")
                    .in("id", teacherIds)
                    .eq("school_id", schoolId)
                    .eq("is_active", true);
                emails = teachers?.map(t => t.email).filter(e => e && e.includes("@")) || [];
            }

        } else if (target === "user") {
            // Get email of a specific user
            const { data: student } = await supabaseAdmin
                .from("students")
                .select("email")
                .eq("id", targetValue)
                .eq("school_id", schoolId)
                .single();

            if (student?.email) {
                emails = [student.email];
            } else {
                const { data: teacher } = await supabaseAdmin
                    .from("teachers")
                    .select("email")
                    .eq("id", targetValue)
                    .eq("school_id", schoolId)
                    .single();

                if (teacher?.email) {
                    emails = [teacher.email];
                } else {
                    const { data: parent } = await supabaseAdmin
                        .from("parents")
                        .select("email")
                        .eq("id", targetValue)
                        .eq("school_id", schoolId)
                        .single();

                    if (parent?.email) {
                        emails = [parent.email];
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error fetching recipient emails:", error);
    }

    return emails;
}

export async function POST(request: NextRequest) {
    try {
        // Check if user is admin
        const authCheck = await checkIsAdmin();

        if (!authCheck.authorized) {
            return NextResponse.json(
                { error: authCheck.error },
                { status: authCheck.status }
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

        const { subject, body, target, targetValue, targetName } = await request.json();

        // Validate required fields
        if (!subject || !body) {
            return NextResponse.json(
                { error: "Subject and body are required" },
                { status: 400 }
            );
        }

        if (!target) {
            return NextResponse.json(
                { error: "Target is required" },
                { status: 400 }
            );
        }

        // Get school name for email branding
        const schoolName = await getSchoolName(schoolId);

        // Get recipient emails
        const recipientEmails = await getRecipientEmails(target, targetValue, schoolId);

        if (recipientEmails.length === 0) {
            return NextResponse.json(
                {
                    success: true,
                    successCount: 0,
                    failureCount: 0,
                    totalRecipients: 0,
                    warning: "No recipients found matching the criteria",
                },
                { status: 200 }
            );
        }

        // Build email template
        const emailHtml = buildEmailTemplate(subject, body, schoolName || undefined);
        const fromName = buildSchoolSenderName(schoolName);

        // Send emails to all recipients
        let successCount = 0;
        let failureCount = 0;

        console.log(`📧 Sending email to ${recipientEmails.length} recipients...`);

        for (const email of recipientEmails) {
            const error = await sendEmailSafe({
                to: email,
                subject: subject,
                html: emailHtml,
                fromName: fromName,
            });

            if (error) {
                console.error(`❌ Failed to send email to ${email}:`, error);
                failureCount++;
            } else {
                console.log(`✅ Email sent to ${email}`);
                successCount++;
            }
        }

        // Log email to database
        await logEmail(
            subject,
            body,
            target,
            targetValue,
            successCount,
            failureCount,
            recipientEmails.length,
            userId || "unknown",
            schoolId,
            targetName
        );

        console.log(`
📊 Email Campaign Summary:
├─ Total Recipients: ${recipientEmails.length}
├─ Successfully Sent: ${successCount}
├─ Failed: ${failureCount}
└─ Success Rate: ${((successCount / recipientEmails.length) * 100).toFixed(1)}%
        `);

        return NextResponse.json(
            {
                success: true,
                successCount,
                failureCount,
                totalRecipients: recipientEmails.length,
                successRate: ((successCount / recipientEmails.length) * 100).toFixed(1),
            },
            { status: 200 }
        );

    } catch (error: any) {
        console.error("❌ Error in send-email endpoint:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to send emails" },
            { status: 500 }
        );
    }
}
