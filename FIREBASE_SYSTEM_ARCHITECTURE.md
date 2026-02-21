# 🏗️ Firebase Notifications - System Architecture

## Complete System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SCHOOL HUB APP                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                     FRONTEND (Next.js)                          │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │                                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  notifcation-permission.tsx (Dialog Component)         │ │ │
│  │  │                                                         │ │ │
│  │  │  "Enable notifications?"                               │ │ │
│  │  │  ┌─────────────────────────────────────────────────┐  │ │ │
│  │  │  │ iOS Warning: Add to Home Screen               │  │ │ │
│  │  │  │ Benefits: Assignments, Events, Grades        │  │ │ │
│  │  │  │ [Maybe Later] [Enable Notifications]          │  │ │ │
│  │  │  └─────────────────────────────────────────────────┘  │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │                           │                                   │ │
│  │                           ↓                                   │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  use-notification-setup.ts (Hook)                  │ │ │
│  │  │                                                     │ │ │
│  │  │  1. Request browser permission                     │ │ │
│  │  │  2. Get FCM token from Firebase                    │ │ │
│  │  │  3. Save token to Supabase via API                │ │ │
│  │  │  4. Setup foreground message listener              │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                           │                                   │ │
│  │  ┌────────────┬───────────┴───────────┬────────────┐        │ │
│  │  │            │                       │            │        │ │
│  │  ↓            ↓                       ↓            ↓        │ │
│  │  Permission  Firebase          Supabase          In-app    │ │
│  │  Granted     FCM Token          API Call         Listener   │ │
│  │                                                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  admin-send-notification.tsx (Admin Panel)                  │ │
│  │                                                              │ │
│  │  Send notifications to:                                     │ │
│  │  ├─ All users                                               │ │
│  │  ├─ By role (students/teachers)                            │ │
│  │  ├─ Specific user                                          │ │
│  │  └─ Specific class                                         │ │
│  │                          │                                  │ │
│  │                          ↓                                  │ │
│  │  ┌──────────────────────────────┐                          │ │
│  │  │ Write Title, Body, Image     │                          │ │
│  │  │ Select Recipients            │                          │ │
│  │  │ [Send]                       │                          │ │
│  │  └──────────────────────────────┘                          │ │
│  │                          │                                  │ │
│  └──────────────────────────┼──────────────────────────────────┘ │
│                             │                                    │
│                             ↓                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  SERVICE WORKER (firebase-messaging-sw.js)                  │ │
│  │                                                              │ │
│  │  Handles messages when app is closed                        │ │
│  │  Shows system notifications                                │ │
│  │  Handles notification clicks                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTPS/API Calls
                                 │
┌───────────────────────────────┼────────────────────────────────────┐
│                               ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              BACKEND (Next.js API Routes)                 │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │  POST /api/notifications/token                           │  │
│  │  ├─ Register token                                        │  │
│  │  ├─ Unregister/deactivate token                          │  │
│  │  └─ Save to Supabase                                      │  │
│  │                                                            │  │
│  │  POST /api/admin/send-notification                       │  │
│  │  ├─ Verify admin user                                     │  │
│  │  ├─ Query notification_tokens table                      │  │
│  │  ├─ Filter by target (all/role/user/class)              │  │
│  │  └─ Call Firebase Admin SDK                             │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                 │                                 │
│                  ┌──────────────┬──────────────┐                 │
│                  │              │              │                 │
│                  ↓              ↓              ↓                 │
│           ┌────────────┐ ┌────────────┐ ┌──────────────┐       │
│           │ SUPABASE   │ │  FIREBASE  │ │  FIREBASE   │       │
│           │ (Tokens)   │ │   (Send)   │ │   (Admin)   │       │
│           └────────────┘ └────────────┘ └──────────────┘       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ↓                         ↓
            ┌──────────────┐         ┌────────────────┐
            │ DEVICES      │         │ FCM NETWORK    │
            │              │         │                │
            │ Android      │◄────────│ Distributes    │
            │ iOS          │◄────────│ Messages       │
            │ Desktop      │◄────────│                │
            │              │         │                │
            │ SHOWS        │         └────────────────┘
            │ NOTIFICATION │
            │              │
            └──────────────┘
```

---

## Data Flow Diagram

### User Enables Notifications

```
User clicks "Enable Notifications"
        ↓
Browser.requestPermission()
        ↓
User grants permission
        ↓
Firebase.getToken(vapid)
        ↓
FCM Token Generated: "dLQ5tKz9...nq8x"
        ↓
useNotificationSetup Hook:
├─ Calls: /api/notifications/token
├─ Sends: { token, userId, role, deviceType }
└─ POST request
        ↓
API saves to Supabase:
INSERT notification_tokens
(user_id, token, role, device_type, is_active, created_at)
        ↓
Setup foreground listener:
onMessage(messaging, callback)
        ↓
