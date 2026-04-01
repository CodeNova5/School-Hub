# Firebase Cloud Messaging Setup Guide

## Overview
This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications with Supabase token storage.

## What's been created:

1. **`lib/firebase.ts`** - Firebase app initialization with FCM support
2. **`public/firebase-messaging-sw.js`** - Service Worker for handling background notifications
3. **`public/manifest.json`** - PWA manifest for app installation
4. **`hooks/use-notification-setup.ts`** - React hook for managing notifications
5. **`components/notification-permission.tsx`** - UI component requesting permission
6. **`app/api/notifications/token/route.ts`** - API endpoint for token management
7. **`supabase/migrations/20260221_create_notification_tokens.sql`** - Database schema

---

## Step-by-Step Setup

### 1. **Get Firebase Config**
- Go to [Firebase Console](https://console.firebase.google.com/)
- Select your project
- Go to **Project Settings** → **General**
- Copy your web app config (NOT the private key)
- Create a `.env.local` file with these variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key
```

### 2. **Generate VAPID Key**
- Go to Firebase Console → **Cloud Messaging** tab
- Under "Web configuration", click **Generate Key Pair**
- Copy the public key and add to `.env.local` as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### 3. **Update Service Worker**
Edit `public/firebase-messaging-sw.js`:
- Replace the firebaseConfig values with your actual config
- Or better: Make it dynamic (see alternative approach below)

### 4. **Update App Layout**
Add this to your `app/layout.tsx` or main layout file:

```tsx
import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="School Deck" />
      </head>
      <body>
        {children}
        
        {/* Register Service Worker */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/firebase-messaging-sw.js')
                .then(reg => console.log('SW registered:', reg))
                .catch(err => console.log('SW registration failed:', err));
            }
          `}
        </Script>
      </body>
    </html>
  );
}
```

### 5. **Add Notification Component**
In your dashboard/student pages (e.g., `app/student/page.tsx`):

```tsx
import { NotificationPermissionComponent } from "@/components/notification-permission";

export default function StudentDashboardPage() {
  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        {/* Add this at the top of the page */}
        <NotificationPermissionComponent role="student" autoPromptDelay={3000} />
        
        {/* Rest of your dashboard content */}
        ...
      </div>
    </DashboardLayout>
  );
}
```

### 6. **Run Supabase Migration**
In your terminal:

```bash
# Using Supabase CLI
supabase migration up

# Or manually:
# 1. Go to your Supabase dashboard
# 2. SQL Editor
# 3. Copy-paste the migration file content and run
```

### 7. **Create Icons for PWA** (Optional but recommended)
Create the following icons and save to `public/`:
- `icon-192x192.png` (192x192 pixels)
- `icon-512x512.png` (512x512 pixels)
- `icon-maskable-192x192.png` (192x192, for adaptive icons)
- `icon-maskable-512x512.png` (512x512, for adaptive icons)
- `notification-icon.png` (any size, for notifications)
- `notification-badge.png` (72x72, for notification badge)

You can use a tool like [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) to create these automatically.

---

## How It Works

### Permission Flow
1. User visits the app
2. `NotificationPermissionComponent` appears after 3 seconds (customizable)
3. Component clearly explains iOS needs PWA installation
4. User clicks "Enable Notifications"
5. Browser requests notification permission
6. If granted:
   - FCM token is retrieved
   - Token is stored in Supabase with device info
   - Foreground message handler is set up
   - Success message shown

### When Notification is Received

**Background (service worker):**
- Firebase service worker receives the message
- Shows a system notification

**Foreground (user has app open):**
- `onMessage` handler receives it
- Shows notification programmatically

**User clicks notification:**
- Service worker opens the specified link (if any)

---

## Database Schema

The `notification_tokens` table stores:
- `id` - Unique identifier
- `user_id` - Reference to auth user
- `token` - FCM token
- `role` - User role (student/teacher/parent/admin)
- `device_type` - iOS/Android/Desktop
- `is_active` - Whether token is still valid
- `created_at` - When token was created
- `last_registered_at` - Last time token was registered

---

## Sending Notifications (Backend)

### Using Firebase Admin SDK (Node.js):

```javascript
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Send to specific token
await admin.messaging().send({
  token: 'fcmToken',
  notification: {
    title: 'New Assignment',
    body: 'Math homework due tomorrow',
    imageUrl: 'https://...',
  },
  data: {
    type: 'assignment',
    link: '/student/assignments/123',
    tag: 'assignment-123',
  },
});

// Send to multiple users (via Supabase query + loop)
const tokens = await supabase
  .from('notification_tokens')
  .select('token')
  .eq('is_active', true)
  .eq('role', 'student');

const messages = tokens.data.map(t => ({
  token: t.token,
  notification: { /* ... */ },
}));

await admin.messaging().sendMulticast({ messages });

// Send to topic
await admin.messaging().send({
  topic: 'class-1a',
  notification: { /* ... */ },
});
```

### From Next.js API Route:

```typescript
import admin from 'firebase-admin';
import { supabase } from '@/lib/supabase';

// Initialize admin SDK in your API route
const messaging = admin.messaging();

// Get user's tokens
const { data: tokens } = await supabase
  .from('notification_tokens')
  .select('token')
  .eq('user_id', userId)
  .eq('is_active', true);

// Send notification
for (const { token } of tokens) {
  await messaging.send({
    token: token,
    notification: {
      title: 'Assignment Reminder',
      body: 'Your assignment is due tomorrow',
    },
    data: {
      type: 'assignment',
      link: '/student/assignments/123',
    },
  });
}
```

---

## iOS Support (Important!)

**iOS devices do NOT support web push notifications natively.**

Users must:
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Open the app from home screen as a PWA
5. Grant notification permission when prompted

This works because PWAs installed on iOS have more capabilities than regular web apps.

---

## Testing

### Test Notifications Locally:
1. Install PWA: Open in Chrome → Menu → "Install app"
2. Grant notifications permission
3. Use Firebase Console or Admin SDK to send a test message
4. Check if it appears (might need to close and reopen app)

### Firebase Console Testing:
1. Go to Firebase → Cloud Messaging
2. Send a test message
3. Select your token target
4. Click Send

---

## Troubleshooting

### "Notifications not supported"
- Browser doesn't support notifications (check console logs)
- iOS users: Must install as PWA first

### Token not saving to Supabase
- Check if user is authenticated
- Verify Supabase credentials in `.env.local`
- Check Supabase RLS policies

### Service worker not registering
- Ensure `firebase-messaging-sw.js` is in `public/` folder
- Check browser console for errors
- Verify serviceWorker is not disabled

### Foreground notifications not showing
- Check if `setupForegroundMessageHandler()` was called
- Verify notification permission is granted
- Check browser console for errors

---

## Next Steps

1. ✅ Complete all setup steps above
2. ✅ Test with a real device (especially iOS)
3. ✅ Create admin panel to send notifications
4. ✅ Set up automated notifications (assignments, reminders, etc.)
5. ✅ Monitor token freshness (rotate old tokens)

---

## Security Notes

- Never commit `.env.local` to git (add to `.gitignore`)
- VAPID key is public (safe to expose)
- Always use service accounts with proper permissions
- Implement rate limiting on notification endpoints
- Validate user permissions before sending
