import { supabase } from "@/lib/supabase";

interface SendNotificationPayload {
  token?: string;
  userId?: string;
  role?: string;
  title: string;
  body: string;
  imageUrl?: string;
  link?: string;
  data?: Record<string, string>;
}

/**
 * Get all active tokens for a user
 */
export async function getUserTokens(
  userId: string,
  onlyActive: boolean = true
) {
  try {
    let query = supabase
      .from("notification_tokens")
      .select("token, device_type, created_at");

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (onlyActive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting user tokens:", error);
    return [];
  }
}

/**
 * Get tokens by role
 */
export async function getTokensByRole(
  role: string,
  limit?: number
) {
  try {
    let query = supabase
      .from("notification_tokens")
      .select("token, user_id, device_type")
      .eq("role", role)
      .eq("is_active", true);

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting tokens by role:", error);
    return [];
  }
}

/**
 * Get tokens for a class
 */
export async function getTokensByClass(classId: string) {
  try {
    const { data, error } = await supabase.rpc(
      "get_class_notification_tokens",
      { class_id: classId }
    );

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting class tokens:", error);
    return [];
  }
}

/**
 * Mark token as inactive
 */
export async function deactivateToken(token: string) {
  try {
    const { error } = await supabase
      .from("notification_tokens")
      .update({ is_active: false })
      .eq("token", token);

    if (error) throw error;
  } catch (error) {
    console.error("Error deactivating token:", error);
  }
}

/**
 * Clean up old inactive tokens (older than 30 days)
 */
export async function cleanupOldTokens(daysOld: number = 30) {
  try {
    const cutoffDate = new Date(
      Date.now() - daysOld * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error } = await supabase
      .from("notification_tokens")
      .delete()
      .eq("is_active", false)
      .lt("last_registered_at", cutoffDate);

    if (error) throw error;
    console.log(`Cleaned up tokens older than ${daysOld} days`);
  } catch (error) {
    console.error("Error cleaning up tokens:", error);
  }
}

/**
 * Get notification statistics
 */
export async function getNotificationStats() {
  try {
    const { data: totalTokens } = await supabase
      .from("notification_tokens")
      .select("id", { count: "exact" });

    const { data: activeTokens } = await supabase
      .from("notification_tokens")
      .select("id", { count: "exact" })
      .eq("is_active", true);

    const { data: byRole } = await supabase
      .from("notification_tokens")
      .select("role");

    const { data: byDevice } = await supabase
      .from("notification_tokens")
      .select("device_type");

    const roleCount: Record<string, number> = {};
    const deviceCount: Record<string, number> = {};

    byRole?.forEach((item: any) => {
      roleCount[item.role] = (roleCount[item.role] || 0) + 1;
    });

    byDevice?.forEach((item: any) => {
      deviceCount[item.device_type] =
        (deviceCount[item.device_type] || 0) + 1;
    });

    return {
      totalTokens: totalTokens?.length || 0,
      activeTokens: activeTokens?.length || 0,
      byRole: roleCount,
      byDevice: deviceCount,
    };
  } catch (error) {
    console.error("Error getting notification stats:", error);
    return null;
  }
}

/**
 * Check if user has notification permission granted
 */
export function hasNotificationPermission(): boolean {
  if (typeof window === "undefined") return false;
  return Notification.permission === "granted";
}

/**
 * Format FCM payload for sending
 */
export function formatFCMPayload(payload: SendNotificationPayload) {
  return {
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.imageUrl && { image: payload.imageUrl }),
    },
    data: {
      type: payload.data?.type || "general",
      link: payload.link || "/",
      timestamp: new Date().toISOString(),
      ...payload.data,
    },
  };
}

/**
 * Get device type from user agent
 */
export function getDeviceType(): string {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/windows/.test(ua)) return "windows";
  if (/macintosh/.test(ua)) return "macos";
  if (/linux/.test(ua)) return "linux";
  return "unknown";
}
