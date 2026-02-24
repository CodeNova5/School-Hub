# Notification Duplicate & Foreground Configuration Fix

## Issues Fixed

### 1. **Duplicate Notifications (FIXED)**
**Problem:** Notifications were being sent twice because the Firebase Admin SDK was sending:
- A top-level `notification` field
- A `webpush.notification` field with identical content

This caused users to receive the same notification twice.

**Solution:** Removed the redundant top-level `notification` field from `firebase-admin.ts`. Now only the `webpush.notification` is sent, which is the correct approach for web notifications.

**Files Updated:**
- `lib/firebase-admin.ts` - All three notification functions updated:
  - `sendNotificationToToken()`
  - `sendNotificationsToMultiple()`
  - `sendNotificationToTopic()`

### 2. **Foreground Notifications (CONFIGURED)**
**Problem:** Foreground notifications weren't displaying properly with all visual elements.

**Solution:** Enhanced the foreground message handler in `hooks/use-notification-setup.ts` with:
- Better payload parsing that handles both `payload.notification` and `payload.data` fields
- Proper extraction of image URLs (`imageUrl`, `image` fields)
- Display of notification with `image` property for full rich notification support
- Actions array for Open/Close buttons
- Proper permission check before displaying notifications
- Added notification click handler setup

**Files Updated:**
- `hooks/use-notification-setup.ts` - Enhanced foreground handler with all notification properties

## How the Notification System Works Now

### Background Notifications (Service Worker)
- Handled by `public/firebase-messaging-sw.js`
- Automatically displays notifications when the app is closed/backgrounded
- Processes the `onBackgroundMessage` event

### Foreground Notifications (App Running)
- Handled by `hooks/use-notification-setup.ts`
- When app is open, the `onMessage` handler triggers
- Displays a notification using the Notification API
- Includes proper title, body, icon, and image

## How to Use

### 1. Request Notification Permission
```typescript
import { useNotificationSetup } from '@/hooks/use-notification-setup';

export function MyComponent() {
  const { requestNotificationPermission, token } = useNotificationSetup({
    role: 'student' // or 'teacher', 'parent', 'admin'
  });

  const handleEnableNotifications = async () => {
    const fcmToken = await requestNotificationPermission();
    console.log('FCM Token:', fcmToken);
  };

  return (
    <button onClick={handleEnableNotifications}>
      Enable Notifications
    </button>
  );
}
```

### 2. Send Notifications from Backend
```typescript
import { 
  sendNotificationToToken,
  sendNotificationsToMultiple 
} from '@/lib/firebase-admin';

// Send to single user
await sendNotificationToToken(
  userFcmToken,
  {
    title: 'New Assignment',
    body: 'You have a new assignment from your teacher',
    imageUrl: 'https://example.com/image.png'
  },
  {
    link: '/assignments/123',  // Where to navigate on click
    tag: 'assignment-123'      // Prevent duplicates
  }
);

// Send to multiple users
await sendNotificationsToMultiple(
  [token1, token2, token3],
  {
    title: 'Class Reminder',
    body: 'Don\'t forget about your class today!',
    imageUrl: 'https://example.com/class-image.png'
  },
  {
    link: '/class/456',
    tag: 'class-reminder'
  }
);
```

## Testing the Fix

1. **Foreground Test:**
   - Open your app in a browser tab
   - Send a notification while the app is active
   - You should see ONE notification displayed in the app

2. **Background Test:**
   - Close your app or navigate away
   - Send a notification
   - You should see ONE notification in your system tray
   - Clicking it should open the app to the specified link

3. **Verify No Duplicates:**
   - You should NOT receive two notifications
   - Check both foreground and background - should only see one in each scenario

## Message Structure (For Developers)

The notification message structure now uses:

```typescript
{
  token: 'user-fcm-token',
  webpush: {
    notification: {
      title: 'Notification Title',
      body: 'Notification body text',
      icon: '/logo.png',                    // App icon
      badge: '/logo.png',                   // Notification badge
      requireInteraction: true,              // Keeps notification until user acts
      vibrate: [200, 100, 200]              // Vibration pattern
    },
    fcmOptions: {
      link: '/destination-path'             // Where to navigate on click
    }
  },
  data: {
    // Custom data fields
    link: '/destination-path',
    tag: 'unique-id',
    imageUrl: 'https://...'                 // Image to display
  }
}
```

## Important Notes

- **iOS PWA:** Users should add the app to their home screen for notifications to work on iOS
- **Permission Required:** Notifications require explicit user permission
- **VAPID Key:** The public VAPID key in `hooks/use-notification-setup.ts` is configured correctly
- **Service Worker:** Must be registered (`public/firebase-messaging-sw.js`)
- **Data Fields:** Always include `link` in data for navigation on notification click

## Troubleshooting

**Notifications still appearing twice:**
- Clear browser cache
- Restart the development server
- Check that you're using the updated `firebase-admin.ts`

**Foreground notifications not showing:**
- Verify notification permission is granted
- Check browser console for error messages
- Ensure service worker is registered
- Make `setupForegroundMessageHandler` is called in your component

**Notifications not appearing at all:**
- Check notification permission status: `Notification.permission`
- Verify FCM token is being stored correctly
- Confirm Firebase config is correct in `lib/firebase.ts`
- Check server-side logs for sending errors
