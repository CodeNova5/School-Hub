# Notification Troubleshooting Guide

## Issues Fixed

The notifications system has been improved to work reliably in both active and inactive tab scenarios:

### 1. **Service Worker Registration**
- Now includes retry logic (retries every 5 seconds if registration fails)
- Automatically checks for updates every minute
- Better error logging and handling
- Validates browser support before registering

### 2. **Foreground Message Handling**
- Automatically sets up when notification permission is granted
- Persists across component lifecycle (no longer component-dependent)
- Added `requireInteraction: true` to keep notifications visible
- Uses `tag` property to group similar notifications

### 3. **Background Message Handling**
- Service worker now properly claims clients on activation
- Improved logging for debugging
- Added `requireInteraction: true` to ensure notifications aren't auto-dismissed
- Includes vibration patterns for better UX

### 4. **Notification Payload**
- Includes `requireInteraction: true` to prevent auto-dismissal
- Adds vibration patterns on Android
- Better icon and badge handling
- Proper image URL support

## Testing Checklist

### ✅ Before Testing
1. **Enable notifications in your browser:**
   - Chrome/Edge: Settings → Privacy and security → Site settings → Notifications
   - Firefox: Preferences → Privacy → Permissions → Notifications
   
2. **Clear old service workers:**
   - DevTools → Application → Service Workers → Unregister any old versions
   - Clear cache: DevTools → Application → Cache Storage → Delete all

3. **Open DevTools** (F12) to monitor logs

### ✅ Test 1: Tab Active Notifications (Foreground)
1. Open the app in a tab
2. Enable notifications when prompted
3. From Firebase Console or send-notification.js: Send a test notification
4. **Expected:** You see a notification immediately in the tab

**Debug Logs to check:**
```
✓ Service Worker registered: /
✓ Firebase initialized in Service Worker
✓ Foreground message handler setup successful
✓ Foreground message received
```

### ✅ Test 2: Tab Inactive Notifications (Background)
1. Open the app in a tab
2. Enable notifications
3. Switch to another tab or minimize
4. Send a test notification
5. **Expected:** You see a system notification appear

**Debug Logs to check:**
```
✓ Background message received
Displaying notification: [Title]
✓ Notification clicked
```

### ✅ Test 3: Tab Closed Notifications
1. Open the app (enable notifications)
2. Send a notification to get/save the FCM token
3. **Close the browser completely**
4. Send another notification while browser is closed
5. Open browser again
6. **Expected:** You might see notification in system tray (OS-dependent)

### ✅ Test 4: Token Registration
1. Open DevTools Network tab
2. Enable notifications
3. **Check Supabase:**
   ```sql
   SELECT * FROM notification_tokens WHERE user_id = 'your_id' ORDER BY created_at DESC LIMIT 1;
   ```
4. Token should be stored with `is_active = true`

### ✅ Test 5: Notification Click Handling
1. Receive a background notification
2. Click "Open" button in notification
3. **Expected:** Opens the link specified in notification data, or homepage if none

## Common Issues & Solutions

### Issue: Service Worker not registering
**Solution:**
- Check DevTools → Application → Service Workers
- Look for permission errors in browser console
- Clear browser cache and reload
- Check that `/firebase-messaging-sw.js` exists and is accessible

### Issue: Notifications work in foreground but not background
**Solution:**
- Service worker might not be active
- Try unregistering and re-registering: `navigator.serviceWorker.getRegistrations().then(r => r.forEach(rr => rr.unregister()))`
- Reload the page
- Wait 30 seconds for service worker to activate

### Issue: FCM token not saving to database
**Solution:**
- Check Supabase connection: `supabase.from('notification_tokens').select().limit(1)`
- Verify user is logged in: `getCurrentUser()` should return user data
- Check browser console for errors in `saveTokenToSupabase`

### Issue: Notifications not showing in Windows/Mac
**Solution:**
- Check browser notification settings (some disable notifications by default)
- Try different browsers (Chrome usually more reliable)
- Disable any notification blocking extensions
- Try Guest Mode to rule out extensions

### Issue: Permission prompt not appearing
**Solution:**
- Permission already denied: Reset in browser settings
- Auto-prompt is waiting 3 seconds by default: Wait or check `autoPromptDelay`
- Try requesting manually in DevTools:
```javascript
Notification.requestPermission().then(p => console.log(p))
```

## Checking Token in Database

```sql
-- See all notification tokens
SELECT id, user_id, token, is_active, created_at, last_registered_at 
FROM notification_tokens 
ORDER BY created_at DESC;

-- Check specific user
SELECT * FROM notification_tokens 
WHERE user_id = 'specific_user_id' 
AND is_active = true;

-- Count by device type
SELECT device_type, COUNT(*) as count 
FROM notification_tokens 
GROUP BY device_type;
```

## Testing with send-notification.js

```bash
# Install dependencies (if using Node.js script)
node send-notification.js

# Or use Firebase Admin console:
# Navigate to Messaging in Firebase Console
# Create new campaign → Test on device
```

## Browser DevTools Commands

```javascript
// Check if notifications are supported
'Notification' in window && 'serviceWorker' in navigator

// Request permission
Notification.requestPermission().then(p => console.log('Permission:', p))

// Check current permission
console.log('Current permission:', Notification.permission)

// Get FCM token (if messaging is initialized)
firebase.messaging().getToken({vapidKey: 'YOUR_VAPID_KEY'})
  .then(token => console.log('FCM Token:', token))

// Check service workers
navigator.serviceWorker.getRegistrations()
  .then(regs => regs.forEach(r => console.log('SW:', r)))

// Manually trigger test notification (development only)
new Notification('Test', {body: 'This is a test', icon: '/logo.png'})
```

## Expected Console Output

### When app loads:
```
✓ Service Worker registered: /
✓ Firebase initialized in Service Worker
```

### When user enables notifications:
```
✓ Notification permission: granted
✓ Foreground message handler setup successful
Token saved to Supabase
```

### When notification is sent:
```
✓ Notification sent to token. Message ID: [id]
```

### When notification is received:
```
✓ Foreground message received: {payload}
✓ Notification clicked: [tag]
```

## Performance & Health Check

```javascript
// Check service worker health
navigator.serviceWorker.controller ? '✓ SW active' : '✗ SW not active'

// Check notification permission
Notification.permission

// Check if FCM token exists
localStorage.getItem('fcm_token') ? '✓ Token stored' : '✗ No token'

// Performance
performance.measure('notifications-setup-time', 'navigationStart', 'notificationSetupComplete')
```

## Support Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
