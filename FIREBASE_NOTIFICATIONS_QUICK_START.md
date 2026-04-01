# Firebase Push Notifications - Quick Implementation Guide

## ✅ Files Created

| File | Purpose |
|------|---------|
| `lib/firebase.ts` | Firebase initialization with FCM |
| `public/firebase-messaging-sw.js` | Service worker for background notifications |
| `public/manifest.json` | PWA manifest for app installation |
| `hooks/use-notification-setup.ts` | React hook for permission & token management |
| `components/notification-permission.tsx` | Prominent UI component requesting permission |
| `components/admin-send-notification.tsx` | Admin panel to send notifications |
| `lib/notification-utils.ts` | Utility functions for notification management |
| `app/api/notifications/token/route.ts` | API to register/unregister tokens |
| `app/api/admin/send-notification/route.ts` | API to send notifications |
| `supabase/migrations/20260221_create_notification_tokens.sql` | Database schema |
| `FCM_SETUP_GUIDE.md` | Complete setup documentation |
| `.env.local.example` | Environment variables template |

---

## 🚀 Quick Start (5 Steps)

### Step 1: Set Up Firebase
```bash
# Copy environment variables template
cp .env.local.example .env.local

# Edit .env.local with your Firebase credentials
# Get them from: https://console.firebase.google.com/
```

### Step 2: Update App Layout
Edit `app/layout.tsx`:

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
        {/* Add PWA manifest */}
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
                .then(reg => console.log('✓ Service Worker registered'))
                .catch(err => console.error('✗ SW registration failed:', err));
            }
          `}
        </Script>
      </body>
    </html>
  );
}
```

### Step 3: Add Permission Component
In `app/student/page.tsx` (or your dashboard):

```tsx
"use client";

import { NotificationPermissionComponent } from "@/components/notification-permission";

export default function StudentDashboardPage() {
  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        {/* Add at the top */}
        <NotificationPermissionComponent 
          role="student" 
          autoPromptDelay={3000} 
        />

        {/* Rest of dashboard */}
        ...
      </div>
    </DashboardLayout>
  );
}
```

### Step 4: Run Database Migration
```bash
# Using Supabase CLI
supabase migration up

# OR manually in Supabase SQL Editor:
# Copy content from: supabase/migrations/20260221_create_notification_tokens.sql
```

### Step 5: Create PWA Icons
Create these in `public/`:
- `icon-192x192.png` (192×192)
- `icon-512x512.png` (512×512)
- `notification-icon.png` (for notifications)

[Use PWA Asset Generator](https://pwa-asset-generator.netlify.app/) to create automatically.

---

## 🔔 How Users Will See It

### Desktop Users
1. Visit app → Permission dialog appears after 3 seconds
2. Dialog explains benefits and iOS PWA requirement
3. Click "Enable Notifications"
4. Grant browser permission
5. Token saved → Success message shows

### iOS Users
1. See notification permission dialog
2. **Important notice:** "Add to Home Screen to enable notifications"
3. User goes to Safari → Share → Add to Home Screen
4. Opens app from home screen (now a PWA)
5. Permission dialog appears again
6. Grant permission → Notifications enabled

---

## 📱 Testing

### Test in Browser
```bash
npm run dev
# Open localhost:3000
# Grant notification permission
# Send test via Firebase Console
```

### Test with PWA (Desktop)
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Click **Manifest** - should see it
4. Install prompts in address bar
5. Grant permission when asked

### Test on iOS
1. Open in Safari on iPhone
2. Tap Share → Add to Home Screen
3. Open app from home screen
4. Grant permission
5. Send test notification

### Send Test Notification (Firebase Console)
1. Firebase Console → Cloud Messaging
2. "Send your first message"
3. Fill in notification details
4. Click "Send test message"
5. Select your FCM token
6. Click Send

---

## 🛠️ Configuration Details

### Updated Files to Review

**1. Environment Variables (`.env.local`)**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=<from firebase console>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<from firebase console>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<from firebase console>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<from firebase console>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from firebase console>
NEXT_PUBLIC_FIREBASE_APP_ID=<from firebase console>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<generate in cloud messaging>
```

**2. Service Worker** (`public/firebase-messaging-sw.js`)
- ⚠️ Update Firebase config values for your project
- Or use environment variables (recommended)

**3. PWA Manifest** (`public/manifest.json`)
- Update app name, description, icons
- Customize colors and shortcuts

---

## 📊 Database Schema

Table: `notification_tokens`
```
- id (UUID, PK)
- user_id (UUID, FK → auth.users)
- token (TEXT, FCM token)
- role (TEXT, user role)
- device_type (TEXT, iOS/Android/Desktop)
- is_active (BOOLEAN, active status)
- created_at (TIMESTAMP)
- last_registered_at (TIMESTAMP)
```

**Key Features:**
- Auto-cleanup of old tokens
- Role-based queries
- Device type tracking
- RLS policies for security

---

## 🎯 Next Steps

- [ ] Set Firebase credentials in `.env.local`
- [ ] Update Service Worker config
- [ ] Update app layout with manifest + SW registration
- [ ] Add notification component to dashboard
- [ ] Run Supabase migration
- [ ] Create/add PWA icons to `public/`
- [ ] Test permission flow in browser and mobile
- [ ] Set up backend for sending notifications
- [ ] Monitor token health and cleanup old tokens

---

## 📚 File Breakdown

### Frontend Components
- **`notification-permission.tsx`** - Prominent dialog + banner
- **`admin-send-notification.tsx`** - Admin panel UI

### Hooks
- **`use-notification-setup.ts`** - Handle FCM flow, token saving

### Utilities
- **`notification-utils.ts`** - Query tokens, format payloads, etc.

### API Routes
- **`/api/notifications/token`** - Register/unregister tokens
- **`/api/admin/send-notification`** - Initiate notification sending

### Configuration
- **`lib/firebase.ts`** - Firebase initialization
- **`public/firebase-messaging-sw.js`** - Handle background messages
- **`public/manifest.json`** - PWA metadata

---

## ⚠️ iOS Special Notes

**iOS does NOT support web push natively.** Users must:

1. **Install as PWA:**
   - Open in Safari
   - Share → "Add to Home Screen"
   - Open from home screen

2. **Why this works:**
   - PWA has better permissions on iOS
   - Can access Service Workers
   - Can receive push notifications

3. **In UI:**
   - Component shows clear warning
   - iOS detection + helpful instructions
   - "Add to Home Screen" button in info panel

---

## 🔐 Security Best Practices

✅ **DO:**
- Use `NEXT_PUBLIC_` only for public keys (VAPID)
- Keep service account keys private
- Implement rate limiting on send endpoints
- Validate permissions before sending
- Rotate stale tokens periodically

❌ **DON'T:**
- Commit `.env.local` to git
- Share Firebase configurations
- Send unlimited notifications
- Store sensitive data in notification payloads

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Service Worker not registering | Check `public/` folder, browser console |
| Token not saving to Supabase | Verify auth is working, check RLS policies |
| Notifications not showing | Check permission granted, token is active |
| iOS notifications don't work | User must install as PWA first |
| "Not supported" message | Browser/device doesn't support FCM - check console |

---

## 📞 Support

For detailed setup: See `FCM_SETUP_GUIDE.md`
For API reference: Check individual file comments
For Firebase docs: https://firebase.google.com/docs/cloud-messaging
