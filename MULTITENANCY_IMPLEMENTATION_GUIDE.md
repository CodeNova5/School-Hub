# Multi-Tenancy Fix - Implementation Guide

## Overview
After implementing multi-tenancy, ALL admin data queries must filter by `school_id` to prevent data leakage between schools. This guide shows the easiest patterns to apply across your admin pages.

## Pattern 1: API Route Approach (RECOMMENDED)

This is the **most secure** approach. API routes handle school_id filtering server-side.

### Example: Update an Admin API Route

```typescript
// app/api/admin/[resource]/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  // This automatically checks admin status AND gets school_id
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const schoolId = permission.schoolId;

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // ALL queries automatically filter by school_id
    const { data, error } = await supabase
      .from("your_table")
      .select("*")
      .eq("school_id", schoolId);  // ← THIS IS KEY

    if (error) throw error;

    return successResponse(data);
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}
```

### Quick Update Steps:
1. Replace old `checkIsAdmin()` with `checkIsAdminWithSchool()`
2. Get `schoolId` from the permission response
3. Add `.eq("school_id", schoolId)` to EVERY query
4. Replace `NextResponse.json()` with `successResponse()` / `errorResponse()` helpers

---

## Pattern 2: Client-Side Hook Approach

For client components that query Supabase directly, use the `useSchoolContext()` hook.

### Example: Update a Client Page

```typescript
'use client';

import { useSchoolContext } from '@/hooks/use-school-context';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const { schoolId, isLoading, error } = useSchoolContext();
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!schoolId) return; // Wait for school_id to load

    loadData();
  }, [schoolId]);

  async function loadData() {
    // Add .eq('school_id', schoolId) to ALL queries
    const { data, error } = await supabase
      .from("your_table")
      .select("*")
      .eq("school_id", schoolId);  // ← THIS IS KEY

    if (error) {
      toast.error(error.message);
      return;
    }

    setData(data);
  }

  if (isLoading) return <LoadingUI />;
  if (error) return <ErrorUI error={error} />;
  if (!schoolId) return <div>Unable to determine school</div>;

  return <YourPageContent />;
}
```

### Quick Update Steps:
1. Add `const { schoolId, isLoading, error } = useSchoolContext();`
2. Show loading state while `isLoading` is true
3. Skip data loading until `schoolId` is available
4. Add `.eq('school_id', schoolId)` to EVERY query

---

## Comprehensive Checklist

Use this checklist to update each admin page:

### API Routes
- [ ] Import `checkIsAdminWithSchool, errorResponse, successResponse` from `@/lib/api-helpers`
- [ ] Replace `checkIsAdmin()` with `checkIsAdminWithSchool()`
- [ ] Extract `schoolId` from permission response
- [ ] Add `.eq('school_id', schoolId)` to **every single query**
  - [ ] Count queries
  - [ ] Select queries
  - [ ] Insert queries
  - [ ] Update queries
  - [ ] Delete queries
- [ ] Replace `NextResponse.json()` → `successResponse()` / `errorResponse()`
- [ ] Test with data from two different schools

### Client Pages
- [ ] Add `import { useSchoolContext } from '@/hooks/use-school-context';`
- [ ] Add `const { schoolId, isLoading, error } = useSchoolContext();`
- [ ] Add loading check: `if (isLoading) return <LoadingUI />;`
- [ ] Add error check: `if (error) return <ErrorUI />;`
- [ ] Add school_id check: `if (!schoolId) return <div>Unable to determine school</div>;`
- [ ] Make sure data loading only happens when `schoolId` is available
- [ ] Add `.eq('school_id', schoolId)` to **every Supabase query**
- [ ] Test with data from two different schools

---

## Admin Pages to Update

### Already Fixed:
- ✅ /admin/students (fixed in students/page.tsx)
- ✅ /admin/page (dashboard - API route fixed)

### Need to Update:
- [ ] /admin/teachers
- [ ] /admin/classes
- [ ] /admin/classes/[classId]
- [ ] /admin/subjects
- [ ] /admin/admissions
- [ ] /admin/timetable
- [ ] /admin/periods
- [ ] /admin/sessions
- [ ] /admin/calendar
- [ ] /admin/notifications
- [ ] /admin/settings
- [ ] /admin/promotions
- [ ] /admin/history
- [ ] /admin/subject-classes
- [ ] /admin/student/[studentId]/subjects
- [ ] /admin/student/[studentId]/report
- [ ] Any other admin routes

---

## Testing

After updating each page:

1. **Single School Test**: Log in with admin from School A
   - Verify you only see School A's data
   - Verify you cannot see School B's data

2. **Cross-School Test**: 
   - Create duplicate test data in School B
   - Log in with School A admin
   - Verify School B data is NOT visible
   - Log out and log in with School B admin
   - Verify School B data IS visible

3. **API Endpoint Test**:
   ```bash
   # Test with School A user's token
   curl -H "Authorization: Bearer SCHOOL_A_TOKEN" \
     https://yourapp.com/api/admin/students
   # Should only return School A students
   ```

---

## Import Helpers

```typescript
// When updating client pages
import { useSchoolContext } from '@/hooks/use-school-context';

// When updating API routes
import { 
  checkIsAdminWithSchool,
  getAdminSchoolId, 
  errorResponse, 
  successResponse 
} from '@/lib/api-helpers';

// When using direct queries
import { supabase } from '@/lib/supabase';
```

---

## Key Rule

**NEVER** query without filtering by school_id in multi-tenant system:

❌ WRONG:
```typescript
const { data } = await supabase.from('students').select('*');
```

✅ RIGHT:
```typescript
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('school_id', schoolId);
```

---

## Questions?

- **What about RLS policies?** They provide additional security, but always filter explicitly in code for defense-in-depth
- **Can I batch queries?** Yes! Use `Promise.all()` with multiple queries, just ensure each has the school_id filter
- **What about deleted records?** Include `.eq('school_id', schoolId)` on delete queries too
