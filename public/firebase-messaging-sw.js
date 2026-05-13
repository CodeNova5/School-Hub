// This is the Firebase Cloud Messaging service worker
// It handles incoming notifications in the background

importScripts(
    "https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js"
);
importScripts(
    "https://www.gstatic.com/firebasejs/10.5.0/firebase-messaging-compat.js"
);

const CACHE_NAME = "school-hub-pwa-v1";
const APP_SHELL = [
    "/",
    "/admin/attendance/qr-scanner",
    "/manifest.json",
    "/logo.png",
    "/logo-192.png",
    "/icon-192.png"
];

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

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api")) return;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((res) => res || caches.match("/")))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            const fetched = fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => cached);

            return cached || fetched;
        })
    );
});

messaging.onBackgroundMessage((payload) => {
    console.log("Received background message:", payload);

    // Extract notification data - supports both top-level notification and data-based notifications
    const notificationTitle = payload.notification?.title || payload.data?.title || "New Notification";
    const notificationBody = payload.notification?.body || payload.data?.body || "You have a new message";
    const notificationIcon = payload.notification?.imageUrl || payload.data?.imageUrl || "https://school-hub-sooty.vercel.app/logo.png";
    const notificationLink = payload.data?.link || "/";

    const notificationOptions = {
        body: notificationBody,
        icon: notificationIcon,
        badge: "https://school-hub-sooty.vercel.app/logo.png",
        tag: payload.data?.tag || "default",
        // Pass link in data for click handler
        data: {
            link: notificationLink,
            ...payload.data,
        },
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const urlToOpen =
        event.notification.data?.link ||
        "https://school-hub-sooty.vercel.app/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            // Try to focus an existing tab
            for (const client of clientList) {
                if (client.url.includes("school-hub-sooty.vercel.app")) {
                    return client.focus();
                }
            }

            // Otherwise open new tab
            return clients.openWindow(urlToOpen);
        })
    );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
    console.log("Notification closed:", event.notification.tag);
});
