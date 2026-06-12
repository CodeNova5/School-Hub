/**
 * Meta WhatsApp Cloud API integration helper.
 *
 * Handles E.164 phone number normalization and message delivery
 * via the WhatsApp Business Platform Cloud API.
 *
 * Env vars required (server-side only):
 *   META_WHATSAPP_TOKEN               – Permanent or temporary access token
 *   META_WHATSAPP_PHONE_NUMBER_ID     – The sender phone number ID (15-digit)
 *   META_WHATSAPP_BUSINESS_ACCOUNT_ID – WABA ID (used for validation, optional)
 */

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Normalise a phone number to E.164 format.
 * Strips non-digits, then prepends countryCode if the number
 * still has a leading zero (local format).
 */
export function normalizeToE164(
  raw: string,
  defaultCountryCode = "234"
): string | null {
  if (!raw) return null;

  // Strip everything except digits and a leading +
  const stripped = raw.replace(/[^\d+]/g, "");

  // Already fully international (e.g. +2348012345678)
  if (stripped.startsWith("+")) {
    const digits = stripped.slice(1);
    return digits.length >= 7 ? digits : null;
  }

  // Has country code without '+' (e.g. 2348012345678)
  if (stripped.startsWith(defaultCountryCode)) {
    return stripped.length >= 7 ? stripped : null;
  }

  // Local format (e.g. 08012345678 → 2348012345678)
  if (stripped.startsWith("0")) {
    const normalized = defaultCountryCode + stripped.slice(1);
    return normalized.length >= 7 ? normalized : null;
  }

  // Bare national digits without leading zero (e.g. 8012345678)
  if (stripped.length >= 7) {
    return defaultCountryCode + stripped;
  }

  return null;
}

/**
 * Send a single WhatsApp text message to one recipient.
 * Returns null on success, or an error message string on failure.
 */
export async function sendWhatsAppMessage(
  toPhone: string,
  messageBody: string
): Promise<string | null> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return "WhatsApp not configured: missing META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID.";
  }

  const e164 = normalizeToE164(toPhone);
  if (!e164) {
    return `Invalid phone number: "${toPhone}" could not be normalized to E.164.`;
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: e164,
    type: "text",
    text: {
      preview_url: false,
      body: messageBody,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        detail =
          errBody?.error?.message ||
          errBody?.error?.error_data?.details ||
          detail;
      } catch {
        // ignore JSON parse error
      }
      return `WhatsApp API error: ${detail}`;
    }

    return null; // success
  } catch (err: any) {
    return err?.message ?? "Unknown WhatsApp delivery error";
  }
}

/**
 * Send a WhatsApp message to multiple E.164 phone numbers.
 * Delivers in parallel (concurrency-limited to 10 at a time).
 */
export async function sendWhatsAppToMany(
  phones: string[],
  messageBody: string
): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
  const CONCURRENCY = 10;
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < phones.length; i += CONCURRENCY) {
    const batch = phones.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((phone) => sendWhatsAppMessage(phone, messageBody))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === null) {
          successCount++;
        } else {
          failureCount++;
          errors.push(result.value);
        }
      } else {
        failureCount++;
        errors.push(result.reason?.message ?? "Unknown error");
      }
    }
  }

  return { successCount, failureCount, errors };
}
