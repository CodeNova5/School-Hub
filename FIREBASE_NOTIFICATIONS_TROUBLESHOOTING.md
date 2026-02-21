# 🔧 Firebase Notifications - Troubleshooting Guide

## Common Issues & Solutions

---

## ❌ Service Worker Not Registering

### Symptoms
- Console shows: "SW registration failed"
- Service Worker tab is empty in DevTools

### Solutions

**Check 1: File Location**
```
✓ CORRECT:  public/firebase-messaging-sw.js
✗ WRONG:    app/public/firebase-messaging-sw.js
✗ WRONG:    src/public/firebase-messaging-sw.js
```

**Check 2: Script Registration**
Ensure your layout.tsx has:
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

**Check 3: Browser Support**
Service Workers require:
- HTTPS (or localhost for testing)
- Modern browser (Chrome, Firefox, Edge)
- Not supported in some private browsing modes

**Check 4: Console Errors**
```javascript
// In browser console:
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log(regs));
// Should show your SW if registered
```

---

## ❌ Permission Dialog Not Appearing

### Symptoms
- Modal never shows up
- User can't enable notifications

### Solutions

**Check 1: Notification API Support**
```javascript
// In browser console:
console.log('Notification' in window); // Should be true
console.log(Notification.permission); // Should be "default" initially
```

**Check 2: Component Mounted**
```tsx
// Verify component is added to page:
<NotificationPermissionComponent role="student" autoPromptDelay={3000} />

// If inside conditional, make sure condition is true
{showNotifications && <NotificationPermissionComponent ... />}
```

**Check 3: Auto-Prompt Delay**
```tsx
// Default is 3000ms (3 seconds). Increase if need more time:
<NotificationPermissionComponent autoPromptDelay={5000} />
```

**Check 4: Permission Already Set**
```javascript
// In console:
Notification.permission
// If "granted" or "denied": already set, won't show again
// To reset for testing: Chrome Menu → Privacy → Clear browsing data
```

---

## ❌ "Notifications not supported" Error

### Symptoms
- Error message showing in component
- Notifications can't be enabled

### Solutions

**Check 1: Browser Support**
- ✓ Chrome 50+
- ✓ Firefox 48+
- ✓ Edge 17+
- ✓ Opera 37+
- ✗ Safari (needs PWA on iOS)
- ✗ Very old browsers

**Check 2: HTTPS Required**
- ✓ Production (automatically HTTPS)
- ✓ localhost (OK for testing)
- ✗ HTTP (not localhost) - Won't work!

**Check 3: Private/Incognito Mode**
- Some browsers disable notifications in private mode
- Test in normal window

**Check 4: User Agent Check**
```javascript
// Check if device is iOS and not PWA:
const ua = navigator.userAgent.toLowerCase();
const isIOS = /iphone|ipad|ipod/.test(ua);
const isPWA = window.navigator.standalone === true; 
// If isIOS && !isPWA: needs PWA install
```

---

## ❌ Token Not Saving to Supabase

### Symptoms
- Permission granted
- No console errors
- But tokens don't appear in Supabase

### Solutions

**Check 1: User Authentication**
```typescript
// In browser console:
const user = await getCurrentUser();
console.log('User:', user);
// Should return user object, not null
```

**Check 2: Supabase Credentials**
```bash
# Check .env.local has Supabase credentials:
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY
```

**Check 3: RLS Policies**
```sql
-- Run in Supabase SQL Editor:
SELECT * FROM notification_tokens;
-- If permission denied: RLS policy issue
```

**Check 4: Network Request**
```javascript
// Open DevTools Network tab
// Look for: /api/notifications/token
// Should be POST request
// Response should show success

// If 401: Not authenticated
// If 403: Permission denied
// If 500: Server error
```

**Check 5: Migration Hasn't Run**
```sql
-- Check table exists:
SELECT * FROM information_schema.tables 
WHERE table_name = 'notification_tokens';
-- If not found: run migration

-- Run migration:
supabase migration up
```

---

## ❌ Firebase Config Errors

### Symptoms
- Console: "Firebase config is missing"
- "Invalid API key"
- "Project not configured"

