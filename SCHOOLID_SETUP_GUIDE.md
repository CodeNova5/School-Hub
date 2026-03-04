# School ID Setup - How It Works

## ✅ How School ID Gets Populated

The `school_id` is stored in the **`admins`** table (and `user_role_links` for other roles). It's NOT stored in auth user metadata - that would be incorrect.

### When An Admin Is Created

When you create an admin user, you must:
1. Create the auth user in Supabase Auth
2. Insert a record into the `admins` table with their `user_id` and `school_id`

Example:
```sql
-- Step 1: Auth user is created (Supabase handles this)
-- Step 2: Admin record is inserted
INSERT INTO admins (user_id, school_id, is_active)
VALUES ('user-uuid-here', 'school-uuid-here', true);
```

### During Login

When an admin logs in:
1. They authenticate with Supabase Auth
2. The `custom_access_token_hook` function adds `school_id` to their JWT claims based on the admins table
3. Later requests can call `get_my_school_id()` RPC to retrieve their school_id

---

## Where School ID Is Retrieved

### Client Side (React)
```typescript
import { useSchoolContext } from '@/hooks/use-school-context';

export default function Page() {
  const { schoolId, isLoading, error } = useSchoolContext();
  // Calls get_my_school_id() RPC function

  if (!schoolId) return <div>Loading school context...</div>;
  
  // Use schoolId to filter queries
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId);
}
```

### Server Side (API Routes)
```typescript
import { checkIsAdminWithSchool, successResponse } from '@/lib/api-helpers';

export async function GET(req) {
  const permission = await checkIsAdminWithSchool();
  // Calls get_my_school_id() RPC function
  
  if (!permission.authorized) return errorResponse(...);
  
  const schoolId = permission.schoolId;
  // Use schoolId in queries
}
```

---

## The Database Query Chain

```
User logs in
    ↓
Supabase Auth creates/validates session
    ↓
custom_access_token_hook runs
    ↓
Looks up admins table: SELECT school_id FROM admins WHERE user_id = auth.uid()
    ↓
Adds school_id to JWT claims
    ↓
Later: Client calls get_my_school_id() RPC
    ↓
RPC queries: SELECT school_id FROM admins WHERE user_id = auth.uid()
    ↓
Returns school_id to client/API
    ↓
Used in .eq('school_id', schoolId) filters
```

---

## Ensuring School ID Is Set During Admin Creation

When you create an admin in your app, make sure the API route does **both**:

### ❌ WRONG - Only creates auth user:
```typescript
// This won't work - school_id is not in the admins table!
const { data: user } = await supabase.auth.admin.createUser({
  email: 'admin@school.com',
  password: 'temp_password',
});
```

### ✅ RIGHT - Creates auth user AND admin record:
```typescript
import { getAdminSchoolId} from '@/lib/api-helpers';

// Step 1: Create auth user (as service role)
const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
  email: 'admin@school.com',
  password: 'temp_password',
});

// Step 2: Create admin record with school_id
const { error: adminError } = await supabaseAdmin
  .from('admins')
  .insert({
    user_id: user.user.id,
    school_id: schoolIdToAssign, // ← MUST have this
    is_active: true,
  });
```

---

## Troubleshooting: "Unable to determine school"

If you get this error:

```
"Unable to determine school - user may not be assigned to a school"
```

### Check These:

**1. Is the admin record in the admins table?**
```sql
SELECT * FROM admins WHERE user_id = 'their-user-id';
```

**2. Does the admin record have a school_id?**
```sql
SELECT user_id, school_id FROM admins WHERE user_id = 'their-user-id';
-- Should NOT be NULL
```

**3. Did they log out and back in after the record was created?**
- JWT is cached, log out and back in to refresh

**4. Is the school_id valid?**
```sql
SELECT * FROM schools WHERE id = 'the-school-id';
-- School must exist
```

---

## Table Structure

### admins table
```
id          (uuid primary key)
user_id     (uuid, references auth.users.id) ← Matches logged-in user
school_id   (uuid, references schools.id)    ← This is what we look up
is_active   (boolean)
created_at  (timestamp)
updated_at  (timestamp)
```

### schools table
```
id          (uuid primary key)
name        (text)
subdomain   (text)
is_active   (boolean)
created_at  (timestamp)
updated_at  (timestamp)
```

---

## Summary

- ✅ School ID comes from the **admins table**
- ✅ It's retrieved via the **`get_my_school_id()` RPC function**
- ✅ Use **useSchoolContext hook** in client components
- ✅ Use **checkIsAdminWithSchool()** in API routes
- ✅ Always filter queries with `.eq('school_id', schoolId)`
