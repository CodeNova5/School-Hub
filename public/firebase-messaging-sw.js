// This is the Firebase Cloud Messaging service worker
// It handles incoming notifications in the background

importScripts(
    "https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js"
);
importScripts(
    "https://www.gstatic.com/firebasejs/10.5.0/firebase-messaging-compat.js"
);

// Initialize Firebase in the service worker
const firebaseConfig = {
    apiKey: "AIzaSyBi3udeo5_oURwg7hizNNQBN7tcZkkIP4s",
    authDomain: "hello-notif-b3353.firebaseapp.com",
    projectId: "hello-notif-b3353",
    storageBucket: "hello-notif-b3353.firebasestorage.app",
    messagingSenderId: "1000532897347",
    appId: "1:1000532897347:web:aca3d357144c038fa8aef6",
    measurementId: "G-5M6JBZFZ4K"
};

try {
    firebase.initializeApp(firebaseConfig);
    console.log('✓ Firebase initialized in Service Worker');
} catch (error) {
    console.error('Error initializing Firebase in SW:', error);
}

const messaging = firebase.messaging();

// Handle notifications when the app is in the background
messaging.onBackgroundMessage((payload) => {
    console.log("✓ Background message received:", payload);

    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationOptions = {
        body: payload.notification?.body || "You have a new message",
        icon: "/logo.png", // App icon (small, always same)
        image: payload.notification?.image, // Large image (optional, content-specific)
        badge: "/logo.png",
        tag: payload.data?.tag || "notification", // Tag for grouping notifications
        data: payload.data || {},
        requireInteraction: true, // Keep notification until user interacts
        vibrate: [200, 100, 200], // Vibration pattern for Android
        actions: [
            {
                action: "open",
                title: "Open",
            },
            {
                action: "close",
                title: "Close",
            },
        ],
    };

    console.log("Displaying notification:", notificationTitle);
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
    console.log("✓ Notification clicked:", event.notification.tag);
    event.notification.close();

    if (event.action === "close") {
        return;
    }

    const urlToOpen = event.notification.data?.link || "/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            // Check if there's already a window/tab open with the target URL
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                if (
                    client.url === urlToOpen ||
                    new URL(client.url).pathname === new URL(urlToOpen).pathname
                ) {
                    console.log("✓ Focusing existing window");
                    return client.focus();
                }
            }
            // If not, open a new window/tab with the target URL
            console.log("Opening new window with URL:", urlToOpen);
            return clients.openWindow(urlToOpen);
        })
    );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
    console.log("✓ Notification closed:", event.notification.tag);
});

// Listen for messages from clients
self.addEventListener("message", (event) => {
    console.log("Message received in SW:", event.data);
    
    // Handle skip-waiting message for SW updates
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// Handle push events directly (backup for notifications that don't include Firebase headers)
self.addEventListener("push", (event) => {
    if (event.data) {
        console.log("✓ Push event received (non-FCM)");
        // This is typically handled by Firebase messaging, but adding as backup
    }
});

// Handle service worker activation
self.addEventListener("activate", (event) => {
    console.log("✓ Service Worker activated");
    event.waitUntil(clients.claim()); // Take control of all pages immediately
});
