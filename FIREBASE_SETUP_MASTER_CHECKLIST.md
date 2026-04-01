# 📋 Complete Firebase Notifications Setup - Master Checklist

## 📦 All Files Created

### Core Implementation Files

| File | Purpose | Type |
|------|---------|------|
| `lib/firebase.ts` | Firebase app initialization with FCM support | Core |
| `hooks/use-notification-setup.ts` | React hook for permission & token management | Core |
| `lib/notification-utils.ts` | Utility functions (token queries, helpers) | Core |
| `public/firebase-messaging-sw.js` | Service Worker for background notifications | Core |
| `public/manifest.json` | PWA manifest for app installation | Core |

### UI Components

| File | Purpose | Type |
|------|---------|------|
| `components/notification-permission.tsx` | Permission dialog (prominent, user-facing) | Component |
| `components/admin-send-notification.tsx` | Admin panel to send notifications | Component |

### API Routes

| File | Purpose | Endpoint |
|------|---------|----------|
| `app/api/notifications/token/route.ts` | Register/unregister tokens | `POST /api/notifications/token` |
| `app/api/admin/send-notification/route.ts` | Send notifications to users | `POST /api/admin/send-notification` |

### Database

| File | Purpose | Type |
|------|---------|------|
| `supabase/migrations/20260221_create_notification_tokens.sql` | Complete schema with RLS | Migration |

### Documentation

| File | Purpose | Read First | Details |
|------|---------|-----------|---------|
| `FIREBASE_NOTIFICATIONS_QUICK_START.md` | 5-minute quick start | ✅ YES | Setup steps |
| `FCM_SETUP_GUIDE.md` | Complete detailed guide | ⭐ THEN | Deep dive |
| `FIREBASE_NOTIFICATIONS_TROUBLESHOOTING.md` | Common issues & fixes | 🔨 AS NEEDED | Debugging |
| `FIREBASE_NOTIFICATIONS_SETUP_SUMMARY.md` | Visual overview | 📖 REFERENCE | Quick ref |
| `NOTIFICATION_COMPONENT_EXAMPLE.md` | Integration examples | 💡 CODE | Code samples |
| `.env.local.example` | Environment template | 🔧 SETUP | Variables |

---

## ✅ Step-by-Step Setup Checklist

### Phase 1: Firebase Setup
- [ ] Go to [Firebase Console](https://console.firebase.google.com/)
- [ ] Create/select project
- [ ] Enable Cloud Messaging
- [ ] Create web app if not already created
- [ ] Copy web app credentials (API key, project ID, etc.)
- [ ] Go to Cloud Messaging → Generate key pair
- [ ] Copy VAPID key (public key)

### Phase 2: Environment Configuration
- [ ] Create `.env.local` file in project root
- [ ] Copy from `.env.local.example`
- [ ] Fill in Firebase credentials:
  ```env
  NEXT_PUBLIC_FIREBASE_API_KEY=your_key
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_id
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_id
  NEXT_PUBLIC_FIREBASE_APP_ID=your_id
  NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key
  ```
- [ ] Add `.env.local` to `.gitignore`
- [ ] Restart dev server: `npm run dev` (kill and restart)

### Phase 3: Update Main Layout
- [ ] Open `app/layout.tsx`
- [ ] Add manifest link in `<head>`:
  ```tsx
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#2563eb" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="School Deck" />
  ```
- [ ] Add Service Worker registration script before `</body>`:
  ```tsx
  <Script id="sw-register" strategy="afterInteractive">
    {`
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .then(reg => console.log('✓ SW registered'))
          .catch(err => console.error('✗ SW error:', err));
      }
    `}
  </Script>
  ```

### Phase 4: Database Setup
- [ ] Open Supabase dashboard
- [ ] Go to SQL Editor
- [ ] Create new query
- [ ] Copy content from `supabase/migrations/20260221_create_notification_tokens.sql`
- [ ] Run query
- [ ] Verify `notification_tokens` table created:
  ```sql
  SELECT * FROM notification_tokens;
  ```

### Phase 5: Add Component to Dashboards
- [ ] Open `app/student/page.tsx`
- [ ] Add import: `import { NotificationPermissionComponent } from "@/components/notification-permission";`
- [ ] Add component in JSX (at top of content):
  ```tsx
  <NotificationPermissionComponent role="student" autoPromptDelay={3000} />
  ```
- [ ] Repeat for other roles:
  - `app/teacher/page.tsx` (role="teacher")
  - `app/parent/page.tsx` (role="parent")
  - `app/admin/page.tsx` (role="admin")

