import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

// Your Firebase config - REPLACE WITH YOUR OWN
const firebaseConfig = {
  apiKey: "AIzaSyBi3udeo5_oURwg7hizNNQBN7tcZkkIP4s",
  authDomain: "hello-notif-b3353.firebaseapp.com",
  projectId: "hello-notif-b3353",
  storageBucket: "hello-notif-b3353.firebasestorage.app",
  messagingSenderId: "1000532897347",
  appId: "1:1000532897347:web:aca3d357144c038fa8aef6",
  measurementId: "G-5M6JBZFZ4K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Messaging
let messaging: any = null;

export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (!supported) {
    console.warn(
      "Firebase Cloud Messaging not supported in this browser. iOS users: Add to Home Screen for PWA support."
    );
    return null;
  }

  if (!messaging) {
    messaging = getMessaging(app);
  }

  return messaging;
};

export { app };
