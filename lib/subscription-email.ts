import { EMAIL_SENDER_TEAM, EMAIL_SENDER_SYSTEM, APP_NAME } from "@/data";
import { sendEmailSafe, buildSchoolSenderName } from "@/lib/email";
import { buildEmailTemplate } from "@/lib/email-templates";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  if (cents <= 0) return "Free";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface SchoolSubscriptionInfo {
  school_id: string;
  school_name: string;
  school_email: string;
  admin_email: string;
  plan_key: string;
  plan_name: string;
  billing_interval: string;
  amount: number;
  next_billing_date: string | null;
  period_end: string | null;
  auth_code: string | null;
  status: string;
}

/**
 * Fetch subscription info for a school, including the admin email to send to.
 */
async function getSubscriptionInfo(schoolId: string): Promise<SchoolSubscriptionInfo | null> {
  // Get school info + subscription
  const { data: sub } = await supabaseAdmin
    .rpc("get_school_subscription", { p_school_id: schoolId });

  // Check if sub has results (it might return an array from the RPC)
  const subscription = Array.isArray(sub) ? sub[0] : sub;
  if (!subscription) {
    // Still try to get basic school info even without subscription record
    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("id, name, email, plan")
      .eq("id", schoolId)
      .single();

    if (!school) return null;

    return {
      school_id: school.id,
      school_name: school.name,
      school_email: school.email || "",
      admin_email: "",
      plan_key: school.plan,
      plan_name: school.plan,
      billing_interval: "termly",
      amount: 0,
      next_billing_date: null,
      period_end: null,
      auth_code: null,
      status: "unknown",
    };
  }

  // Get admin email to send to
  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("email, name")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  // Get the school name
  const { data: school } = await supabaseAdmin
    .from("schools")
    .select("name, email")
    .eq("id", schoolId)
    .single();

  return {
    school_id: schoolId,
    school_name: school?.name || subscription.plan_name || "School",
    school_email: school?.email || "",
    admin_email: admin?.email || "",
    plan_key: subscription.plan_key,
    plan_name: subscription.plan_name,
    billing_interval: subscription.billing_interval,
    amount: subscription.billing_interval === "termly"
      ? (subscription.termly_price || 0)
      : (subscription.yearly_price || 0),
    next_billing_date: subscription.next_billing_date || null,
    period_end: subscription.current_period_end || null,
    auth_code: subscription.auth_code || null,
    status: subscription.status,
  };
}

/**
 * Log an email to the email_logs table for tracking.
 */
async function logSubscriptionEmail(
  schoolId: string,
  subject: string,
  body: string,
  recipientEmail: string,
  emailType: "renewal_reminder" | "payment_failure" | "payment_success" | "downgraded"
): Promise<void> {
  try {
    await supabaseAdmin
      .from("email_logs")
      .insert({
        school_id: schoolId,
        title: subject,
        body,
        target: "user",
        target_value: recipientEmail,
        target_name: emailType,
        success_count: 1,
        failure_count: 0,
        total_recipients: 1,
        sent_by: "00000000-0000-0000-0000-000000000000", // System-generated
      });
  } catch (err) {
    console.error(`Failed to log subscription email for school ${schoolId}:`, err);
  }
}

// ============================================================================
// Email #1: Renewal Reminder (sent T-7 days before next_billing_date)
// ============================================================================

export async function sendRenewalReminder(schoolId: string): Promise<string | null> {
  try {
    const info = await getSubscriptionInfo(schoolId);
    if (!info) return "School not found";

    const recipientEmail = info.admin_email || info.school_email;
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return `No valid admin email for school ${schoolId}`;
    }

    const price = formatPrice(info.amount);
    const nextBilling = info.next_billing_date
      ? formatDate(info.next_billing_date)
      : "soon";

    const subject = `Your ${info.plan_name} Subscription Renewal — ${info.school_name}`;

    const body = [
      `Dear Administrator,`,
      ``,
      `This is a reminder that your **${info.plan_name}** subscription for **${info.school_name}** is due for renewal.`,
      ``,
      `━━━ Renewal Summary ━━━`,
      `Plan: ${info.plan_name} (${info.billing_interval === "termly" ? "Per Term" : "Yearly"})`,
      `Amount: ${price}`,
      `Scheduled: ${nextBilling}`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `If you have a saved payment method on file, the amount will be charged automatically on the scheduled date. No action is needed from you.`,
      ``,
      `If you need to update your payment method, please log in to your dashboard and visit the Subscription settings page.`,
      ``,
      `Thank you for choosing ${info.school_name}.`,
      `${EMAIL_SENDER_TEAM}`,
    ].join("\n");

    const html = buildEmailTemplate(subject, body, info.school_name);
    const fromName = buildSchoolSenderName(info.school_name, "Billing");

    const error = await sendEmailSafe({
      to: recipientEmail,
      subject,
      html,
      fromName,
    });

    if (error) {
      console.error(`Failed to send renewal reminder to ${recipientEmail}:`, error);
    } else {
      console.log(`✅ Renewal reminder sent to ${recipientEmail} for school ${schoolId}`);
      await logSubscriptionEmail(schoolId, subject, body, recipientEmail, "renewal_reminder");
    }

    return error;
  } catch (err: any) {
    console.error(`Error sending renewal reminder for school ${schoolId}:`, err.message);
    return err.message || "Unknown error";
  }
}

