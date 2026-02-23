// This is the Firebase Cloud Messaging service worker
// It handles incoming notifications in the background

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyBi3udeo5_oURwg7hizNNQBN7tcZkkIP4s",
    authDomain: "hello-notif-b3353.firebaseapp.com",
    projectId: "hello-notif-b3353",
    storageBucket: "hello-notif-b3353.firebasestorage.app",
    messagingSenderId: "1000532897347",
    appId: "1:1000532897347:web:aca3d357144c038fa8aef6",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const { title, body, icon, link } = payload.data;

    self.registration.showNotification(title, {
        body,
        icon,
        data: { link },
    });
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data.link || "/")
    );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
    console.log("Notification closed:", event.notification.tag);
});
