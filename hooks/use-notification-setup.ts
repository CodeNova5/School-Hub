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

  // Listen for foreground messages - setup globally to persist
  const setupForegroundMessageHandler = async () => {
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      // Setup handler - this will persist even if component unmounts
      onMessage(messaging, (payload) => {
        console.log("✓ Foreground message received:", payload);

        // Firebase webpush puts notification data in payload.notification
        // Data fields are in payload.data
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
          payload.data?.imageUrl ||
          payload.data?.icon ||
          "/logo.png";

        const notificationOptions: NotificationOptions = {
          body,
          icon,
          badge: "/logo.png",
          tag: payload.data?.tag || "notification",
          data: payload.data || {},
          requireInteraction: true, // Keep notification visible until user interacts
        };

        // Show notification to user
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, notificationOptions);
          console.log("✓ Foreground notification displayed:", title);
        }
      });
      
      console.log("✓ Foreground message handler setup successful");
    } catch (err) {
      console.error("Failed to setup foreground message handler:", err);
    }
  };

  // Automatically setup foreground handler when permission changes
  useEffect(() => {
    if (permission === "granted") {
      setupForegroundMessageHandler();
      setupNotificationClickHandler();
    }
  }, [permission]);

  // Setup notification click handler for foreground notifications
  const setupNotificationClickHandler = () => {
    // This just needs to run once globally
    if (typeof window !== "undefined" && "Notification" in window) {
      // Remove old listener and add new one to avoid duplicates
      if ((window as any).notificationClickHandlerActive) {
        return;
      }
      (window as any).notificationClickHandlerActive = true;

      // Listen for notification clicks
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data && event.data.type === "NOTIFICATION_CLICK") {
            const link = event.data.link || "/";
            window.open(link, "_self");
          }
        });
      }
    }
  };

  // Sync notification token on app load (auto-sync if permission already granted)
  const syncNotificationToken = async (userId: string, role?: string) => {
    try {
      // Only sync if permission is already granted
      if (Notification.permission !== "granted") {
        console.log("Notification permission not granted, skipping token sync");
        return null;
      }

      // Get Firebase messaging
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.log("Firebase Cloud Messaging not available");
        return null;
      }

      // Get FCM token
      const fcmToken = await getToken(messaging, {
        vapidKey: "BEvnsPzvqGc4nrfwtMGILhEQzBNQ5zAtIn7gLQuT48Ix6RJdbWbisZYOz0AeRV7Wc0L6hsn0JlfAPUk63xyM_AA",
      });

      if (!fcmToken) {
        console.log("Failed to get notification token");
        return null;
      }

      setToken(fcmToken);

      // Save/update token in Supabase
      await saveTokenToSupabase(fcmToken, userId, role);

      console.log("✓ Notification token synced successfully");
      return fcmToken;
    } catch (err) {
      // Don't set error here as this is a silent sync
      console.error("Failed to sync notification token:", err);
      return null;
    }
  };

  // Save token to Supabase
  const saveTokenToSupabase = async (
  fcmToken: string,
  userId: string,
  role?: string
) => {
  try {
    const { error } = await supabase
      .from("notification_tokens")
      .upsert(
        {
          token: fcmToken,
          user_id: userId,
          role: role || "user",
          device_type: getDeviceType(),
          is_active: true,
          last_registered_at: new Date().toISOString(),
        },
        {
          onConflict: "token",
        }
      );

    if (error) {
      console.error("Error upserting token:", error);
    } else {
      console.log("✓ Token upserted successfully");
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
    syncNotificationToken,
  };
};
