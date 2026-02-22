import admin from "firebase-admin";

// Initialize Firebase Admin SDK
let adminApp: admin.app.App;

export function initializeAdminSDK() {
  // Check if already initialized
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  // Get service account from environment
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string;

  if (!serviceAccount) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY not set. Please add your Firebase service account JSON to .env.local"
    );
  }

  try {
    // Parse the service account JSON
    const serviceAccountJson = JSON.parse(serviceAccount);

    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson),
    });

    console.log("✓ Firebase Admin SDK initialized");
    return adminApp;
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    throw new Error(
      `Failed to initialize Firebase Admin SDK: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Get Firebase Admin Messaging instance
export function getAdminMessaging() {
  if (admin.apps.length === 0) {
    initializeAdminSDK();
  }
  return admin.messaging();
}

// Send notification to single token
export async function sendNotificationToToken(
  token: string,
  notification: { title: string; body: string; imageUrl?: string },
  data?: Record<string, string>
) {
  try {
    const messaging = getAdminMessaging();

    const message = {
      token,
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.imageUrl || "/logo.png",
          badge: "/logo.png"
        },
        fcmOptions: {
          link: data?.link || "/",
        },
        ...(data && { data }),
      },
    };

    const response = await messaging.send(message as admin.messaging.Message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending notification to token:", error);
    return { success: false, error };
  }
}

// Send notifications to multiple tokens
export async function sendNotificationsToMultiple(
  tokens: string[],
  notification: { title: string; body: string; imageUrl?: string },
  data?: Record<string, string>
) {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, errors: [], failedTokens: [], invalidTokens: [] };
  }

  try {
    const messaging = getAdminMessaging();

    const messages = tokens.map((token) => ({
      token,
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.imageUrl || "/logo.png",
          badge: "/logo.png",
          requireInteraction: false,
        },
        fcmOptions: {
          link: data?.link || "/",
        },
        ...(data && { data }),
      },
    }));

    // Send in batches of 500 (Firebase limit)
    const batchSize = 500;
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];
    const failedTokens: string[] = [];
    const invalidTokens: string[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      try {
        const results = await Promise.allSettled(
          batch.map((msg) =>
            messaging.send({
              token: msg.token,
              webpush: msg.webpush,
            } as admin.messaging.Message)
          )
        );

        results.forEach((result, idx) => {
          const token = tokens[i + idx];
          if (result.status === "fulfilled") {
            successCount++;
            console.log(`✓ Notification sent to token ${token.substring(0, 20)}...`);
          } else {
            failureCount++;
            const errorMsg = result.reason?.message || "Unknown error";
            const errorCode = result.reason?.code || "";
            
            // Check for invalid token errors
            if (
              errorCode.includes("invalid-argument") ||
              errorCode.includes("authentication-error") ||
              errorMsg.includes("Invalid registration token") ||
              errorMsg.includes("not a valid registration token")
            ) {
              invalidTokens.push(token);
              console.warn(`⚠ Invalid FCM token detected: ${token.substring(0, 20)}...`);
            } else {
              failedTokens.push(token);
            }
            
            const errorLog = `Token ${token.substring(0, 20)}...: [${errorCode}] ${errorMsg}`;
            errors.push(errorLog);
            console.error(`✗ Failed to send notification: ${errorLog}`);
          }
        });
      } catch (error) {
        console.error("Batch send error:", error);
        failureCount += batch.length;
        errors.push(`Batch error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    if (errors.length > 0) {
      console.warn(`⚠ Notification delivery summary: ${successCount} sent, ${failureCount} failed (${invalidTokens.length} invalid tokens)`);
    }

    return {
      successCount,
      failureCount,
      errors: errors.slice(0, 10), // Return first 10 errors
      failedTokens: [...failedTokens, ...invalidTokens], // Return all failed tokens for cleanup
      invalidTokens, // Track invalid tokens separately for better diagnostics
    };
  } catch (error) {
    console.error("Error sending multicast notifications:", error);
    throw error;
  }
}

// Subscribe tokens to topic
export async function subscribeToTopic(tokens: string[], topic: string) {
  try {
    const messaging = getAdminMessaging();
    const response = await messaging.subscribeToTopic(tokens, topic);
    return response;
  } catch (error) {
    console.error("Error subscribing to topic:", error);
    throw error;
  }
}

// Unsubscribe tokens from topic
export async function unsubscribeFromTopic(tokens: string[], topic: string) {
  try {
    const messaging = getAdminMessaging();
    const response = await messaging.unsubscribeFromTopic(tokens, topic);
    return response;
  } catch (error) {
    console.error("Error unsubscribing from topic:", error);
    throw error;
  }
}

// Send notification to topic
export async function sendNotificationToTopic(
  topic: string,
  notification: { title: string; body: string; imageUrl?: string },
  data?: Record<string, string>
) {
  try {
    const messaging = getAdminMessaging();

    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      webpush: {
        notification: {
          icon: "/logo.png",
          badge: "/logo.png",
          requireInteraction: false,
        },
        fcmOptions: {
          link: data?.link || "/",
        },
        ...(data && { data }),
      },
    } as admin.messaging.Message;

    const response = await messaging.send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending notification to topic:", error);
    return { success: false, error };
  }
}
