# Background Notification Display Fix

## Problem
Background notifications were not displaying the title and message properly, sometimes ending up in spam. This was happening because the system was sending data-only messages without proper notification payloads.

## Root Causes

1. **firebase-admin.ts** was sending only data-only Firebase messages
2. **Title and body fields were in the data object** instead of the notification field
3. **Missing `webpush` configuration** for proper web browser delivery
4. **No platform-specific notification settings** for Android, iOS, and web
5. **Service worker couldn't extract notification properly** from malformed messages

## What Was Fixed

### 1. **firebase-admin.ts** - Complete Overhaul
Updated THREE main functions to use proper notification payloads:

#### Changes:
- `sendNotificationToToken()` - Now sends proper multi-platform notifications
- `sendNotificationsToMultiple()` - Batch notification sending with correct payloads
- `sendNotificationToTopic()` - Topic-based notification with proper format

#### New Message Structure:
```typescript
{
  notification: {
    title: "Title",
    body: "Body", 
    imageUrl: "image.png"
  },
  data: {
    title: "Title",
    body: "Body",
    imageUrl: "image.png",
    // Custom data fields
  },
  webpush: {
    notification: {
      title: "Title",
      body: "Body",
      icon: "image.png",
      badge: "badge.png",
      tag: "notification",
      requireInteraction: false
    },
    fcmOptions: {
      link: "/"
    }
  },
  android: {
    priority: "high",
    notification: {
      title: "Title",
      body: "Body",
      icon: "ic_launcher",
      sound: "default",
      chanelId: "default"
    }
  },
  apns: {
    payload: {
      aps: {
        alert: {
          title: "Title",
          body: "Body"
        },
        sound: "default",
        badge: 1
      }
    }
  }
}
```

**Why this format works:**
- **notification field**: Firebase shows this on web browsers and appropriate platforms
- **webpush**: Ensures web browsers display with title and body in background
- **android**: Proper Android-specific parameters for high priority
- **apns**: iOS-compatible notification format
- **data field**: Includes fallback title/body for edge cases

### 2. **firebase-messaging-sw.js** - Service Worker Fix
Updated background message handler to:
1. Check notification field FIRST (primary source)
2. Fall back to data field if needed
3. Extract imageUrl from both sources
4. Added console logging for debugging

```javascript
// Now checks notification field first, then falls back to data
const notificationTitle = 
  payload.notification?.title || 
  payload.data?.title || 
  "New Notification";
```

### 3. **use-notification-setup.ts** - Already Correct
The foreground message handler was already properly extracting title/body from both fields - no changes needed.

### 4. **send-notification route** - Already Correct
The API route was already passing data correctly - no changes needed.

## How It Works Now

### Background Mode Flow:
1. Admin sends notification via `/api/admin/send-notification`
2. Route calls `sendNotificationsToMultiple()` with title and body
3. firebase-admin creates proper multi-platform message with:
   - `notification` field with title/body (primary)
   - `data` field with title/body (backup)
   - `webpush` config for web browsers
   - `android` config for Android devices
   - `apns` config for iOS devices
4. Firebase Cloud Messaging sends to device
5. Service worker receives in background
6. Service worker displays notification using title/body from notification field
7. Notification shows immediately with proper styling

### Foreground Mode Flow:
1. Same as background, but app is open
2. onMessage listener in `use-notification-setup.ts` triggers
3. Creates notification using Notification API
4. Displays immediately to user

## Testing the Fix

### 1. Test Background Notifications
```bash
# Build and deploy
npm run build
npm start

# Or for development
npm run dev
```

### 2. Send Test Notification
- Go to Admin dashboard
- Send notification with:
  - Title: "Test Notification"
  - Body: "Testing background display"
  - Image: Optional
- Close/minimize the app
- Check notification appears with title AND body

### 3. Verify No Spam
- Notifications should appear in main notification area
- NOT in "Other" or "Promotions" folder
- Should have proper formatting with icon/image if provided

### 4. Check Device Types
- **Web browser**: Should show with icon and notification styling
- **Android app**: Should show with priority high indicator
- **iOS app**: Should show with sound and badge

## Benefits of This Fix

✅ **Proper title and body display** in background mode
✅ **Cross-platform compatibility** (web, Android, iOS)
✅ **Prevents spam filtering** by using proper FCM payload
✅ **Fallback handling** for edge cases
✅ **Console logging** for debugging delivery issues
✅ **High priority on Android** for important notifications
✅ **Sound and badge on iOS** for visibility
✅ **Clickable notifications** with proper action handling

## Environment Variables Required

Make sure `.env.local` has:
```env
FIREBASE_SERVICE_ACCOUNT_KEY=<Your Firebase service account JSON>
NEXT_PUBLIC_SUPABASE_URL=<Your Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<Your Supabase service role key>
```

## Troubleshooting

### Notifications still not showing?
1. Check browser console for errors
2. Verify `is_active=true` in database for tokens
3. Check FCM token format is valid (should be ~150+ characters)
4. Ensure service worker is registered: Check DevTools → Application → Service Workers

### Still going to spam?
1. This fix implements proper FCM format - Gmail/providers should recognize it now
2. Verify sender reputation in Google Console
3. Consider topic-based subscriptions for better delivery

### Title/body still empty?
1. Check API request includes `title` and `body` fields
2. Verify database tokens are valid
3. Look at console logs for errors during send

## Files Modified

1. **lib/firebase-admin.ts** - Main notification sending logic
   - Updated `sendNotificationToToken()`
   - Updated `sendNotificationsToMultiple()`
   - Updated `sendNotificationToTopic()`

2. **public/firebase-messaging-sw.js** - Service worker message handling
   - Updated `messaging.onBackgroundMessage()` handler

No other files needed changes - they were already correct!

## References

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Firebase Admin SDK Messaging](https://firebase.google.com/docs/reference/admin/node/admin.messaging)
