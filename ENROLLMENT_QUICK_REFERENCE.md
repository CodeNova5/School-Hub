# 📋 Enrollment System - Quick Reference

## Common Queries Cheat Sheet

### Get Current Class Students
```typescript
// ❌ OLD (Don't use)
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('class_id', classId);

// ✅ NEW (Use this)
const { data } = await supabase
  .from('current_enrollments')
  .select('*')
  .eq('class_id', classId);
```

### Get Historical Class Students
```typescript
const { data } = await supabase
  .from('enrollment_details')
  .select('*')
  .eq('class_id', classId)
  .eq('session_id', sessionId)
  .eq('term_id', termId);
```

### Get Student's Current Class
```typescript
const { data: classId } = await supabase
  .rpc('get_student_current_class', { 
    p_student_id: studentId 
  });
```

### Get Student's Class for Specific Term
```typescript
const { data: classId } = await supabase
  .rpc('get_student_class', {
    p_student_id: studentId,
    p_session_id: sessionId,
    p_term_id: termId
  });
```

### Get Unassigned Students
```typescript
import { getUnassignedStudents } from '@/lib/enrollment-utils';
const students = await getUnassignedStudents();
```

---

## Common Operations

### Add Student to Class
```typescript
const { data: session } = await supabase
  .from('sessions')
  .select('id')
  .eq('is_current', true)
  .single();

const { data: term } = await supabase
  .from('terms')
  .select('id')
  .eq('is_current', true)
  .single();

await supabase.from('enrollments').insert({
  student_id: studentId,
  class_id: classId,
  session_id: session.id,
  term_id: term.id,
  status: 'active',
  enrollment_type: 'new'
});
```

### Remove Student from Class (Preserves History)
```typescript
await supabase.from('enrollments').update({ 
  status: 'dropped',
  completed_at: new Date().toISOString()
})
.eq('student_id', studentId)
.eq('session_id', currentSession.id)
.eq('term_id', currentTerm.id);
```

### Transfer Student (via API)
```typescript
await fetch('/api/admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'transfer-students',
    studentIds: [studentId],
    targetClassId: newClassId
  })
});
```

### Promote Students (via API)
```typescript
// Promote entire class
await fetch('/api/admin/promote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'promote-class',
    sourceClassId: 'jss1-uuid',
    targetClassId: 'jss2-uuid'
  })
});

// Promote selected students
await fetch('/api/admin/promote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'promote-selected',
    studentIds: ['uuid1', 'uuid2'],
    targetClassId: 'jss2-uuid'
  })
});
```

---

## Enrollment Statuses

| Status | Meaning |
|--------|---------|
| `active` | Currently enrolled in this class |
| `completed` | Successfully finished this enrollment (promoted) |
| `transferred` | Moved to different class mid-session |
| `dropped` | Removed from class |
| `graduated` | Completed final class (graduation) |

## Enrollment Types

| Type | Meaning |
|------|---------|
| `new` | First-time enrollment or new admission |
| `promoted` | Advanced from previous class |
| `transferred` | Moved from another class |
| `repeated` | Repeating same class |
| `returned` | Re-enrolled after absence |

---

## Views Available

### current_enrollments
Active enrollments for current session/term with full student details.

**Columns:** `enrollment_id`, `student_id`, `class_id`, `student_number`, `first_name`, `last_name`, `email`, `phone`, `gender`, `class_name`, `session_name`, `term_name`, etc.

### enrollment_details
All enrollments (historical + current) with joined data.

**Columns:** Same as current_enrollments + `session_start`, `session_end`, `term_start`, `term_end`, `enrolled_at`, `completed_at`

---

## Functions Available

| Function | Purpose | Returns |
|----------|---------|---------|
| `get_student_class(student_id, session_id, term_id)` | Get student's class for specific term | `uuid` |
| `get_student_current_class(student_id)` | Get student's current class | `uuid` |
| `get_enrollment_history(student_id)` | Get complete enrollment timeline | `table` |
| `get_class_students(class_id, session_id, term_id)` | Get students in class for term | `table` |
| `is_student_enrolled(student_id)` | Check if currently enrolled | `boolean` |

---

## Migration Rules

### ✅ DO
- Use `current_enrollments` view for current students
- Use enrollment functions for historical lookups
- Create enrollments when adding students
- Mark enrollments as 'dropped'/'transferred' (don't delete!)
- Use enrollment-based position calculations

### ❌ DON'T
- Directly UPDATE `students.class_id` (use enrollments)
- DELETE results on transfer
- Query historical data using current `class_id`
- Assume student's current class applies to past terms

---

## Common Mistakes to Avoid

### Mistake 1: Using current class_id for historical data
```typescript
// ❌ WRONG - Uses student's current class
const { data } = await supabase
  .from('results')
  .select('*, students(class_id)')
  .eq('student_id', studentId)
  .eq('term_id', oldTermId);

// ✅ CORRECT - Gets class from that term
const classId = await supabase.rpc('get_student_class', {
  p_student_id: studentId,
  p_session_id: sessionId,
  p_term_id: oldTermId
});
```

### Mistake 2: Deleting data on transfer
```typescript
// ❌ WRONG - Destroys history
await supabase.from('results').delete().eq('student_id', studentId);
await supabase.from('students').update({ class_id: newClass });

// ✅ CORRECT - Preserves history
await fetch('/api/admin', {
  method: 'POST',
  body: JSON.stringify({
    action: 'transfer-students',
    studentIds: [studentId],
    targetClassId: newClass
  })
});
```

### Mistake 3: Forgetting session/term context
```typescript
// ❌ WRONG - No temporal context
await supabase
  .from('students')
  .update({ class_id: newClass })
  .eq('id', studentId);

// ✅ CORRECT - Creates enrollment with session/term
await supabase.from('enrollments').insert({
  student_id: studentId,
  class_id: newClass,
  session_id: currentSession.id,
  term_id: currentTerm.id,
  status: 'active'
});
```

---

## Debugging Tips

### Check if enrollment exists
```sql
SELECT * FROM enrollments 
WHERE student_id = 'uuid' 
  AND session_id = 'session-uuid' 
  AND term_id = 'term-uuid';
```

### View enrollment timeline
```sql
SELECT * FROM get_enrollment_history('student-uuid');
```

### Count current enrollments
```sql
SELECT COUNT(*) FROM current_enrollments WHERE class_id = 'class-uuid';
```

### Find students without enrollments
```sql
SELECT s.* FROM students s
LEFT JOIN enrollments e ON e.student_id = s.id
  AND e.session_id = (SELECT id FROM sessions WHERE is_current = true)
  AND e.term_id = (SELECT id FROM terms WHERE is_current = true)
WHERE e.id IS NULL AND s.status = 'active';
```

---

## Performance Tips

1. **Use views for common queries** - `current_enrollments` is optimized
2. **Index on (student_id, session_id, term_id)** - Already created
3. **Batch enrollment operations** - Use bulk inserts
4. **Cache current session/term** - Avoid repeated lookups

---

## Files to Reference

- **Migration:** `supabase/migrations/20260206_create_enrollments_system.sql`
- **API Endpoints:** `app/api/admin/route.ts`, `app/api/admin/promote/route.ts`
- **Utilities:** `lib/enrollment-utils.ts`
- **Full Guide:** `ENROLLMENT_SYSTEM_GUIDE.md`
- **Checklist:** `ENROLLMENT_IMPLEMENTATION_CHECKLIST.md`

---

**Remember:** Enrollments are **append-only**. Never delete enrollment history!