// ============================================================================
// Email #2: Payment Failure Alert (sent after a failed charge_authorization)
// ============================================================================

export async function sendPaymentFailureAlert(
  schoolId: string,
  gatewayResponse: string
): Promise<string | null> {
  try {
    const info = await getSubscriptionInfo(schoolId);
    if (!info) return "School not found";

    const recipientEmail = info.admin_email || info.school_email;
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return `No valid admin email for school ${schoolId}`;
    }

    const price = formatPrice(info.amount);
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + 7); // 7-day grace period

    const subject = `⚠️ Payment Failed — ${info.plan_name} Subscription — ${info.school_name}`;

    const body = [
      `Dear Administrator,`,
      ``,
      `We were unable to process the automatic payment for your **${info.plan_name}** subscription for **${info.school_name}**.`,
      ``,
      `━━━ Payment Details ━━━`,
      `Plan: ${info.plan_name} (${info.billing_interval === "termly" ? "Per Term" : "Yearly"})`,
      `Amount: ${price}`,
      `Reason: ${gatewayResponse}`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `⚠️ **Action Required:** Your subscription is now in a grace period.`,
      ``,
      `If payment is not completed within **7 days** (by ${formatDate(graceEnd)}), some features may be restricted to keep your school running on essential functions.`,
      ``,
      `🔧 **What to do:**`,
      `1. Log in to your school dashboard`,
      `2. Go to Settings → Subscription`,
      `3. Update your payment method or retry the payment`,
      ``,
      `If you need assistance, please contact our support team.`,
      ``,
      `Thank you,`,
      `${EMAIL_SENDER_TEAM}`,
    ].join("\n");

    const html = buildEmailTemplate(subject, body, info.school_name);
    const fromName = buildSchoolSenderName(info.school_name, "Billing");

    const error = await sendEmailSafe({
      to: recipientEmail,
      subject,
      html,
      fromName,
    });

    if (error) {
      console.error(`Failed to send payment failure alert to ${recipientEmail}:`, error);
    } else {
      console.log(`✅ Payment failure alert sent to ${recipientEmail} for school ${schoolId}`);
      await logSubscriptionEmail(schoolId, subject, body, recipientEmail, "payment_failure");
    }

    return error;
  } catch (err: any) {
    console.error(`Error sending payment failure alert for school ${schoolId}:`, err.message);
    return err.message || "Unknown error";
  }
}

// ============================================================================
// Email #3: Payment Success Confirmation (optional, sent after successful cron charge)
// ============================================================================

// ============================================================================
// Email #4: Subscription Downgraded Alert (sent after grace period expires)
// ============================================================================

