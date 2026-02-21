# 🔐 Firebase Admin SDK Setup Guide

## Overview

Firebase Admin SDK allows your backend to send notifications, manage users, and perform admin operations. This is what actually sends the push notifications to users' devices.

---

## Prerequisites

✅ Firebase Admin SDK installed: `npm install firebase-admin`  
✅ Frontend FCM setup complete  
✅ Firebase project created

---

## Step 1: Get Service Account Key

### From Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Settings** (⚙️) → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. A JSON file downloads - **save this securely**

The file looks like:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xyz@your-project-id.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

---

## Step 2: Add to Environment

### Option A: As JSON String (Recommended for security)

Edit `.env.local`:

```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...full-json...}'
```

**How to do it:**
1. Open the downloaded JSON file
2. Copy ALL its content
3. Paste it in `.env.local` as shown above (wrapped in quotes)

### Option B: As File Path (Easier but less secure)

```env
FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/service-account-key.json
```

Then update `lib/firebase-admin.ts`:
```typescript
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string;
const serviceAccountJson = JSON.parse(
  require('fs').readFileSync(serviceAccountPath, 'utf-8')
);
```

### Option C: Base64 Encoded (Good balance)

```bash
# Encode the JSON
cat service-account-key.json | base64 > serviceaccount.b64

# Copy contents to .env.local
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=<paste-base64-here>
```

Then in `lib/firebase-admin.ts`:
```typescript
const serviceAccountJson = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString()
);
```

---

## Step 3: Setup in Code

The setup is already done! Here's how it works:

### `lib/firebase-admin.ts`
- Initializes Admin SDK once (when first called)
- Gets service account from `FIREBASE_SERVICE_ACCOUNT_KEY`
- Handles errors gracefully
- Provides helper functions

### `app/api/admin/send-notification/route.ts`
- Already configured to use Admin SDK
- Calls `sendNotificationsToMultiple()`
- Validates admin user
- Returns success/failure counts

---

## Step 4: Test Setup

### Test 1: Check Environment
```bash
# In your terminal, verify env is loaded:
npm run dev

# Check server logs for:
# ✓ Firebase Admin SDK initialized
```

### Test 2: Send Test Notification
```bash
# Using curl:
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test",
    "target": "user",
    "targetValue": "your-user-id"
  }'

# You should get:
# {
#   "success": true,
#   "successCount": 1,
#   "failureCount": 0,
#   "message": "Sent 1 notification"
# }
```

### Test 3: Use Admin Panel
1. Go to your admin dashboard
2. Use the "Send Notifications" component
3. Select recipient group
4. Write title & message
5. Click Send
6. Check if notification appears!

---

## Available Functions

### Send to Multiple Tokens
```typescript
import { sendNotificationsToMultiple } from "@/lib/firebase-admin";

const result = await sendNotificationsToMultiple(
  ["token1", "token2", "token3"],
  {
    title: "New Assignment",
    body: "Math homework due tomorrow",
    imageUrl: "https://..."
  },
  {
    type: "assignment",
    id: "123"
  }
);

// Returns:
// { successCount, failureCount, errors, failedTokens }
```

### Send to Single Token
```typescript
import { sendNotificationToToken } from "@/lib/firebase-admin";

const result = await sendNotificationToToken(
  "fcm-token-here",
  {
    title: "Grade Posted",
    body: "Your Math test grade is ready"
  }
);
```

### Subscribe to Topic
```typescript
import { subscribeToTopic } from "@/lib/firebase-admin";

await subscribeToTopic(
  ["token1", "token2"],
  "class-1a"
);

// Now you can send to all tokens in the topic
```

### Send to Topic
```typescript
import { sendNotificationToTopic } from "@/lib/firebase-admin";

await sendNotificationToTopic(
  "class-1a",
  {
    title: "Class Announcement",
    body: "Next class moved to 2 PM"
  }
);
```

---

## Sending from Different Scenarios

### From API Route
Already set up in `/api/admin/send-notification`

