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
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      ...(data && { data }),
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
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  try {
    const messaging = getAdminMessaging();

    const messages = tokens.map((token) => ({
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      ...(data && { data }),
    }));

    // Send in batches of 500 (Firebase limit)
    const batchSize = 500;
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];
    const failedTokens: string[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      try {
        const results = await Promise.allSettled(
          batch.map((msg) =>
            messaging.send({
              token: msg.token,
              notification: msg.notification,
              data: msg.data,
            })
          )
        );

        results.forEach((result, idx) => {
          if (result.status === "fulfilled") {
            successCount++;
          } else {
            failureCount++;
            const token = tokens[i + idx];
            errors.push(
              `Token ${token.substring(0, 20)}...: ${result.reason?.message || "Unknown error"}`
            );
            failedTokens.push(token);
          }
        });
      } catch (error) {
        console.error("Batch send error:", error);
        failureCount += batch.length;
        errors.push(`Batch error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return {
      successCount,
      failureCount,
      errors: errors.slice(0, 10), // Return first 10 errors
      failedTokens, // Return all failed tokens for cleanup
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
      ...(data && { data }),
    } as admin.messaging.Message;

    const response = await messaging.send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending notification to topic:", error);
    return { success: false, error };
  }
}
