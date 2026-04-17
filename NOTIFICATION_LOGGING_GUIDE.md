# Notification Logging Guide

## Overview
Comprehensive logging has been added to the live sessions notification system to track exactly what's happening when notifications are sent to students.

## Where to View Logs

### 1. **Browser Console (Client-Side)**
- Open DevTools: `F12` or `Right-click → Inspect`
- Go to the **Console** tab
- Create a live session or start a session to see logs

### 2. **Server Console (Terminal)**
- Watch your Next.js development server terminal
- Run your project with: `npm run dev`
- Logs will appear in real-time as notifications are processed

### 3. **Database Logs (notification_logs table)**
- Check the `notification_logs` table in Supabase
- Includes metadata about what was sent and to whom

---

## Log Format & Structure

### Session Creation Flow
When you **create a live session**, you'll see:

```
=== LIVE SESSION CREATED ===
Session ID: [UUID]
Title: Mathematics Class
Status: scheduled
Scheduled: 2026-04-17T10:00:00.000Z to 2026-04-17T10:40:00.000Z
Initiating notification dispatch...

[NOTIFICATION] SessionId: [UUID] [START] Notification process initiated
[NOTIFICATION] SessionId: [UUID] Target: Subject | Title: "Mathematics Class"
[NOTIFICATION] SessionId: [UUID] [STEP 1] Fetching enrolled students for subject: [subject_id]
[NOTIFICATION] SessionId: [UUID] [STEP 1] Found 25 enrolled students
[NOTIFICATION] SessionId: [UUID] [STEP 2] Fetching user IDs for 25 students
[NOTIFICATION] SessionId: [UUID] [STEP 2] Found 25 students with valid user IDs
[NOTIFICATION] SessionId: [UUID] [STEP 3] Found 25 unique user IDs to notify
[NOTIFICATION] SessionId: [UUID] [STEP 4] Fetching notification tokens for 25 users
[NOTIFICATION] SessionId: [UUID] [STEP 4] Found 18 active notification tokens
[NOTIFICATION] SessionId: [UUID] [STEP 4] Users with tokens: 18 / 25
[NOTIFICATION] SessionId: [UUID] [STEP 5] Initializing Firebase Admin SDK
[NOTIFICATION] SessionId: [UUID] [STEP 6] Sending 18 notifications via Firebase...
[NOTIFICATION] SessionId: [UUID] [STEP 6] Firebase send completed
[NOTIFICATION] SessionId: [UUID] [RESULT] Success: 18 | Failed: 0
[NOTIFICATION] SessionId: [UUID] [STEP 7] Creating notification logs for database
[NOTIFICATION] SessionId: [UUID] [STEP 7] Inserting 25 notification logs into database
[NOTIFICATION] SessionId: [UUID] [SUCCESS] Notification logs saved to database
[NOTIFICATION] SessionId: [UUID] [COMPLETE] Notification process finished ✓

=== NOTIFICATION DISPATCH COMPLETE ===
```

### Session Start Flow
When you **start a live session**, you'll see:

```
=== SESSION ACTION: START ===
Session ID: [UUID]
New Status: live

=== SESSION STARTED ACTION ===
Session ID: [UUID]
Title: Mathematics Class
Action: start
Initiating 'class is now live' notification dispatch...

[LIVE_START] SessionId: [UUID] [START] Session started notification process initiated
[LIVE_START] SessionId: [UUID] Action: "Class is now live. Join now!" | Title: "Mathematics Class"
[LIVE_START] SessionId: [UUID] [STEP 1] Fetching enrolled students for subject: [subject_id]
[LIVE_START] SessionId: [UUID] [STEP 1] Found 25 enrolled students
... (similar steps as creation)
[LIVE_START] SessionId: [UUID] [COMPLETE] Session start notification process finished ✓

=== 'LIVE NOW' NOTIFICATION DISPATCH COMPLETE ===

=== SESSION UPDATE COMPLETE ===
```

---

## What Each Log Step Means

| Step | What Happens | What to Look For |
|------|--------------|-----------------|
| **STEP 1** | Fetches students enrolled in subject/class | Shows how many students are targeted |
| **STEP 2** | Retrieves user IDs linked to those students | Identifies valid user accounts |
| **STEP 3** | Deduplicates user IDs | Shows unique recipients |
| **STEP 4** | Fetches active FCM notification tokens | Critical: Shows token availability |
| **STEP 5** | Initializes Firebase Admin SDK | Prepares Firebase connection |
| **STEP 6** | Sends notifications via Firebase | Main delivery step |
| **RESULT** | Shows success/failure counts | **Key metric: Did all tokens work?** |
| **CLEANUP** | Deactivates failed tokens | Removes broken tokens from system |
| **STEP 7** | Saves notification log to database | Creates audit trail |

