import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface UseNotificationOptions {
  role?: "student" | "teacher" | "parent" | "admin";
}

export const useNotificationSetup = (options?: UseNotificationOptions) => {
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null
  );
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check current permission status
  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission and get FCM token
  const requestNotificationPermission = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check browser support
      if (!("Notification" in window)) {
        setError(
          "Notifications not supported in this browser. iOS users: Add to Home Screen for PWA support."
        );
        return null;
      }

      // Request permission
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== "granted") {
        setError("Notification permission denied");
        return null;
      }

      // Get Firebase messaging
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        setError(
          "Firebase Cloud Messaging not available. iOS users: Add to Home Screen for PWA support."
        );
        return null;
      }

      // Get FCM token - IMPORTANT: Use your public VAPID key here
      const fcmToken = await getToken(messaging, {
        vapidKey: "BEvnsPzvqGc4nrfwtMGILhEQzBNQ5zAtIn7gLQuT48Ix6RJdbWbisZYOz0AeRV7Wc0L6hsn0JlfAPUk63xyM_AA",
      });

      if (!fcmToken) {
        setError("Failed to get notification token");
        return null;
      }

      setToken(fcmToken);

      // Save token to Supabase
      const user = await getCurrentUser();
      if (user) {
        await saveTokenToSupabase(fcmToken, user.id, options?.role);
      }

      return fcmToken;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to setup notifications";
      console.error("Notification setup error:", err);
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Listen for foreground messages
  const setupForegroundMessageHandler = async () => {
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);

        // Get notification details from payload.notification (top-level)
        // or fall back to payload.data fields
        const title =
          payload.notification?.title ||
          payload.data?.title ||
          "Notification";
        const body =
          payload.notification?.body ||
          payload.data?.body ||
          "New notification";
        const icon =
          payload.notification?.image ||
          payload.data?.icon ||
          "/logo.png";

        const notificationOptions: NotificationOptions = {
          body,
          icon,
          badge: "/logo.png",
          tag: payload.data?.tag || "default",
          data: payload.data || {},
        };

        new Notification(title, notificationOptions);
      });
    } catch (err) {
      console.error("Failed to setup foreground message handler:", err);
    }
  };

  // Save token to Supabase
  const saveTokenToSupabase = async (
    fcmToken: string,
    userId: string,
    role?: string
  ) => {
    try {
      // First check if token already exists
      const { data: existingToken } = await supabase
        .from("notification_tokens")
        .select("id")
        .eq("user_id", userId)
        .eq("token", fcmToken)
        .single();

      if (existingToken) {
        // Update last_registered_at
        await supabase
          .from("notification_tokens")
          .update({
            last_registered_at: new Date().toISOString(),
            is_active: true,
          })
          .eq("id", existingToken.id);
      } else {
        // Insert new token
        const { error } = await supabase.from("notification_tokens").insert({
          user_id: userId,
          token: fcmToken,
          role: role || "user",
          device_type: getDeviceType(),
          is_active: true,
          created_at: new Date().toISOString(),
          last_registered_at: new Date().toISOString(),
        });

        if (error) {
          console.error("Error saving token to Supabase:", error);
        }
      }
    } catch (err) {
      console.error("Error saving token to Supabase:", err);
    }
  };

  // Get device type
  const getDeviceType = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return "ios";
    if (/android/.test(ua)) return "android";
    if (/windows/.test(ua)) return "windows";
    if (/macintosh/.test(ua)) return "macos";
    if (/linux/.test(ua)) return "linux";
    return "unknown";
  };

  return {
    permission,
    token,
    loading,
    error,
    requestNotificationPermission,
    setupForegroundMessageHandler,
  };
};
