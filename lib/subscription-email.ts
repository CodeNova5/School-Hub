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
  emailType: "renewal_reminder" | "payment_failure" | "payment_success"
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
      `— The School Hub Team`,
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
      `— The School Hub Team`,
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
      `— The School Hub Team`,
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
