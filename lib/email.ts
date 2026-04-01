import { Resend } from "resend";

export const PLATFORM_NAME = "School Deck";
const DEFAULT_FROM_EMAIL = "noreply@mail.schooldeck.tech";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email not configured (missing RESEND_API_KEY).");
  }

  return new Resend(apiKey);
}

function formatFromAddress(fromName: string, fromEmail: string): string {
  return `${fromName} <${fromEmail}>`;
}

export function buildSchoolSenderName(schoolName?: string | null, team?: string): string {
  const baseName = schoolName?.trim() || PLATFORM_NAME;
  return team ? `${baseName} ${team}` : baseName;
}

export async function sendEmailSafe(payload: EmailPayload): Promise<string | null> {
  try {
    const resend = getResendClient();
    const fromEmail = payload.fromEmail || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
    const fromName = payload.fromName || process.env.RESEND_FROM_NAME || PLATFORM_NAME;

    const { error } = await resend.emails.send({
      from: formatFromAddress(fromName, fromEmail),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    if (error) {
      return error.message || "Unknown email delivery error";
    }

    return null;
  } catch (error: any) {
    console.error("Email delivery failed:", error);
    return error?.message || "Unknown email delivery error";
  }
}
