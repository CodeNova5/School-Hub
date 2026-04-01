# 🎯 Firebase Admin SDK - Complete Setup Checklist

## Current Status

✅ Firebase Admin SDK installed (`npm install firebase-admin`)
✅ `lib/firebase-admin.ts` created with all helper functions
✅ API route `/api/admin/send-notification` updated to actually send
✅ Admin panel component ready to use
✅ Database ready to store tokens

**Next:** Get service account key and add to `.env.local`

---

## 📋 Complete Checklist

### Phase 1: Get Firebase Service Account Key (5 min)

- [ ] Open [Firebase Console](https://console.firebase.google.com/)
- [ ] Select your **School Deck** project
- [ ] Click **⚙️ Settings** → **Project Settings**
- [ ] Go to **Service Accounts** tab
- [ ] Make sure **Node.js** is selected
- [ ] Click **Generate New Private Key**
- [ ] JSON file downloads
- [ ] **Save it securely** (don't share!)

### Phase 2: Add to `.env.local` (3 min)

#### Option A: Paste JSON (Recommended)
- [ ] Open `.env.local` in your project root
- [ ] Open downloaded JSON file
- [ ] Copy **entire JSON contents**
- [ ] Add to `.env.local`:
```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```
- [ ] Save `.env.local`

#### Option B: Copy File (Easier)
- [ ] Move downloaded JSON to project root
- [ ] Rename to: `firebase-service-account.json`
- [ ] Update `lib/firebase-admin.ts` to read file instead of env
- [ ] Add to `.env.local`:
```env
FIREBASE_SERVICE_ACCOUNT_KEY=./firebase-service-account.json
```

#### Option C: Base64 Encode (Secure)
- [ ] In terminal:
```bash
cd your-project-root
base64 < firebase-service-account.json
```
- [ ] Copy output
- [ ] Add to `.env.local`:
```env
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=<paste-base64-here>
```
- [ ] Update `lib/firebase-admin.ts` to decode base64

### Phase 3: Verify & Test (10 min)

- [ ] Restart dev server: `Ctrl+C` then `npm run dev`
- [ ] Check terminal logs for:
```
✓ Firebase Admin SDK initialized
```
- [ ] If you see error, check:
  - [ ] `.env.local` file exists
  - [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` is set
  - [ ] JSON is valid (no broken escaping)
  - [ ] Dev server restarted

### Phase 4: Test Sending Notification (5 min)

#### Method 1: Admin Panel
1. [ ] Open your app
2. [ ] Go to Admin Dashboard
3. [ ] Find "Send Notifications" component
4. [ ] Select recipient: **All Users** or **By Role: Students**
5. [ ] Write title: `"Test Notification"`
6. [ ] Write body: `"If you see this, it works!"`
7. [ ] Click **Send Notification**
8. [ ] Check for response:
```json
{
  "success": true,
  "successCount": 5,
  "failureCount": 0,
  "message": "Sent 5 notifications"
}
```

#### Method 2: via cURL
```bash
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "title": "Test",
    "body": "Test notification",
    "target": "all"
  }'
```

#### Method 3: Firebase Console
1. [ ] Firebase Console → Cloud Messaging
2. [ ] Click "Send your first message"
3. [ ] Fill in notification details
4. [ ] Click "Send test message"
5. [ ] Select your FCM token
6. [ ] Send

### Phase 5: Verify Notifications Arrive (5 min)

- [ ] Keep dev server running
- [ ] Keep browser open to your app
- [ ] **If Admin Panel:**
  - [ ] Should see success response
  - [ ] Check browser notification (might need to click app first)
  - [ ] Foreground: notification shows in-app
  - [ ] Background: system notification (if app closed)

- [ ] **If Supabase:**
  - [ ] Go to Supabase dashboard
  - [ ] Check `notification_tokens` table
  - [ ] See tokens with `is_active = true`
  - [ ] More tokens = more successful sends

### Phase 6: Set Up Automated Sends (Optional)

- [ ] Create a function to send notifications on events:
```typescript
// When assignment is created:
await sendNotificationsToMultiple(
  studentTokens,
  { title: "New Assignment", body: assignmentTitle }
);

// When grade is posted:
await sendNotificationToToken(studentToken, {
  title: "Grade Posted",
  body: `${subject}: ${grade}%`
});

// Scheduled reminder (via cron job):
await sendNotificationToTopic(
  "class-1a",
  { title: "Reminder", body: "Classes start in 1 hour" }
);
```

---

## 🎯 Quick Reference

### Files to Know
- **`lib/firebase-admin.ts`** - Admin SDK initialization & helpers
- **`app/api/admin/send-notification/route.ts`** - Notification sending API
- **`components/admin-send-notification.tsx`** - UI for admins

### Environment Variable
```env
# Choose one of these:
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# OR
FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/file.json
# OR
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=base64-encoded-json
```

### Key Functions Available
```typescript
import { 
  sendNotificationToToken,        // Send to 1 token
  sendNotificationsToMultiple,    // Send to many tokens
  subscribeToTopic,               // Add tokens to topic
  unsubscribeFromTopic,           // Remove from topic
  sendNotificationToTopic         // Send to entire group
} from "@/lib/firebase-admin";
```

---

## 🔍 Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT_KEY not set"
**Status:** 500 error when sending
**Fix:**
1. Check `.env.local` exists in project root
2. Verify `FIREBASE_SERVICE_ACCOUNT_KEY=...` is present
3. Restart dev server: `npm run dev`

### "Failed to parse service account"
**Status:** JSON parse error
**Fix:**
1. Check JSON is valid (use online JSON validator)
2. No extra escaping needed
3. If Issues: Use base64 encoding (Option C)
4. Regenerate key from Firebase

### "Insufficient permissions"
**Status:** 403 error
**Fix:**
1. Firebase Console → Service Accounts
2. Click service account email
3. Google Cloud → Assign "Cloud Messaging Admin" role

### "No active tokens found"
**Status:** 200 OK but successCount = 0
**Fix:**
1. Users might not have enabled notifications yet
2. Check Supabase `notification_tokens` table:
```sql
SELECT * FROM notification_tokens WHERE is_active = true;
```
3. If empty: Grant notifications in app first

### Admin panel shows error
**Status:** "Admin access required" (403)
**Fix:**
1. Logged-in user might not be admin
2. Check Supabase `admins` table has user_id
3. Make sure user has admin role in system

### Notifications don't arrive
**Status:** successCount > 0 but no notification
**Fix:**
1. Device might be in Do Not Disturb mode
2. App notifications might be disabled
3. Permission might have been revoked
4. Check `is_active` tokens in Supabase
5. Check browser console for errors

---

## 📊 Monitoring & Maintenance

### Check Token Health
```sql
-- View all active tokens
SELECT COUNT(*) FROM notification_tokens WHERE is_active = true;

-- View tokens by device type
SELECT device_type, COUNT(*) 
FROM notification_tokens 
WHERE is_active = true 
GROUP BY device_type;

-- View tokens by role
SELECT role, COUNT(*) 
FROM notification_tokens 
WHERE is_active = true 
GROUP BY role;
```

### Clean Up Old Tokens
```sql
-- Mark old tokens as inactive (older than 30 days)
UPDATE notification_tokens 
SET is_active = false
WHERE last_registered_at < NOW() - INTERVAL '30 days';

-- Delete inactive tokens
DELETE FROM notification_tokens 
WHERE is_active = false 
AND last_registered_at < NOW() - INTERVAL '90 days';
```

### Check Send Success Rate
```typescript
// In API response:
const successRate = (result.successCount / tokensList.length) * 100;
console.log(`Success rate: ${successRate}%`);
```

---

## 🚀 Deployment Checklist

### Before Going to Production

- [ ] Service account key in `.env.local` (not `.env`)
- [ ] `.env.local` is in `.gitignore`
- [ ] Test sending from admin panel
- [ ] Test on actual devices (Android, iOS)
- [ ] Verify failed tokens are deactivated
- [ ] Set up monitoring for send failures
- [ ] Document how to rotate service account key

### Production Environment Setup

- [ ] Add `FIREBASE_SERVICE_ACCOUNT_KEY` to your hosting:
  - [ ] Vercel: Project Settings → Environment Variables
  - [ ] AWS: Systems Manager Parameter Store
  - [ ] Docker: Pass as environment variable
  - [ ] Heroku: Config Vars

- [ ] Test in production environment
- [ ] Monitor logs for errors
- [ ] Set up alerts for high failure rates

---

## 📞 Need Help?

| Issue | See Document |
|-------|--------------|
| How to get service account key | `GET_FIREBASE_SERVICE_ACCOUNT_KEY.md` |
| Complete admin SDK details | `FIREBASE_ADMIN_SDK_SETUP.md` |
| Notification setup overview | `FIREBASE_NOTIFICATIONS_QUICK_START.md` |
| Troubleshooting | `FIREBASE_NOTIFICATIONS_TROUBLESHOOTING.md` |
| Architecture details | `FIREBASE_SYSTEM_ARCHITECTURE.md` |

---

## ✨ You're Almost Done!

```
Status: Firebase Admin SDK Ready to Send!

What works now:
✅ Users can enable notifications
✅ Tokens stored in Supabase
✅ Admin panel can send to users
✅ Service Worker handles delivery
✅ Both foreground & background notifications

What you need to do:
1. Get service account key from Firebase
2. Add to .env.local
3. Restart dev server
4. Send a test notification!

Estimated time: 10 minutes
```

---

## Next Steps in Order

1. **GET SERVICE ACCOUNT KEY** (5 min)
   - Follow: `GET_FIREBASE_SERVICE_ACCOUNT_KEY.md`

2. **ADD TO .env.local** (2 min)
   - Copy key from Firebase
   - Paste into `.env.local`

3. **TEST SENDING** (5 min)
   - Restart dev server
   - Use admin panel to send
   - See if it works!

4. **SET UP AUTOMATION** (Later)
   - Send on assignment created
   - Send on grade posted
   - Send scheduled reminders

---

**👉 Start here:** `GET_FIREBASE_SERVICE_ACCOUNT_KEY.md`

**🎉 You're about to have a complete notification system!**