---

## Key Metrics to Monitor

### 1. **Token Availability**
```
Found 18 active notification tokens
Users with tokens: 18 / 25
```
- **Ideal**: All or most users have active tokens
- **Issue**: If fewer users have tokens, check if app notifications are enabled
- **What it means**: Users without tokens won't receive push notifications

### 2. **Firebase Send Results**
```
Success: 18 | Failed: 0
```
- **Good**: Success equals number of tokens sent
- **Bad**: If failed tokens appear, they're automatically deactivated

### 3. **Database Logging**
```
Inserting 25 notification logs into database
Notification logs saved to database
```
- Verifies that delivery attempts are recorded
- Can be queried later in `notification_logs` table

---

## Troubleshooting Guide

### Problem: "No enrolled students found"
```
[STEP 1] Found 0 enrolled students
```
**Solution**: Verify students are enrolled in the subject/class

---

### Problem: "No active notification tokens"
```
Found 0 active notification tokens
Found 0 / 25 users with tokens
```
**Solution**: 
- Students haven't enabled push notifications
- App notifications are disabled in their browser/device settings
- Tokens may have expired

---

### Problem: "Firebase send failed"
```
[ERROR] Firebase notification failed: [error message]
```
**Solution**:
- Check Firebase Admin SDK initialization
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables
- Check Firebase project credentials

---

### Problem: "Failed to insert logs into database"
```
[ERROR] Failed to insert logs: [error]
```
**Solution**:
- Verify `notification_logs` table exists in Supabase
- Check that user has permission to insert into the table
- Check table schema matches expected fields

---

## Log Fields in Database

Each notification log entry includes:

```javascript
{
  title: "Mathematics Class",
  body: "Class is now live. Join now!",
  link: "/student/live-classes",
  target: "user",
  target_value: "user_id",
  target_name: "Live Class Started",
  success_count: 1,
  failure_count: 0,
  total_recipients: 1,
  sent_by: "teacher_user_id",
  school_id: "school_id",
  created_at: "2026-04-17T10:05:00.000Z",
  metadata: {
    source: "live_class",
    live_session_id: "session_id",
    subject_class_id: "subject_id",
    class_id: "class_id",
    total_students_targeted: 25,
    total_tokens_used: 18
  }
}
```

---

## Real-Time Monitoring

### Option 1: Server Terminal
```bash
npm run dev
# Watch for [NOTIFICATION] and [LIVE_START] prefixes
```

### Option 2: Supabase Dashboard
```
1. Go to Supabase Dashboard
2. Select your project
3. Navigate to: SQL Editor or Table Editor
4. Query: SELECT * FROM notification_logs ORDER BY created_at DESC
5. Filter by created_at >= NOW() - INTERVAL 1 hour
```

### Option 3: Admin Dashboard (Future)
Look at `/app/admin/notifications/page.tsx` for a UI showing notification stats

---

## Example Scenarios

### Scenario 1: Full Success
```
[RESULT] Success: 25 | Failed: 0
Notification logs saved to database ✓
```
✅ All students with tokens received notifications

### Scenario 2: Partial Success (Some Users Without Tokens)
```
Found 18 active notification tokens
Users with tokens: 18 / 25
[RESULT] Success: 18 | Failed: 0
```
⚠️ 18 students received notifications, 7 have no active tokens

### Scenario 3: Some Firebase Failures
```
[RESULT] Success: 15 | Failed: 3
[CLEANUP] Deactivating 3 failed tokens
```
⚠️ 15 notifications sent, 3 failed (tokens likely expired)

### Scenario 4: No Tokens Available
```
Found 0 active notification tokens
[WARNING] No active tokens - skipping Firebase send
```
❌ No notifications can be sent

---

## Next Steps

1. **Enable Notifications in Your App**: Make sure students have enabled push notifications in their browser/app
2. **Monitor Logs**: Watch the server console during testing
3. **Check Supabase**: Review `notification_logs` table for patterns
4. **Test End-to-End**: Create a test live session and verify students receive notifications

---

## Questions?

- Check the `notification_logs` table for detailed delivery history
- Review server console logs with `[NOTIFICATION]` prefix
- Check browser console for client-side errors
- Verify Firebase Admin SDK setup in `.env.local`
