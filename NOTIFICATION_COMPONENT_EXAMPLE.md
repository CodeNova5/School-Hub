// Example: How to integrate NotificationPermissionComponent in Student Dashboard
// File: app/student/page.tsx

// Add this import at the top:
import { NotificationPermissionComponent } from "@/components/notification-permission";

// Your existing imports:
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
// ... other imports

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  // ... your existing state

  // Your existing useEffect and functions...

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        
        {/* 🔔 ADD THIS AT THE TOP - NOTIFICATION PERMISSION */}
        {/* This will show a permission dialog after 3 seconds */}
        {/* It's prominent and stands out so users notice it */}
        <NotificationPermissionComponent 
          role="student"           // Match user role
          autoPromptDelay={3000}   // Show dialog after 3 seconds
        />

        {/* Your existing dashboard content below */}
        
        {/* Premium Welcome Header */}
        <div className="relative overflow-hidden">
          {/* ... existing code ... */}
        </div>

        {/* Attendance Alert */}
        {/* ... existing code ... */}

        {/* Premium Stats Grid */}
        {/* ... existing code ... */}

        {/* Recent Activities & Quick Links */}
        {/* ... existing code ... */}

        {/* Motivational Section */}
        {/* ... existing code ... */}

      </div>
    </DashboardLayout>
  );
}

/**
 * INTEGRATION IN OTHER DASHBOARD PAGES
 * 
 * Same pattern for:
 * - Teacher Dashboard: app/teacher/page.tsx
 * - Parent Portal: app/parent/page.tsx  
 * - Admin Dashboard: app/admin/page.tsx
 */

// Example for Teacher Dashboard: app/teacher/page.tsx
/*
export default function TeacherDashboard() {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        
        <NotificationPermissionComponent 
          role="teacher"
          autoPromptDelay={3000}
        />
        
        {/* Rest of teacher dashboard */}
      </div>
    </DashboardLayout>
  );
}
*/

// Example for Parent Portal: app/parent/page.tsx
/*
export default function ParentDashboard() {
  return (
    <DashboardLayout role="parent">
      <div className="space-y-8">
        
        <NotificationPermissionComponent 
          role="parent"
          autoPromptDelay={3000}
        />
        
        {/* Rest of parent portal */}
      </div>
    </DashboardLayout>
  );
}
*/

/**
 * COMPONENT PROPS
 * 
 * role?: "student" | "teacher" | "parent" | "admin"
 *   - Which role this notification is for
 *   - Helps track in database which users got what notifications
 *   - Default: "student"
 * 
 * autoPromptDelay?: number
 *   - Milliseconds before permission dialog auto-appears
 *   - 3000 (3 seconds) recommended - gives time to read page first
 *   - Set to 0 to show immediately
 *   - Set to large number (e.g., 10000) for less intrusive
 *   - Default: 3000
 */

/**
 * WHAT THE COMPONENT DOES
 * 
 * 1. Checks notification permission status
 * 2. Shows appropriate UI based on status:
 *    - Default: Shows permission dialog after delay
 *    - Granted: Shows success message
 *    - Denied: Shows warning banner
 *    - Unsupported: Shows browser warning
 * 
 * 3. When user grants permission:
 *    - Gets FCM token from Firebase
 *    - Saves token to Supabase with user info
 *    - Sets up foreground message handler
 *    - Shows success confirmation
 * 
 * 4. Special iOS handling:
 *    - Warns users they need to install as PWA first
 *    - Clear instructions on how to do it
 *    - Links to Fire base docs if needed
 */

/**
 * USER EXPERIENCE FLOW
 * 
 * DESKTOP / ANDROID:
 * 
 * Page loads
 *   ↓ (wait 3 seconds)
 * Dialog appears: "Stay Notified! 📬"
 *   ↓
 * User clicks "Enable Notifications"
 *   ↓
 * Browser shows permission request
 *   ↓
 * User clicks "Allow"
 *   ↓
 * Dialog closes
 * Success message shows: "✓ Notifications enabled"
 *   ↓
 * Token saved to Supabase
 *   ↓
 * Ready to receive notifications!
 * 
 * 
 * iOS:
 * 
 * Page loads
 *   ↓ (wait 3 seconds)
 * Dialog appears with WARNING:
 * "📱 iOS Users: Tap Share → Add to Home Screen"
 *   ↓
 * User taps "Maybe Later" or closes
 * (if they don't install as PWA)
 *   ↓
 * OR
 * 
 * User follows instructions:
 * 1. Taps Share
 * 2. Taps "Add to Home Screen"
 * 3. Installs app
 * 4. Closes Safari
 * 5. Opens app from home screen
 * 6. Dialog shows again (in PWA mode)
 * 7. User clicks "Enable Notifications"
 * 8. Browser permission appears
 * 9. User grants permission
 *   ↓
 * ✓ Notifications work (in PWA mode only!)
 */

/**
 * STYLING NOTES
 * 
 * The component uses your existing UI components:
 * - Button, Card, Alert from @/components/ui
 * - Dialog from @/components/ui
 * - Tailwind CSS for styling
 * 
 * Colors used:
 * - Blue gradient for main CTA
 * - Orange for iOS warning
 * - Green for success
 * - Red for errors
 * 
 * To customize:
 * Edit: components/notification-permission.tsx
 */

/**
 * TESTING CHECKLIST
 * 
 * [ ] Add component to dashboard
 * [ ] Visit page in browser
 * [ ] See dialog after 3 seconds
 * [ ] Click "Enable Notifications"
 * [ ] Grant browser permission
 * [ ] See success message
 * [ ] Check token in Supabase:
 *     notification_tokens table
 *     Filter by your user_id
 *     Should see new row with token
 * [ ] Send test notification:
 *     Firebase Console → Cloud Messaging
 *     Choose your token
 *     See notification appear!
 */

/**
 * COMMON MISTAKES TO AVOID
 * 
 * ✗ Forgetting to import component
 * ✗ Placing it at wrong location in layout
 * ✗ Using old component name
 * ✗ Not running app/layout.tsx updates
 * ✗ Not setting .env variables
 * ✗ Assuming iOS will work without PWA install
 */

/**
 * NEXT STEPS AFTER INTEGRATION
 * 
 * 1. Get Firebase credentials in .env.local
 * 2. Update app/layout.tsx with manifest + SW registration
 * 3. Run Supabase migration
 * 4. Add component to all dashboards
 * 5. Go to Firebase Console → Cloud Messaging
 * 6. Send a test notification
 * 7. See it appear in app!
 * 
 * See FIREBASE_NOTIFICATIONS_QUICK_START.md for detailed setup
 */
