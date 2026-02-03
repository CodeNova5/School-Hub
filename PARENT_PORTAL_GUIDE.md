# Parent Portal - Implementation Guide

## Overview
The Parent Portal has been successfully implemented, allowing parents to monitor their children's academic progress, attendance, assignments, and more through a dedicated interface.

## Key Features

### 1. **Multi-Child Support**
- Parents can have multiple children linked to the same email address
- All siblings share the same parent email for easy registration
- Parents view and manage all their children from a single dashboard

### 2. **Account Activation**
- When a student is created, an activation email is sent to the **parent_email** (not student email)
- Parents receive a secure activation link to set up their account
- If a parent already exists (has other children), they receive a notification email instead
- Activation links expire in 24 hours for security

### 3. **Parent Authentication**
- Dedicated login page at `/parent/login`
- Secure password-based authentication
- Role verification to ensure only parents can access parent portal

## Database Schema

### Parents Table
```sql
CREATE TABLE parents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  activation_token_hash TEXT,
  activation_expires_at TIMESTAMPTZ,
  activation_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)
- Parents can view their children (students with matching parent_email)
- Parents can view attendance, results, assignments, and timetables for their children
- Parents can view teachers and classes associated with their children
- All sensitive data is protected with RLS policies

## Pages & Routes

### Authentication Pages
- `/parent/login` - Parent login page
- `/parent/activate?token=xxx` - Account activation page

### Dashboard & Overview
- `/parent` - Redirects to dashboard
- `/parent/dashboard` - Main parent dashboard showing all children
- `/parent/children` - List view of all children with quick stats

### Child Detail Pages
- `/parent/student/[id]` - Comprehensive child profile
- `/parent/student/[id]/attendance` - Child's attendance records
- `/parent/student/[id]/results` - Child's academic results
- `/parent/student/[id]/assignments` - Child's assignments and submissions
- `/parent/student/[id]/timetable` - Child's class timetable

### Additional Pages
- `/parent/calendar` - School holidays and important dates
- `/parent/settings` - Parent account settings and profile management

## API Routes

### Parent-Specific APIs
- `/api/parent/validate-activation` (POST) - Validates activation token
- `/api/parent/activate` (POST) - Activates parent account and sets password

### Modified APIs
- `/api/create-student` - Updated to create/link parent accounts and send activation emails to parent_email

## How to Register Students with Siblings

### Admin Process:
1. When creating a student in `/admin/students`, fill in all student details
2. **Important:** Use the **same parent email** for siblings
3. System automatically:
   - Creates parent account if it doesn't exist
   - Links student to existing parent if account exists
   - Sends appropriate email (activation or notification)

### Example:
```
Student 1:
- Name: John Doe
- Email: john.doe@student.com
- Parent Email: parent@example.com  ← Creates parent account

Student 2 (Sibling):
- Name: Jane Doe
- Email: jane.doe@student.com
- Parent Email: parent@example.com  ← Links to existing parent
```

## Parent Dashboard Features

### Overview Cards
- Total children count
- Active students count
- Average attendance across all children
- Total pending assignments

### Children Cards
Each child card shows:
- Student name and ID
- Class and department
- Status badge
- Attendance percentage
- Pending assignments count
- Latest result (if available)
- Quick action buttons

### Quick Actions
Parents can quickly navigate to:
- View attendance records
- View academic results
- View assignments and submissions
- View class timetable
- View full child profile

## Security Features

1. **Token-Based Activation**
   - Secure SHA-256 hashed tokens
   - Time-limited activation links (24 hours)
   - Single-use tokens

2. **Row-Level Security**
   - Parents can only access their own children's data
   - Automatic filtering by parent_email
   - Protected API endpoints

3. **Role Verification**
   - User role verified on login
   - Unauthorized access redirected to login
   - Session-based authentication

## Email Templates

### New Parent Activation Email
```
Subject: Activate Your Parent Portal Account

Hello [Parent Name],

A student account has been created for your child/ward: [Student Name].

Click the link below to activate your parent portal account and set your password:
[Activation Link]

Once activated, you'll be able to view your child's academic progress, attendance, assignments, and more.

This link expires in 24 hours.
```

### Existing Parent Notification Email
```
Subject: New Student Added to Your Account

Hello [Parent Name],

A new student has been added to your parent portal account:
[Student Name] (ID: [Student ID])

You can now view their information in your parent portal.
```

## Migration Required

Run the migration file to set up the database:
```bash
# Apply the migration
supabase/migrations/20260203_parent_portal.sql
```

This creates:
- Parents table
- Indexes for performance
- RLS policies for security
- Linking policies for student data access

## User Guide for Parents

### First Time Setup:
1. Receive activation email at parent email address
2. Click activation link
3. Set secure password (minimum 8 characters)
4. Login to parent portal

### Daily Usage:
1. Login at `/parent/login`
2. View all children on dashboard
3. Click any child to see detailed information
4. Navigate to specific sections:
   - Attendance tracking
   - Academic results
   - Assignment progress
   - Class timetable
5. Update profile in settings as needed

## Best Practices

### For School Administrators:
1. **Always verify parent email** before creating students
2. **Use the same email** for siblings
3. **Inform parents** to check spam folder for activation email
4. **Keep parent contact info updated** in student records

### For Parents:
1. **Activate account promptly** (within 24 hours)
2. **Use strong passwords** for security
3. **Check portal regularly** for updates
4. **Keep contact information current**
5. **Report issues** to school administration

## Troubleshooting

### Parent can't receive activation email:
- Check spam/junk folder
- Verify email address is correct in student record
- Contact admin to resend activation (they can update student record)

### Parent can't see a child:
- Verify parent_email matches in student record
- Check if student status is active
- Ensure parent account is activated

### Token expired:
- Contact school admin to update student record
- System will generate new activation token

## Future Enhancements (Optional)

1. **Mobile App Integration**
   - Push notifications for updates
   - Mobile-friendly interface

2. **Communication Features**
   - Direct messaging with teachers
   - Email notifications for new results/assignments

3. **Payment Integration**
   - Fee payment tracking
   - Online payment options

4. **Progress Reports**
   - Downloadable PDF reports
   - Term-by-term comparisons

5. **Multi-Language Support**
   - Localization for different languages
   - Accessibility improvements

## Support

For technical issues or questions, contact the school administration or IT support team.