### From Cron Job / Scheduled Task
```typescript
import { sendNotificationsToMultiple } from "@/lib/firebase-admin";
import { supabase } from "@/lib/supabase";

// This would run on a schedule (e.g., daily at 8 AM)
export async function sendAssignmentReminders() {
  // Get assignments due tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, class_id")
    .gte("due_date", tomorrow.toISOString())
    .lt("due_date", new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString());

  // For each assignment, send to that class
  for (const assignment of assignments || []) {
    // Get student tokens in the class
    const { data: tokens } = await supabase
      .from("notification_tokens")
      .select("token")
      .eq("role", "student")
      .eq("is_active", true)
      // Join with students/classes to filter by class
      .eq("students.class_id", assignment.class_id);

    await sendNotificationsToMultiple(
      tokens?.map(t => t.token) || [],
      {
        title: "Assignment Reminder",
        body: `${assignment.title} due tomorrow`,
      },
      {
        type: "assignment",
        id: assignment.id,
        link: "/student/assignments"
      }
    );
  }
}
```

### From Server Action
```typescript
import { sendNotificationsToMultiple } from "@/lib/firebase-admin";

export async function notifyGradePosted(
  studentId: string,
  assignmentName: string,
  grade: number
) {
  // Get student's tokens
  const { data: tokens } = await supabase
    .from("notification_tokens")
    .select("token")
    .eq("user_id", studentId)
    .eq("is_active", true);

  if (tokens?.length) {
    await sendNotificationsToMultiple(
      tokens.map(t => t.token),
      {
        title: "Grade Posted",
        body: `${assignmentName}: ${grade}%`
      },
      {
        type: "grade",
        link: "/student/results"
      }
    );
  }
}
```

---

## Troubleshooting

### Error: "FIREBASE_SERVICE_ACCOUNT_KEY not set"
- Check `.env.local` exists in project root
- Verify the key is set exactly as: `FIREBASE_SERVICE_ACCOUNT_KEY=...`
- Restart dev server: `npm run dev`

### Error: "Failed to parse service account"
- Key might be malformed
- Check for missing quotes or escaped characters
- Remove `FIREBASE_SERVICE_ACCOUNT_KEY`, regenerate key from Firebase

### Error: "Insufficient permissions"
- Service account might not have messaging permissions
- Go to Firebase Console → Service Accounts
- Click the service account
- Go to Permissions (IAM)
- Ensure role includes **Cloud Messaging Admin**

### "No active tokens found"
- Users haven't enabled notifications yet
- Or tokens are marked inactive
- Check Supabase: `SELECT * FROM notification_tokens WHERE is_active = true`

### Notifications don't arrive
- Check `successCount` - if 0, no sends attempted
- Check `failureCount` - if > 0, see error messages
- Verify tokens are still active
- Check browser console for errors

---

## Security Best Practices

### ✅ DO:
- Store service account key in `.env.local` (not in code)
- Validate user is admin before sending
- Use `.env.local` for all sensitive data
- Rotate keys periodically

### ❌ DON'T:
- Commit `.env.local` to git
- Share service account key
- Expose key in client-side code
- Log full error messages with keys

### .gitignore
Make sure this includes:
```
.env.local
.env*.local
service-account-key.json
```

---

## Performance Tips

### Batch Sending
- Firebase can handle up to 500 tokens per batch
- Our code automatically batches larger sends
- For 10,000+ recipients, consider topics

### Use Topics
```typescript
// Instead of sending to 10,000 individual tokens:
await sendNotificationToTopic("all-students", notification);

// First, subscribe users to topic when they enable notifs:
await subscribeToTopic([token], "all-students");
```

### Schedule Heavy Sends
- Send to thousands during off-peak hours
- Use a job scheduler (e.g., cron)
- Don't send from user request

---

## Next Steps

1. ✅ Get service account key from Firebase
2. ✅ Add to `.env.local`
3. ✅ Test from admin panel
4. ✅ Set up automated sends (assignments, grades, etc.)

---

## Reference

- [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup)
- [Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging/admin)
- [Service Accounts Guide](https://firebase.google.com/docs/admin/setup#service_accounts)

---

## Example Complete Workflow

```
1. User enables notifications in app
   ↓
   Token saved to Supabase

2. Admin sends notification via panel
   ↓
   POST /api/admin/send-notification
   ↓
   Queries tokens from Supabase
   ↓
   Calls Firebase Admin SDK
   ↓
   Batches to Firebase (max 500 at a time)

3. Firebase sends via FCM
   ↓
   Device receives notification
   ↓
   User sees notification
   ↓
   User clicks
   ↓
   App opens to specified page
```

You're all set! Firebase Admin SDK is now ready to send notifications. 🎉