### Phase 6: Create PWA Icons (Optional but Recommended)
- [ ] Create icon files in `public/`:
  - `icon-192x192.png` (192×192 pixels)
  - `icon-512x512.png` (512×512 pixels)
  - `icon-maskable-192x192.png` (adaptive icon)
  - `icon-maskable-512x512.png` (adaptive icon)
  - `notification-icon.png` (any size)
  - `notification-badge.png` (72×72)
- [ ] Or use [PWA Asset Generator](https://pwa-asset-generator.netlify.app/)

### Phase 7: Testing
- [ ] Browser test:
  - [ ] Open app in Chrome
  - [ ] See permission dialog after 3 sec
  - [ ] Click "Enable Notifications"
  - [ ] Grant browser permission
  - [ ] See success message
- [ ] Verify token saved:
  - [ ] Go to Supabase dashboard
  - [ ] Check `notification_tokens` table
  - [ ] Should see new row with your token
- [ ] Send test notification:
  - [ ] Firebase Console → Cloud Messaging
  - [ ] "Send your first message"
  - [ ] Fill in title/body
  - [ ] Use "Device token target"
  - [ ] Paste your FCM token
  - [ ] Click Send
  - [ ] Should see notification appear!
- [ ] iOS test:
  - [ ] Open app in Safari on iPhone
  - [ ] See clear warning about PWA
  - [ ] Tap Share → Add to Home Screen
  - [ ] Open app from home screen
  - [ ] Permission dialog appears
  - [ ] Enable notifications
  - [ ] Send test from Firebase
  - [ ] Should see notification!

---

## 🎯 What Each Component Does

```
┌─────────────────────────────────────────────────────┐
│            USER GRANTS PERMISSION                   │
└─────────────────────────────────┬───────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
        ┌───────▼─────────────┐         ┌──────────▼──────────┐
        │ FRONTEND            │         │ BACKEND/ADMIN       │
        ├─────────────────────┤         ├─────────────────────┤
        │ Notification        │         │ Admin Component     │
        │ Permission Component │         │ Sends notification  │
        │                     │         │                     │
        │ 1. Shows dialog     │         │ 1. Selects recipients
        │ 2. Mobile feedback  │         │ 2. Writes message   │
        │ 3. Requests perm    │         │ 3. Sends via API    │
        └─────────┬───────────┘         └──────────┬──────────┘
                  │                                │
        ┌─────────▼──────────────┐      ┌─────────▼──────────────┐
        │ useNotificationSetup   │      │ /api/admin/send-       │
        │ Hook                   │      │ notification           │
        │                        │      │                        │
        │ 1. Get FCM token       │      │ 1. Check admin auth    │
        │ 2. Setup listener      │      │ 2. Query tokens       │
        │ 3. Save to Supabase    │      │ 3. Call Firebase Admin │
        └─────────┬──────────────┘      └─────────┬──────────────┘
                  │                                │
        ┌─────────▼──────────────────────────────▼────────────┐
        │         SUPABASE DATABASE                          │
        │  notification_tokens table                         │
        │  - id, user_id, token, role, device_type, etc. │
        └──────────────────┬─────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
        ┌───────▼────────┐   ┌────────▼─────────┐
        │ FOREGROUND     │   │ BACKGROUND      │
        │ Message Handler│   │ Service Worker  │
        ├────────────────┤   ├─────────────────┤
        │ App is open    │   │ App is closed   │
        │ shows in-app   │   │ shows system    │
        │ notification   │   │ notification    │
        └────────────────┘   └─────────────────┘
                │                     │
                └──────────┬──────────┘
                           │
                  ┌────────▼────────┐
                  │ USER SEES       │
                  │ NOTIFICATION    │
                  └─────────────────┘
```

---

## 📱 User Flow Diagram

### Desktop User
```
App Opens
    ↓ (3 sec delay)
Permission Dialog Appears
    ↓
User Clicks "Enable"
    ↓
Browser Requests Permission
    ↓
User Grants Permission
    ↓
✓ Success Message
    ↓
Token Saved to Supabase
    ↓
Ready for Notifications
```

### iOS User
```
App Opens in Safari
    ↓ (3 sec delay)
Permission Dialog with iOS Warning
    ↓
User Can:
├─ "Maybe Later" → Try again next visit
└─ Follow instructions:
    "Add to Home Screen"
        ↓
    1. Tap Share
    2. Select "Add to Home Screen"
    3. Tap Add
    4. Close Safari
    5. Open from Home Screen
        ↓
    Now in PWA Mode
        ↓
    Permission Dialog Appears Again
        ↓
    User Grants Permission
        ↓
    ✓ Notifications Work!
```

---

## 📊 Database Structure

### notification_tokens Table

```sql
CREATE TABLE notification_tokens (
  id              UUID PRIMARY KEY
  user_id         UUID → references auth.users(id)
  token           TEXT (FCM Token - long string)
  role            TEXT (student/teacher/parent/admin)
  device_type     TEXT (iOS/Android/Windows/macOS/Linux)
  is_active       BOOLEAN (default: true)
  created_at      TIMESTAMP (when token first created)
  last_registered TIMESTAMP (when last renewed)
);

-- Example Row:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "650e8400-e29b-41d4-a716-446655440000",
  "token": "dLQ5tKz9...very_long_string...nq8x",
  "role": "student",
  "device_type": "android",
  "is_active": true,
  "created_at": "2026-02-21T10:30:00Z",
  "last_registered_at": "2026-02-21T14:45:00Z"
}
```

---

## 🔔 Notification Lifecycle

### Step 1: User Enables Notifications
```
Browser Permission Request
    ↓
User Grants Permission
    ↓
notification_setup hook:
├─ Gets FCM token from Firebase
├─ Calls /api/notifications/token
└─ Saves to Supabase
```

### Step 2: Admin Sends Notification
```
Admin Panel Component
    ↓
Fills form (title, body, recipients)
    ↓
POST /api/admin/send-notification
    ↓
API Route:
├─ Verifies admin
├─ Queries notification_tokens
├─ Gets matching tokens
└─ Calls Firebase Admin SDK
```

### Step 3: Firebase Sends
```
Firebase Cloud Messaging
    ↓
Sends to device tokens
    ↓
┌─────────────────────────────┬──────────────────────┐
│ If App Closed               │ If App Open          │
├─────────────────────────────┼──────────────────────┤
│ Service Worker receives     │ onMessage handler    │
│ Shows system notification   │ Shows in-app notice  │
└─────────────────────────────┴──────────────────────┘
```

### Step 4: User Sees & Interacts
```
Notification Appears
    ↓
User Clicks
    ↓
Service Worker handles click
    ↓
Opens specified link
    ↓
User navigated to relevant page
```

---

## 🎓 File Dependencies

```
app/layout.tsx
├─ manifest.json ← Meta tags
└─ firebase-messaging-sw.js ← Script registration

app/student/page.tsx
├─ notification-permission.tsx
│  ├─ use-notification-setup.ts
│  │  ├─ lib/firebase.ts
│  │  ├─ lib/auth.ts
│  │  └─ lib/supabase.ts
│  └─ ui components

components/admin-send-notification.tsx
├─ app/api/admin/send-notification/route.ts
│  └─ lib/notification-utils.ts
│     └─ lib/supabase.ts

.env.local (required)
├─ lib/firebase.ts
└─ app/firebase-messaging-sw.js
```

---

## 🚀 After Setup Complete

### You Can Now:
1. ✅ Users grant notification permission
2. ✅ Tokens stored safely in Supabase
3. ✅ Admin can send notifications to groups
4. ✅ Foreground + background notifications work
5. ✅ iOS PWA notifications work (after installation)

### Next Steps:
1. Set up automated notifications (on assignment creation, etc.)
2. Create notification templates
3. Monitor token health
4. Clean up inactive tokens regularly
5. Add notification history/logs
6. Build notification preferences for users

---

## 📞 Quick Reference

### Environment Variables Needed
```env
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
```

### Key Files to Know
- **User sees:** `notification-permission.tsx`
- **Admin uses:** `admin-send-notification.tsx`
- **Token saved:** `notification_tokens` table
- **Logic:** `use-notification-setup.ts` hook
- **Docs:** `FIREBASE_NOTIFICATIONS_QUICK_START.md`

### Testing
```bash
# 1. Dev server
npm run dev

# 2. Check browser console for errors
# 3. grant permission
# 4. Check Supabase for token
# 5. Send test from Firebase Console
```

---

## ✨ You're All Set!

- ✅ Complete Firebase FCM integration
- ✅ Supabase token storage with RLS
- ✅ User permission dialog (prominent!)
- ✅ iOS PWA support
- ✅ Admin notification panel
- ✅ Service Worker background handler
- ✅ Full documentation

**Next:** Follow the Quick Start guide to complete setup! 🎉