✓ User can now receive notifications
```

### Admin Sends Notification

```
Admin opens Send Panel
        ↓
Fills: Title, Body, Recipients
        └─ All / Role / User / Class
        ↓
Clicks [Send Notification]
        ↓
POST /api/admin/send-notification
{ title, body, target, targetValue, ... }
        ↓
API Route:
├─ Verify admin (check admins table)
├─ Query notification_tokens
│  └─ Filter: role="student", is_active=true
├─ Get all matching tokens: ["token1", "token2", ...]
└─ Call Firebase Admin SDK
        ↓
Firebase Admin:
messaging.sendMulticast({
  tokens: [array of tokens],
  notification: { title, body },
  data: { link, type, ... }
})
        ↓
FCM Network receives batch
        ↓
┌─────────────────────────────┬──────────────────────┐
│ BACKGROUND                  │ FOREGROUND           │
│ (App closed)                │ (App open)           │
├─────────────────────────────┼──────────────────────┤
│ Service Worker receives msg │ onMessage handler    │
│ self.registration           │ receives message     │
│ .showNotification(...)      │ new Notification(...│
│                             │ creates in-app alert │
│ System notification shown   │ In-app notification  │
│ on device                   │ displayed to user    │
└─────────────────────────────┴──────────────────────┘
        ↓
User sees notification
        ↓
User clicks notification
        ↓
Service Worker handles click:
event.waitUntil(
  clients.openWindow(url)
)
        ↓
App opens/focuses to URL
        ↓
User sees relevant page
```

---

## Component Interaction Diagram

```
┌──────────────────────────────────────────────┐
│         App Layout (layout.tsx)              │
├──────────────────────────────────────────────┤
│ ✓ Manifest meta tags                        │
│ ✓ Service Worker registration script        │
└────────────────┬─────────────────────────────┘
                 │
        ┌────────┴──────────┐
        │                   │
        ↓                   ↓
┌───────────────┐   ┌──────────────────┐
│ Student Page  │   │ Teacher Page     │
│ (page.tsx)    │   │ (page.tsx)       │
└───────┬───────┘   └────────┬─────────┘
        │                    │
        └────────┬───────────┘
                 │
        ┌────────▼─────────────────────────┐
        │ NotificationPermissionComponent  │
        │ (notification-permission.tsx)    │
        │                                  │
        │ ┌──────────────────────────────┐ │
        │ │ Dialog                       │ │
        │ │ - Title: "Stay Notified!" │ │
        │ │ - iOS Warning             │ │
        │ │ - Benefits List            │ │
        │ │ - [Enable] Button          │ │
        │ └──────────────────────────────┘ │
        └────────┬──────────────────────────┘
                 │
        ┌────────▼──────────────────────────┐
        │ useNotificationSetup Hook         │
        │                                   │
        │ requestNotificationPermission()   │
        │         │                         │
        │         ├─ getFirebaseMessaging() │
        │         ├─ getToken()             │
        │         ├─ saveTokenToSupabase()  │
        │         └─ setupForegroundMsg...()│
        │                                   │
        └────────┬──────────────────────────┘
                 │
        ┌────────┴──────────┬──────────────┐
        │                   │              │
        ↓                   ↓              ↓
┌────────────────┐ ┌──────────────┐ ┌───────────┐
│ firebase.ts    │ │ supabase.ts  │ │ auth.ts   │
│ FCM Config     │ │ DB Ops       │ │ User Info │
└────────────────┘ └──────────────┘ └───────────┘
        │                   │              │
        └────────┬──────────┴──────────────┘
                 │
        ┌────────▼─────────────────────┐
        │ Firebase Cloud Messaging     │
        │ - Validates VAPID key        │
        │ - Generates FCM token        │
        │ - Returns: "dLQ5tKz9...x"    │
        └────────┬─────────────────────┘
                 │
        ┌────────▼─────────────────────┐
        │ Supabase                      │
        │ INSERT notification_tokens    │
        │ (user_id, token, role, ...)    │
        └───────────────────────────────┘
                 │
                 ✓ Token Saved
```

---

## Database Schema Visualization

```
┌────────────────────────────────────────────────┐
│     notification_tokens Table                 │
├────────────────────────────────────────────────┤
│                                               │
│ PK  id UUID                                   │
│ FK  user_id UUID → auth.users(id)            │
│     token TEXT (FCM Token)                   │
│     role TEXT (student/teacher/parent/admin) │
│     device_type TEXT (iOS/Android/Desktop)   │
│     is_active BOOLEAN                        │
│     created_at TIMESTAMP                     │
│     last_registered_at TIMESTAMP             │
│                                               │
├────────────────────────────────────────────────┤
│           Row Level Security (RLS)            │
├────────────────────────────────────────────────┤
│                                               │
│ Policy 1: Users can only see own tokens      │
│ WHERE auth.uid() = user_id                   │
│                                               │
│ Policy 2: Admins can see all tokens         │
│ WHERE EXISTS (                               │
│   SELECT 1 FROM admins                       │
│   WHERE admins.user_id = auth.uid()         │
│ )                                            │
│                                               │
├────────────────────────────────────────────────┤
│         Example Query Results                 │
├────────────────────────────────────────────────┤
│                                               │
│ ┌──────────────────────────────────────────┐ │
│ │ id    │ user_id    │ token      │ active │ │
│ ├───────┼────────────┼────────────┼────────┤ │
│ │ uuid1 │ user-123   │ dLQ5...nq8x│ true   │ │
│ │ uuid2 │ user-123   │ aBc9...xy2m│ true   │ │
│ │ uuid3 │ user-456   │ qpOr...zz7k│ false  │ │
│ │ uuid4 │ user-789   │ lmnO...pqr3│ true   │ │
│ │ ...   │ ...        │ ...        │ ...    │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ Indexes:                                     │
│ - idx_user_id (fast user queries)           │
│ - idx_token (fast token lookups)            │
│ - idx_is_active (filter active tokens)      │
│                                               │
└────────────────────────────────────────────────┘
```

---

## API Endpoint Specifications

### 1. Register/Unregister Token

```
POST /api/notifications/token

Request Body:
{
  "token": "dLQ5tKz9...nq8x",
  "action": "register" | "unregister",
  "role": "student"
}

Response (Success):
{
  "success": true,
  "message": "Token registered successfully"
}

Response (Error):
{
  "error": "User not authenticated"
}
```

### 2. Send Notifications

```
POST /api/admin/send-notification

Request Body:
{
  "title": "New Assignment",
  "body": "Math homework due tomorrow",
  "imageUrl": "https://...",
  "link": "/student/assignments",
  "target": "all" | "role" | "user" | "class",
  "targetValue": "student", // if role
  "data": { "type": "assignment", "id": "123" }
}

Response (Success):
{
  "success": true,
  "successCount": 150,
  "failureCount": 2,
  "message": "Sent 150 notifications..."
}

Response (Error):
{
  "error": "Invalid VAPID key"
}
```

---

## State Management Flow

```
User Permission State:
  ↓
  "default" → Dialog appears
  "granted" → Success message + setup listener
  "denied"  → Warning banner
  "no-support" → Browser warning

Token State:
  ↓
  null → Requesting...
  "dLQ5..." → Successfully obtained
  error → Failed to get token

API Call State:
  ↓
  loading: true → Showing spinner
  loading: false → Done
  error: string → Show error message
  success: boolean → Show confirmation

Notification Listener State:
  ↓
  Foreground messages:
    onMessage() handler active
    Shows in-app notification
    
  Background messages:
    Service Worker handles
    Shows system notification
```

---

## Security Architecture

```
┌─────────────────────────────────┐
│  Public Keys (Safe to Expose)   │
├─────────────────────────────────┤
│ VAPID Key (Firebase)            │ → Frontend
│ Firebase Config                 │ → Frontend
│ API Keys                        │ → Frontend
└─────────────────────────────────┘

┌──────────────────────────────────┐
│  Private Keys (Server Only)      │
├──────────────────────────────────┤
│ Firebase Service Account         │ → Backend
│ Firebase Private Key             │ → Backend
│ Admin Credentials                │ → Backend
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  Authentication Checks           │
├──────────────────────────────────┤
│ Frontend: getCurrentUser()       │ ← Auth Check
│ Backend: Admin verification     │ ← Admin Check
│ Database: RLS Policies          │ ← Data Check
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  Row Level Security (RLS)        │
├──────────────────────────────────┤
│ Users see only their tokens      │
│ Admins see all tokens            │
│ Un-authed users see nothing      │
└──────────────────────────────────┘
```

---

## Performance Considerations

```
Token Registration:
  ├─ Get FCM token: ~1-2 seconds
  ├─ Save to Supabase: ~500-1000ms
  └─ Total: ~2-3 seconds

Sending to 1000 users:
  ├─ Query tokens: ~100ms
  ├─ Batch into 10 calls (100 each): ~500ms total
  ├─ Firebase processing: ~2-5 seconds
  └─ Total: ~3-6 seconds

Caching:
  ├─ Tokens cached until browser cleared
  ├─ No need to re-request unless token invalid
  └─ Token refresh: automatic in service worker

Cleanup:
  ├─ Old tokens removed by migration
  ├─ Inactive tokens marked after 30 days
  └─ Prevents token bloat
```

---

This architecture ensures:

✅ **Reliable** - Fallbacks for all failure cases
✅ **Secure** - RLS, authentication, key separation
✅ **Scalable** - Batch sending, indexed queries
✅ **User-friendly** - Clear permissions, iOS support
✅ **Maintainable** - Modular components, clear separation
