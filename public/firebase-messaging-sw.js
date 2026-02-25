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

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle notifications when the app is in the background
messaging.onBackgroundMessage((payload) => {
    console.log("Received background message:", payload);

    // Extract notification data from data-only messages
    // (prevents duplicate notifications on Android)
    const notificationTitle = payload.data?.title || payload.notification?.title || "New Notification";
    const notificationBody = payload.data?.body || payload.notification?.body || "You have a new message";
    const notificationIcon = "https://school-hub-sooty.vercel.app/logo.png";

    const notificationOptions = {
        body: notificationBody,
        icon: notificationIcon,
        badge: "/logo.png",
        tag: payload.data?.tag || "default",
        data: payload.data || {},
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

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
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
                    return client.focus();
                }
            }
            // If not, open a new window/tab with the target URL
            return clients.openWindow(urlToOpen);
        })
    );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
    console.log("Notification closed:", event.notification.tag);
});
