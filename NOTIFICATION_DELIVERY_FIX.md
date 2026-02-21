# Notifications Delivery Issue - Troubleshooting Guide

## The Problem

The notification system was showing "successfully sent" notifications, but users weren't actually receiving them. This happened because:

1. **Firebase reports acceptance, not delivery**: When Firebase Admin SDK's `messaging.send()` returns a message ID, it only means Firebase accepted the message for delivery. Actual delivery depends on user device status, permissions, and token validity.

2. **Invalid/Expired tokens not being caught**: Many stored FCM tokens may be invalid or expired, but weren't being identified until Firebase tried to send to them.

3. **No token health monitoring**: The system had no way to detect if users had uninstalled the app, disabled notifications, or if tokens had become stale.

## The Solution

### 1. **Enhanced Delivery Tracking** (`lib/firebase-admin.ts`)
- Now tracks **invalid tokens separately** from other failures
- Detects token validity errors (invalid-argument, authentication-error, "Invalid registration token")
- Provides detailed error logging for each failed token
- Returns success rate percentage and detailed diagnostics

### 2. **Better Error Reporting** (`app/api/admin/send-notification/route.ts`)
- Returns delivery success rate percentage: `(successCount / totalTokens) * 100`
- Provides recommendations based on failure patterns:
  - No active tokens found
  - Invalid/expired tokens detected
  - Delivery rate too low
- Logs detailed summary including invalid token count

### 3. **Improved User Feedback** (`components/admin-send-notification.tsx`)
- Shows detailed delivery rates in toast messages
- Warns when success rate is below 100%
- Shows critical alerts when success rate is below 50%
- Displays specific recommendations for each failure scenario

### 4. **Token Health Diagnostics** (`lib/notification-utils.ts`)
- New `getTokenHealthDiagnostics()` function analyzes token health:
  - Total tokens vs active tokens
  - Stale tokens (not updated in 30 days)
  - Recently deactivated tokens
  - Per-role breakdown
  - Overall health score (0-100%)
- Provides specific recommendations for improvement

### 5. **Administrator Dashboard** (`app/admin/notifications/page.tsx`)
- New Health Status card showing:
  - Token health score with color coding (green/yellow/red)
  - Active vs inactive token counts
  - Stale token warnings
  - Specific recommendations
- Updates automatically when refreshing

### 6. **New Diagnostics API** (`app/api/admin/notifications/diagnostics/route.ts`)
- Provides token health information to the dashboard
- Accessible only to admin users
- Returns actionable recommendations

## What to Check Now

When notifications aren't being received, check:

1. **Token Health Score**: 
   - ✅ 80%+: System is healthy
   - ⚠️ 50-79%: Some token issues, users may need to re-register
   - ❌ <50%: Critical - many tokens are invalid

2. **Active Tokens**: 
   - If low/zero, users haven't registered for notifications
   - Have users open the app and grant notification permissions

3. **Stale Tokens**: 
   - If high, many users have disabled notifications or uninstalled
   - Consider prompting users to re-enable notifications

4. **Delivery Rate** (shown after sending):
   - 100%: Perfect - all notifications delivered
   - 50-99%: Some issues - check token health
   - <50%: Critical - most tokens are invalid

## Common Causes & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No active tokens | Users haven't registered for notifications | Ask users to open app and enable notifications |
| High stale token count | Users disabled notifications or uninstalled | Send prompt to re-register users |
| Invalid token errors | Tokens expired or device unregistered | Invalid tokens are auto-removed; users reinstall app |
| Low delivery rate after high success count | Service worker or PWA issues | Check browser console for service worker errors |
| Tokens in database but not delivering | Firebase credentials issue | Verify FIREBASE_SERVICE_ACCOUNT_KEY in .env.local |

## Implementation Details

### Error Detection
The system now catches these specific Firebase errors:
- `invalid-argument` - Token format is invalid
- `authentication-error` - Firebase auth failed
- Specific message patterns:
  - "Invalid registration token"
  - "not a valid registration token"

### Token Deactivation
Invalid tokens are automatically deactivated and won't be used for future sends.

### Success Metrics
- **True success count**: Notifications accepted by Firebase AND reaching valid tokens
- **Failure count**: Tokens that failed or were invalid
- **Success rate**: `(successCount / totalTokens) * 100` - realistic delivery percentage

## Testing

To verify the fix is working:

1. Send a notification to "All Users"
2. Check if the success rate is realistic (not 100% if there are any issues)
3. If rate is low, check the Health Status card for recommendations
4. Verify invalid tokens are being deactivated by checking token count over time

## Next Steps

If you still have delivery issues after these fixes:

1. **Check service worker**: Open DevTools → Application → Service Workers
2. **Verify FCM configuration**: Check if VAPID key is correct in `hooks/use-notification-setup.ts`
3. **Monitor token registration**: See how many users have active tokens
4. **Check browser console**: Look for any notification permission or service worker errors
5. **Test on actual device**: Some notification issues only appear on real mobile devices