### Solutions

**Check 1: Environment Variables**
```bash
# Restart dev server after editing .env.local:
npm run dev  # Kill (Ctrl+C) and restart

# Verify they loaded:
console.log(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
// Should show value, not undefined
```

**Check 2: Variable Names**
```env
# Correct format (must have NEXT_PUBLIC_ prefix):
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...

# Wrong (won't work):
FIREBASE_API_KEY=...
VAPID_KEY=...
```

**Check 3: Firebase Config Values**
```javascript
// Check in browser console:
import { initializeApp } from 'firebase/app';

// Your config should have all these:
const config = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

---

## ❌ iOS Notifications Not Working

### Symptoms
- Works on Android/Desktop
- iOS shows permission but no notifications

### Solutions

**IMPORTANT: iOS Special Requirements**

iOS web push only works in PWA mode:

```
1. Open app in Safari
2. Tap Share icon (bottom of screen)
3. Look for "Add to Home Screen"
4. Tap it
5. Name the app (default is fine)
6. Tap Add
7. Close Safari
8. Open app from HOME SCREEN icon
9. Now request permission
10. THEN notifications work
```

**Check 1: Verify PWA Installation**
```javascript
// In browser console (iOS):
window.navigator.standalone
// true = installed as PWA ✓
// false = web browser ✗
```

**Check 2: Clear iOS Browser Cache**
```
iPhone Settings → Safari → Clear History and Website Data
Then try again
```

**Check 3: iOS Version**
- Requires iOS 14.3+
- Check in Settings → General → About

---

## ❌ Notifications Show But Don't Click

### Symptoms
- Notification appears
- Clicking does nothing
- No navigation happens

### Solutions

**Check 1: Link Format**
```typescript
// In notification payload:
data: {
  link: "/student/assignments",  // ✓ Relative path
  link: "https://yourapp.com/...", // ✓ Absolute URL
  link: "",  // ✗ Empty - does nothing
}
```

**Check 2: Service Worker Handling**
In `public/firebase-messaging-sw.js`:
```javascript
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.link || "/";
  
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clients) => {
      // Check if already open
      for (let client of clients) {
        if (client.url === urlToOpen) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(urlToOpen);
    })
  );
});
```

**Check 3: Foreground Message Handler**
```typescript
// Make sure this runs:
setupForegroundMessageHandler()

// In hook:
useEffect(() => {
  setupForegroundMessageHandler(); // Call this!
}, []);
```

---

## ❌ "Invalid VAPID Key" Error

### Symptoms
- Console: "messaging/invalid-vapid-key"
- "VAPID key not valid"

### Solutions

**Check 1: Generate VAPID Key**
```
Firebase Console 
→ Cloud Messaging
→ Web configuration
→ Generate Key Pair (if red message shows)
→ Copy PUBLIC key
```

**Check 2: Set Correct Variable**
```env
# Must be NEXT_PUBLIC_ for browser:
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_public_key_here

# Don't use private key!
# Private key is for server-only
```

**Check 3: Restart Dev Server**
```bash
# Changes to .env.local require restart:
npm run dev  # (kill and restart)
```

**Check 4: Verify in Code**
```typescript
// In getToken call:
const token = await getToken(messaging, {
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
});
// Should have value, not undefined
```

---

## ❌ Tokens Appearing but Not Getting Notifications

### Symptoms
- Tokens saved in Supabase
- No errors
- But notifications don't arrive

### Solutions

**Check 1: Token is Active**
```sql
-- Check in Supabase:
SELECT * FROM notification_tokens WHERE user_id = 'user-id';
-- Look for is_active = true
```

**Check 2: Admin SDK Setup**
Sending requires Firebase Admin SDK:
```bash
npm install firebase-admin
```

**Check 3: Service Account Has Permission**
```
Firebase Console
→ Project Settings
→ Service Accounts
→ Make sure role includes "Cloud Messaging"
```

**Check 4: Token Format**
```javascript
// Token should be long string:
"dLQ5...very_long_string...nq8x"

