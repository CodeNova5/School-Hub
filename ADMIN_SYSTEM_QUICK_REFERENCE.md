# Simplified Admin System - Quick Reference

## Core Principle
**Admin authentication is now direct:** Check the `admins` table. That's it.

---

## Key Functions

### `is_admin()` - Check if user is admin
```sql
SELECT EXISTS (
  SELECT 1 FROM admins WHERE user_id = auth.uid() AND is_active = true
);
```

### `can_access_admin()` - Middleware check
Same as `is_admin()` - just checks admins table.

### `get_school_id_for_user(p_user_id)` - Get user's school
```sql
SELECT school_id FROM admins WHERE user_id = p_user_id LIMIT 1;
```

---

## Admin Lifecycle

### Create Admin
```typescript
// 1. Create auth user
const { data: authData } = await supabaseAdmin.auth.admin.createUser({
  email,
  password: randomPassword,
  email_confirm: false,
});

// 2. Insert into admins table - THAT'S IT!
await supabaseAdmin.from("admins").insert({
  user_id: authData.user.id,
  email,
  name,
  school_id,        // ← Directly tied to school
  is_active: true,
});
```

### Delete Admin
```typescript
// 1. Delete admin record
await supabaseAdmin.from("admins").delete().eq("user_id", userId);

// 2. Delete auth user
await supabaseAdmin.auth.admin.deleteUser(userId);
```

---

## JWT Contents
When admin logs in, JWT contains:
```json
{
  "user_metadata": {
    "school_id": "uuid-here",
    "is_admin": true
  },
  "app_metadata": {
    "school_id": "uuid-here", 
    "is_admin": true
  }
}
```

---

## RLS Pattern
All tables follow this pattern:
```sql
-- SELECT: Anyone in same school or super_admin
USING (is_super_admin() OR school_id = get_my_school_id())

-- ALL (modify): Only admin in same school or super_admin  
WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
```

---

## No More
- ❌ `roles` table
- ❌ `permissions` table
- ❌ `role_permission` join table
- ❌ `user_role_links` for admins
- ❌ `has_permission()` function
- ❌ Complex role hierarchy

---

## Still Present (For Other Roles)
- ✅ Teachers: Check `teachers` table
- ✅ Students: Check `students` table  
- ✅ Parents: Check `parents` table
- ✅ Super Admin: Check `is_super_admin()` function

---

## Testing Queries

### Check if user is admin
```typescript
const { data: isAdmin } = await supabase.rpc("is_admin");
```

### Check if user can access admin area
```typescript
const { data: canAccess } = await supabase.rpc("can_access_admin");
```

### Get user's school
```typescript
const { data: schoolId } = await supabase.rpc("get_my_school_id");
```

### Get admin info
```typescript
const { data } = await supabase
  .from("admins")
  .select("*")
  .eq("user_id", userId)
  .single();
```

---

## Quick Debugging

**User can't login?**
- Check: Is there a record in `admins` table?
- Check: Is `is_active = true`?

**Middleware redirecting?**
- Check: `can_access_admin()` RPC working?
- Check: Admin record exists in database?

**Can't query tables as admin?**
- Check: RLS policy has `is_admin()` in WITH CHECK?
- Check: `school_id` matches user's school?

---

## Migration Notes
If migrating from old system:
1. Ensure all existing admins have records in `admins` table
2. Each admin record must have valid `school_id`
3. Each admin must have `is_active = true`
4. Delete any orphaned `user_role_links` for admins
