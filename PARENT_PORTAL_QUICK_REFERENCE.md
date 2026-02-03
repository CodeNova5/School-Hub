# Parent Portal - Quick Reference Card

## 🎯 Quick Start for Admins

### Creating a Student with Parent Portal Access

1. **Go to** `/admin/students`
2. **Click** "Add Student" button
3. **Fill in student details**:
   - Student ID, Name, Email, etc.
   - **IMPORTANT:** Fill in Parent/Guardian section:
     - Parent Name (required)
     - Parent Email (required) - Use same email for siblings!
     - Parent Phone (optional)
4. **Click** "Create Student"
5. ✅ System automatically:
   - Creates/links parent account
   - Sends activation email to parent
   - Links student to parent

## 📧 What Happens After Student Creation?

### For NEW Parents (First Child):
- Receives activation email at parent_email
- Email contains:
  - Child's name and student ID
  - Activation link (expires in 24 hours)
  - Instructions to set password
- Parent must activate account to access portal

### For EXISTING Parents (Siblings):
- Receives notification email
- Email contains:
  - New child's name and student ID
  - Confirmation that child is added to account
- No activation needed - can login immediately

## 👨‍👩‍👧‍👦 Registering Siblings

**CRITICAL:** Use the **SAME parent email** for all siblings!

### Example:
```
Child 1: John Doe
Parent Email: parent@example.com ✓

Child 2: Jane Doe (sibling)
Parent Email: parent@example.com ✓ (SAME EMAIL!)
```

### ❌ Don't Do This:
```
Child 1: John Doe
Parent Email: parent1@example.com

Child 2: Jane Doe (sibling)
Parent Email: parent2@example.com ← Wrong! Different email
```

## 🔗 Parent Portal URLs

| Purpose | URL |
|---------|-----|
| Login | `/parent/login` |
| Activation | `/parent/activate?token=xxx` |
| Dashboard | `/parent/dashboard` |

## 🎫 What Parents Can View

For each child, parents can see:
- ✅ Attendance records and statistics
- ✅ Academic results (published only)
- ✅ Assignments and submissions
- ✅ Class timetable
- ✅ Personal and academic information
- ✅ Teacher information (for their child's classes)

Parents **CANNOT**:
- ❌ Edit any information
- ❌ See other students' data
- ❌ Access unpublished results
- ❌ Submit assignments (students only)

## 🛠️ Common Admin Tasks

### Check if Parent Account Exists
1. Go to database/Supabase
2. Check `parents` table
3. Search by email

### Resend Activation Email
1. Update student record (change any field)
2. Or manually delete `activation_token_hash` in parents table
3. Update student again - new email will be sent

### Parent Can't Login?
**Check:**
- ✅ Is account activated? (`is_active = true`)
- ✅ Is email correct in parents table?
- ✅ Did activation token expire?

**Solution:**
- Reset parent activation in database
- Or have parent use "Forgot Password" (if implemented)

### Multiple Parents for Same Child?
**Not supported currently.** 
- Only one parent_email per student
- For divorced/separated parents, use shared email or create duplicate student records

## 📊 Database Quick Reference

### Key Tables
```
parents
- id, user_id, email, name, phone
- is_active, activation_token_hash

students
- parent_email ← Links to parents.email
```

### Important Relationships
```
parents.email = students.parent_email
One parent → Many students (siblings)
```

## ⚠️ Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| No activation email | Email in spam | Check spam folder |
| Token expired | Waited >24 hours | Update student record to regenerate |
| Can't see child | Wrong parent_email | Update student.parent_email |
| Parent sees wrong child | Email typo | Fix parent_email in student record |

## 🔐 Security Notes

- Activation tokens expire in 24 hours
- Tokens are hashed (SHA-256) in database
- Single-use tokens (marked as used after activation)
- Row-level security prevents unauthorized access
- Parents can only see their own children's data

## 📝 Migration Checklist

Before using parent portal:
- ✅ Run migration: `20260203_parent_portal.sql`
- ✅ Set up email service (nodemailer with Gmail)
- ✅ Configure environment variables:
  - `EMAIL_USER`
  - `EMAIL_PASS`
  - `NEXT_PUBLIC_APP_URL`
- ✅ Test with dummy parent/student

## 💡 Tips for Success

1. **Double-check email addresses** before creating students
2. **Tell parents to check spam** folder for activation
3. **Use consistent email format** for siblings
4. **Test the flow** with a test parent account first
5. **Keep parent contact info updated** in student records

## 🆘 Getting Help

1. Check `PARENT_PORTAL_GUIDE.md` for detailed documentation
2. Review migration file for database structure
3. Check Supabase logs for errors
4. Verify environment variables are set
5. Test email service separately

## 📱 Parent Portal Features

### Dashboard
- All children at a glance
- Quick stats per child
- Navigation to detailed views

### Per Child Views
- Attendance timeline and stats
- Results with filtering by session/term
- Assignments with status tracking
- Weekly timetable
- Comprehensive profile

### Settings
- Update profile information
- Change password
- Logout

---

**Version:** 1.0  
**Last Updated:** February 3, 2026  
**Author:** School Hub Development Team
