# 🔑 Getting Firebase Service Account Key - Quick Guide

## In 3 Steps

### Step 1: Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your **School Hub** project
3. Click the **⚙️ Settings icon** (top left, next to project name)
4. Select **Project Settings**

### Step 2: Service Accounts Tab
1. Look for the **Service Accounts** tab (next to General, Users and Permissions, etc.)
2. Click it
3. Make sure "Node.js" is selected in the dropdown

### Step 3: Generate Private Key
1. Scroll down to **Private Keys** section
2. Click **Generate New Private Key**
3. A **JSON file downloads** - this is your service account key
4. **Keep this file safe!** Don't share it!

---

## Add to .env.local

### Option A: As JSON Text (Recommended)

```bash
# 1. Open the downloaded JSON file in a text editor
# 2. Copy THE ENTIRE CONTENTS (everything inside the file)
# 3. Edit .env.local and add:

FIREBASE_SERVICE_ACCOUNT_KEY=<paste-entire-json-here>
```

Example (.env.local):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDf...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BFy...
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"school-hub-123","private_key":"-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...","client_email":"firebase-adminsdk-xyz@school-hub-123.iam.gserviceaccount.com",...}
```

### Option B: Copy Into File (Easier)

```bash
# 1. Copy the downloaded JSON file to your project root
# 2. Rename it: service-account-key.json
# 3. In .env.local, add:
FIREBASE_SERVICE_ACCOUNT_KEY=service-account-key.json

# 4. Update lib/firebase-admin.ts:
# Replace JSON.parse(serviceAccount) with:
# const fs = require('fs');
# const serviceAccountJson = JSON.parse(fs.readFileSync(serviceAccount, 'utf-8'));
```

### Option C: Base64 Encoded (Best Security)

```bash
# 1. In terminal, in the directory with service-account-key.json:
base64 service-account-key.json

# 2. Copy the output
# 3. In .env.local:
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=<paste-base64-here>
```

---

## What NOT to Do ⚠️

❌ Don't commit service-account-key.json to git
❌ Don't share the file with anyone
❌ Don't paste it in Slack/email
❌ Don't upload it to GitHub

---

## Verify It Works

1. Restart dev server:
   ```bash
   npm run dev
   ```

2. Check server logs - you should see:
   ```
   ✓ Firebase Admin SDK initialized
   ```

3. Try sending a notification via the admin panel

---

## Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT_KEY not set"
- Check `.env.local` exists in project root
- Verify you added the environment variable
- Restart dev server: `npm run dev`

### "Failed to parse service account"
- Check JSON is valid (no missing quotes/commas)
- Regenerate key from Firebase Console
- Try Option C (base64 encoding)

### "Permission denied" errors
- Service account might not have right permissions
- Go to Firebase Console → Service Accounts
- Click the account email link
- In Google Cloud Console, assign **Cloud Messaging Admin** role

---

## Regenerate Key (if compromised)

1. Firebase Console → Service Accounts
2. Click the three dots (...) next to the key
3. Select **Delete**
4. Click **Generate New Private Key** again
5. Update `.env.local`

---

## Next Step

👉 Add to `.env.local` and restart `npm run dev`

Then test sending a notification from the admin panel!