export async function sendSubscriptionDowngradedAlert(
  schoolId: string
): Promise<string | null> {
  try {
    const info = await getSubscriptionInfo(schoolId);
    if (!info) return "School not found";

    const recipientEmail = info.admin_email || info.school_email;
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return `No valid admin email for school ${schoolId}`;
    }

    const previousPlan = info.plan_name;

    const subject = `ℹ️ Subscription Downgraded — ${info.school_name} is now on the Basic Plan`;

    const body = [
      `Dear Administrator,`,
      ``,
      `Your **${previousPlan}** subscription for **${info.school_name}** has been downgraded to the **Basic plan** because the grace period for your outstanding payment has expired.`,
      ``,
      `━━━ What this means ━━━`,
      `• Your previous plan: ${previousPlan}`,
      `• Current plan: Basic (Free)`,
      `• Paid features (finance, payroll, JAMB, AI, etc.) are now locked`,
      `• Core school operations (students, classes, attendance) remain available`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🔧 **To restore your ${previousPlan} features:**`,
      `1. Log in to your dashboard`,
      `2. Go to the Subscription page`,
      `3. Renew your plan with an updated payment method`,
      ``,
      `If you have any questions or need assistance, please contact our support team.`,
      ``,
      `Thank you,`,
      `${EMAIL_SENDER_TEAM}`,
    ].join("\n");

    const html = buildEmailTemplate(subject, body, info.school_name);
    const fromName = buildSchoolSenderName(info.school_name, "Billing");

    const error = await sendEmailSafe({
      to: recipientEmail,
      subject,
      html,
      fromName,
    });

    if (error) {
      console.error(`Failed to send downgrade alert to ${recipientEmail}:`, error);
    } else {
      console.log(`✅ Downgrade alert sent to ${recipientEmail} for school ${schoolId}`);
      await logSubscriptionEmail(schoolId, subject, body, recipientEmail, "downgraded");
    }

    return error;
  } catch (err: any) {
    console.error(`Error sending downgrade alert for school ${schoolId}:`, err.message);
    return err.message || "Unknown error";
  }
}

// ============================================================================
// Email #5: Super Admin At-Risk Alert (sent when a subscription enters past_due)
// ============================================================================

/**
 * Fetch all super admin email addresses for alerting.
 */
async function getSuperAdminEmails(): Promise<string[]> {
  try {
    // Super admins have school_id = NULL in the admins table
    const { data: admins } = await supabaseAdmin
      .from("admins")
      .select("email")
      .is("school_id", null)
      .eq("is_active", true);
    return (admins ?? []).map((a) => a.email).filter(Boolean);
  } catch (err) {
    console.error("Failed to fetch super admin emails:", err);
    return [];
  }
}

/**
 * Notify super admins when a school's subscription transitions to past_due.
 * Accepts just schoolId, consistent with the other subscription email functions.
 */
export async function sendSuperAdminAtRiskAlert(schoolId: string): Promise<void> {
  try {
    const info = await getSubscriptionInfo(schoolId);
    if (!info) {
      console.warn(`No subscription info found for school ${schoolId} — skipping at-risk alert`);
      return;
    }

    const emails = await getSuperAdminEmails();
    if (emails.length === 0) {
      console.warn(`No super admin emails found — skipping at-risk alert for ${info.school_name}`);
      return;
    }

    const price = formatPrice(info.amount);
    const formattedDate = formatDate(new Date());

    const subject = `🚨 At-Risk: ${info.school_name} — ${info.plan_name} payment failed (${formattedDate})`;

    const body = [
      `⚠️ **Subscription at risk** — ${info.school_name}`,
      ``,
      `━━━ School Details ━━━`,
      `School: ${info.school_name}`,
      `Plan: ${info.plan_name}`,
      `Amount Due: ${price}`,
      `Status: Past Due`,
      `Date: ${formattedDate}`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `This school's subscription payment has failed. They are now in a **7-day grace period**.`,
      ``,
      `🔧 **Actions needed:**`,
      `• Log in to the super admin panel → Subscriptions`,
      `• Review the school's payment status and history`,
      `• Use the "Charge Now" button to retry payment`,
      `• Contact the school admin if needed`,
      ``,
      `If payment is not received within 7 days, the school will be automatically downgraded to the Basic plan.`,
      ``,
      `${EMAIL_SENDER_SYSTEM}`,
    ].join("\n");

    const html = buildEmailTemplate(subject, body, "Super Admin");
    const fromName = buildSchoolSenderName(APP_NAME, "System");

    // Send to each super admin sequentially
    for (const email of emails) {
      try {
        const error = await sendEmailSafe({
          to: email,
          subject,
          html,
          fromName,
        });

        if (error) {
          console.error(`Failed to send at-risk alert to super admin ${email}:`, error);
        } else {
          console.log(`✅ At-risk alert sent to super admin ${email} for school ${info.school_name}`);
        }
      } catch (err) {
        console.error(`Error sending at-risk alert to super admin ${email}:`, err);
      }
    }

    // Log the email
    try {
      await supabaseAdmin
        .from("email_logs")
        .insert({
          school_id: schoolId,
          title: subject,
          body,
          target: "super_admin",
          target_value: emails.join(", "),
          target_name: "at_risk_alert",
          success_count: 1,
          failure_count: 0,
          total_recipients: emails.length,
          sent_by: "00000000-0000-0000-0000-000000000000",
        });
    } catch (err) {
      console.error("Failed to log at-risk alert email:", err);
    }
  } catch (err: any) {
    console.error(`Error sending super admin at-risk alert for school ${schoolId}:`, err.message);
  }
}