// Not this:
undefined, null, "", "bearer token"
```

---

## ❌ Batch Send Not Working

### Symptoms
- Single token works
- Multiple tokens fails
- "messaging/invalid-argument"

### Solutions

**Check 1: Batch Size**
```javascript
// Firebase limits to 500 per call:
const messages = tokens.slice(0, 500); // Max 500

// For more, split into multiple calls
```

**Check 2: Token Format**
```javascript
// Correct:
const messages = tokens.map(t => ({
  token: t.token,
  notification: { /* ... */ }
}));

// Wrong (mixing token types):
const messages = tokens.map(t => ({
  token: t,  // If t is already token string, this works
  // But if t is object, need: t.token
}));
```

---

## ❌ "No active tokens found" When Sending

### Symptoms
- Try to send notification
- Get "No active tokens found"
- But users have granted permission

### Solutions

**Check 1: Migration Ran**
```sql
-- Verify table exists:
\dt notification_tokens
-- Should show the table
```

**Check 2: Tokens Actually Saved**
```sql
-- Query in Supabase:
SELECT COUNT(*) FROM notification_tokens WHERE is_active = true;
-- Should show > 0
```

**Check 3: Role Matching**
```sql
-- If sending by role:
SELECT * FROM notification_tokens WHERE role = 'student';
-- Make sure some exist with that role
```

**Check 4: Time Zone Issues**
```sql
-- Inactive tokens might be filtered:
SELECT * FROM notification_tokens 
WHERE is_active = false;
-- Check last_registered_at times
```

---

## ❌ Browser Tab Not Focused on Notification

### Symptoms
- Notification shows when app closed
- But when tab open with app, message doesn't show

### Solutions

**Check 1: Foreground Handler**
```typescript
// Must call this when getting permission:
setupForegroundMessageHandler()

// In use-notification-setup.ts:
useEffect(() => {
  if (permission === "granted") {
    setupForegroundMessageHandler(); // Add this
  }
}, [permission]);
```

**Check 2: Notification Sound**
```javascript
// If notifications silent in foreground:
onMessage(messaging, (payload) => {
  if (payload.notification) {
    // Play sound if desired:
    new Audio('/notification-sound.mp3').play();
  }
});
```

---

## ✅ Quick Debug Checklist

```javascript
// Paste in browser DevTools console to check all:

// 1. Notification API
console.log('1. Notification support:', 'Notification' in window);

// 2. Permission status
console.log('2. Permission:', Notification.permission);

// 3. Service Worker
console.log('3. Service Worker:', 'serviceWorker' in navigator);
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log('   Registered SWs:', regs.length));

// 4. Firebase
console.log('4. Firebase API Key:', 
  !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log('   VAPID Key:', 
  !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);

// 5. User Auth
import { getCurrentUser } from '@/lib/auth';
getCurrentUser().then(u => console.log('5. User:', u?.email));

// 6. Device Type
const ua = navigator.userAgent.toLowerCase();
console.log('6. Device:', 
  /iphone/.test(ua) ? 'iOS' : 
  /android/.test(ua) ? 'Android' : 'Desktop');
```

---

## 🆘 Still Stuck?

1. **Check browser DevTools Console** - Most issues logged there
2. **Check Firebase Console** - Cloud Messaging section for logs
3. **Review FCM_SETUP_GUIDE.md** - Thorough walkthrough
4. **Check `.env.local`** - Credentials correct?
5. **Restart Dev Server** - `npm run dev`
6. **Clear Browser Cache** - Ctrl+Shift+Del (or Cmd+Shift+Del)

---

## 📋 Before Contacting Support

- [ ] Run all checks in "Quick Debug Checklist" above
- [ ] Check browser console for errors
- [ ] Verify `.env.local` has all values
- [ ] Confirm service worker is registered
- [ ] Test on different browser if possible
- [ ] Check Firebase Console for logs
- [ ] Verify Supabase migration ran
- [ ] Try incognito/private window

---

## 🔗 Useful Links

- [Firebase Console](https://console.firebase.google.com/)
- [Supabase Console](https://app.supabase.com/)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Specification](https://www.w3.org/TR/push-api/)