// ============================================================================
// Email #6: Grant Expiry Reminder (sent T-7 days before a plan grant expires)
// ============================================================================

export async function sendGrantExpiryReminder(
  schoolId: string,
  planName: string,
  expiresAt: string
): Promise<string | null> {
  try {
    const info = await getSubscriptionInfo(schoolId);
    if (!info) return "School not found";

    const recipientEmail = info.admin_email || info.school_email;
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return `No valid admin email for school ${schoolId}`;
    }

    const expiryDate = formatDate(expiresAt);
    const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const subject = `⏳ ${planName} Plan Grant Expiring Soon — ${info.school_name}`;

    const body = [
      `Dear Administrator,`,
      ``,
      `This is a reminder that the **${planName}** plan grant for **${info.school_name}** is expiring soon.`,
      ``,
      `━━━ Grant Summary ━━━`,
      `Plan: ${planName}`,
      `Grant Expires: ${expiryDate}`,
      `Days Remaining: ${daysLeft}`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      daysLeft <= 3
        ? `⚠️ **Urgent:** Your plan grant expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. After expiration, your school will be downgraded to the Basic plan and paid features will be locked.`
        : `Your plan grant will expire on ${expiryDate}. After expiration, your school will be downgraded to the Basic plan and paid features will be locked.`,
      ``,
      `🔧 **To retain your ${planName} features:**`,
      `1. Contact the school administration to arrange payment for plan renewal`,
      `2. Once payment is confirmed, a new grant will be applied to your account`,
      ``,
      `If you have any questions, please reach out to your school's administrative office.`,
      ``,
      `Thank you,`,
      `${EMAIL_SENDER_TEAM}`,
    ].join("\n");

    const html = buildEmailTemplate(subject, body, info.school_name);
    const fromName = buildSchoolSenderName(info.school_name, "Billing");

    const error = await sendEmailSafe({
      to: recipientEmail,
      subject,
      html,
      fromName,
    });

    if (error) {
      console.error(`Failed to send grant expiry reminder to ${recipientEmail}:`, error);
    } else {
      console.log(`✅ Grant expiry reminder sent to ${recipientEmail} for school ${schoolId}`);
      await logSubscriptionEmail(schoolId, subject, body, recipientEmail, "renewal_reminder");
    }

    return error;
  } catch (err: any) {
    console.error(`Error sending grant expiry reminder for school ${schoolId}:`, err.message);
    return err.message || "Unknown error";
  }
}

export async function sendPaymentSuccessConfirmation(
  schoolId: string
): Promise<string | null> {
  try {
    const info = await getSubscriptionInfo(schoolId);
    if (!info) return "School not found";

    const recipientEmail = info.admin_email || info.school_email;
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return `No valid admin email for school ${schoolId}`;
    }

    const price = formatPrice(info.amount);
    const periodEnd = info.period_end ? formatDate(info.period_end) : "the next billing date";

    const subject = `✅ Payment Received — ${info.plan_name} Subscription — ${info.school_name}`;

    const body = [
      `Dear Administrator,`,
      ``,
      `Great news! Your **${info.plan_name}** subscription payment for **${info.school_name}** has been successfully processed.`,
      ``,
      `━━━ Payment Receipt ━━━`,
      `Plan: ${info.plan_name} (${info.billing_interval === "termly" ? "Per Term" : "Yearly"})`,
      `Amount: ${price}`,
      `Valid until: ${periodEnd}`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Your subscription is now active and all features are available. No further action is needed.`,
      ``,
      `Thank you for being a valued member of ${info.school_name}.`,
      `${EMAIL_SENDER_TEAM}`,
    ].join("\n");

    const html = buildEmailTemplate(subject, body, info.school_name);
    const fromName = buildSchoolSenderName(info.school_name, "Billing");

    const error = await sendEmailSafe({
      to: recipientEmail,
      subject,
      html,
      fromName,
    });

    if (error) {
      console.error(`Failed to send payment confirmation to ${recipientEmail}:`, error);
    } else {
      console.log(`✅ Payment confirmation sent to ${recipientEmail} for school ${schoolId}`);
      await logSubscriptionEmail(schoolId, subject, body, recipientEmail, "payment_success");
    }

    return error;
  } catch (err: any) {
    console.error(`Error sending payment confirmation for school ${schoolId}:`, err.message);
    return err.message || "Unknown error";
  }
}
