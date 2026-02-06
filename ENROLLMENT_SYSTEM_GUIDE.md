# 🎓 Enrollment System Migration Guide

## Overview

The School Hub system has been upgraded from a **snapshot-based** class assignment model to an **enrollment history** model. This prevents data loss and preserves complete academic history.

## What Changed?

### ❌ Old System (DESTRUCTIVE)
```typescript
// Updating students.class_id directly
UPDATE students SET class_id = 'JSS2' WHERE class_id = 'JSS1'
```

**Problems:**
- ✗ Overwrites history - can't tell what class student was in last year
- ✗ Transfer deletes all results permanently
- ✗ No audit trail of promotions/transfers
- ✗ Can't generate historical reports
- ✗ Position calculations broken for past terms

### ✅ New System (NON-DESTRUCTIVE)
```typescript
// Creating enrollment records (append-only)
INSERT INTO enrollments (student_id, class_id, session, term, status)
VALUES (student_id, 'JSS2', '2025-2026', 'Term 1', 'active')
```

**Benefits:**
- ✓ Complete history preserved
- ✓ Results never deleted
- ✓ Full audit trail
- ✓ Historical reports work correctly
- ✓ Position calculations use correct peer groups

---

## Database Changes

### New Tables

#### **enrollments**
Tracks student-class membership over time.

```sql
CREATE TABLE enrollments (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  session_id uuid NOT NULL,
  term_id uuid NOT NULL,
  status text DEFAULT 'active',  -- active | transferred | completed | dropped | graduated
  enrollment_type text DEFAULT 'promoted',  -- new | promoted | transferred | repeated | returned
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  previous_enrollment_id uuid,  -- Links to prior class
  notes text,
  UNIQUE(student_id, session_id, term_id)  -- One enrollment per term
);
```

### New Views

#### **current_enrollments**
Shows active enrollments for current session/term.

```sql
SELECT * FROM current_enrollments WHERE class_id = 'class-uuid';
```

Returns students with full details + enrollment info.

#### **enrollment_details**
Shows all enrollments (historical and current) with joined data.

```sql
SELECT * FROM enrollment_details 
WHERE session_id = 'session-uuid' AND term_id = 'term-uuid';
```

### New Functions

#### **get_student_class(student_id, session_id, term_id)**
Returns which class a student was in during a specific session/term.

```sql
SELECT get_student_class('student-uuid', 'session-uuid', 'term-uuid');
```

#### **get_student_current_class(student_id)**
Returns student's current class (uses current session/term).

```sql
SELECT get_student_current_class('student-uuid');
```

#### **get_enrollment_history(student_id)**
Returns complete enrollment timeline for a student.

```sql
SELECT * FROM get_enrollment_history('student-uuid');
-- Returns: class_name, session, term, status, enrollment_type, dates
```

#### **is_student_enrolled(student_id)**
Checks if student has active enrollment in current session/term.

```sql
SELECT is_student_enrolled('student-uuid');
```

---

## API Changes

### Transfer Students (Updated)

**Endpoint:** `POST /api/admin`

**Old Behavior:**
```typescript
// DESTRUCTIVE - deleted results!
await supabase.from('results').delete().eq('student_id', studentId);
await supabase.from('students').update({ class_id: targetClassId });
```

**New Behavior:**
```typescript
// NON-DESTRUCTIVE - preserves results!
await supabase.from('enrollments').update({ 
  status: 'transferred',
  completed_at: new Date().toISOString()
}).eq('student_id', studentId);

await supabase.from('enrollments').insert({
  student_id,
  class_id: targetClassId,
  session_id: currentSession.id,
  term_id: currentTerm.id,
  status: 'active',
  enrollment_type: 'transferred'
});
```

### Promote Students (NEW)

**Endpoint:** `POST /api/admin/promote`

Promotes students to next class for next academic session.

**Request:**
```json
{
  "action": "promote-class",
  "sourceClassId": "uuid",
  "targetClassId": "uuid",
  "targetSessionId": "optional-uuid",
  "targetTermId": "optional-uuid"
}
```

OR

```json
{
  "action": "promote-selected",
  "studentIds": ["uuid1", "uuid2"],
  "targetClassId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "promoted": 25,
  "failed": 0,
  "message": "Promoted 25 students to JSS2"
}
```

---

## Frontend Changes

### Get Class Students

**Old:**
```typescript
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('class_id', classId);
```

**New:**
```typescript
const { data } = await supabase
  .from('current_enrollments')
  .select('*')
  .eq('class_id', classId);
```

### Get Unassigned Students

**Old:**
```typescript
const { data } = await supabase
  .from('students')
  .select('*')
  .is('class_id', null);
```

**New:**
```typescript
// Get all students not enrolled in current session/term
import { getUnassignedStudents } from '@/lib/enrollment-utils';
const students = await getUnassignedStudents();
```

### Add Student to Class

**Old:**
```typescript
await supabase
  .from('students')
  .update({ class_id: classId })
  .eq('id', studentId);
```

**New:**
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

### Remove Student from Class

**Old:**
```typescript
await supabase.from('results').delete().eq('student_id', studentId);
await supabase.from('students').update({ class_id: null });
```

**New:**
```typescript
// Mark enrollment as dropped (preserves history!)
await supabase.from('enrollments').update({ 
  status: 'dropped',
  completed_at: new Date().toISOString()
}).eq('student_id', studentId);

// Update backward compatibility field
await supabase.from('students').update({ class_id: null });
```

---

## Historical Queries

### Get Students in Class for Past Term

```typescript
const { data } = await supabase
  .from('enrollment_details')
  .select('*')
  .eq('class_id', classId)
  .eq('session_id', '2023-2024-session-id')
  .eq('term_id', 'term-1-id');
```

### Get Student's Past Results with Correct Class

```typescript
// Old way (BROKEN - used current class_id)
const { data } = await supabase
  .from('results')
  .select('*, students(class_id)')  // Wrong class if transferred!
  .eq('student_id', studentId);

// New way (CORRECT - uses historical enrollment)
const { data } = await supabase
  .from('results')
  .select(`
    *,
    subject_class:subject_classes(
      subject:subjects(name),
      class:classes(name)
    )
  `)
  .eq('student_id', studentId);
```

### Position Calculation for Past Term

The `get_student_position()` function now automatically uses the correct historical class:

```sql
-- Automatically determines which class student was in during that term
SELECT * FROM get_student_position('student-uuid', 'term-uuid');
```

Returns position among peers who were **in the same class at that time**.

---

## Migration Checklist

### Phase 1: Database (✅ Complete)
- ✅ Create enrollments table
- ✅ Add helper views (current_enrollments, enrollment_details)
- ✅ Add helper functions (get_student_class, etc.)
- ✅ Add enrollment_id to attendance table
- ✅ Backfill existing enrollments from students.class_id
- ✅ Backfill historical enrollments from results
- ✅ Update get_student_position function

### Phase 2: API (✅ Complete)
- ✅ Update transfer students endpoint (non-destructive)
- ✅ Create promotion endpoint
- ✅ Keep students.class_id synced for backward compatibility

### Phase 3: Frontend (✅ In Progress)
- ✅ Update class page student queries
- ✅ Update unassigned students query
- ✅ Update add/remove student functions
- ✅ Create enrollment utility functions
- ⏳ Update teacher portal queries
- ⏳ Update student portal queries
- ⏳ Update parent portal queries
- ⏳ Update report generation

### Phase 4: Cleanup (⏳ Pending)
- ⏳ Remove students.class_id (or keep as computed field)
- ⏳ Remove attendance.class_id
- ⏳ Update all remaining direct class_id queries

---

## Usage Examples

### Example 1: Promote Entire Class

```typescript
// Promote all JSS1 students to JSS2 for next session
const response = await fetch('/api/admin/promote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'promote-class',
    sourceClassId: 'jss1-class-uuid',
    targetClassId: 'jss2-class-uuid'
  })
});

// Old enrollments marked as 'completed'
// New enrollments created for next session
// Results from JSS1 preserved forever!
```

### Example 2: Transfer Student Mid-Term

```typescript
// Transfer student to different class in current term
const response = await fetch('/api/admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'transfer-students',
    studentIds: ['student-uuid'],
    targetClassId: 'new-class-uuid'
  })
});

// Old enrollment marked as 'transferred'
// New enrollment created in same session/term
// All historical results preserved!
```

### Example 3: View Enrollment History

```typescript
const history = await supabase
  .rpc('get_enrollment_history', { p_student_id: 'student-uuid' });

// Returns:
// [
//   { class_name: 'JSS3 A', session: '2025-2026', term: 'Term 1', status: 'active', type: 'promoted' },
//   { class_name: 'JSS2 A', session: '2024-2025', term: 'Term 3', status: 'completed', type: 'promoted' },
//   { class_name: 'JSS1 B', session: '2023-2024', term: 'Term 1', status: 'transferred', type: 'new' }
// ]
```

### Example 4: Generate Historical Report

```typescript
// Get student's class during Term 1 of 2023-2024
const classId = await supabase.rpc('get_student_class', {
  p_student_id: 'student-uuid',
  p_session_id: '2023-2024-session-id',
  p_term_id: 'term-1-id'
});

// Get results for that term
const { data: results } = await supabase
  .from('results')
  .select('*')
  .eq('student_id', 'student-uuid')
  .eq('session_id', '2023-2024-session-id')
  .eq('term_id', 'term-1-id');

// Calculate position among students in THAT class THEN
const position = await supabase.rpc('get_student_position', {
  p_student_id: 'student-uuid',
  p_term_id: 'term-1-id'
});
```

---

## Benefits Summary

### For Administrators
- ✅ Complete audit trail of all student movements
- ✅ No accidental data loss
- ✅ Promote entire classes at year-end
- ✅ Generate historical reports accurately

### For Teachers
- ✅ See which students were in class during past terms
- ✅ Accurate position calculations
- ✅ Results always linked to correct class context

### For Parents/Students
- ✅ Complete academic history visible
- ✅ Promotion timeline clear
- ✅ Past report cards remain accessible

### For Developers
- ✅ Easier debugging (full timeline)
- ✅ Better data integrity
- ✅ Simpler analytics queries
- ✅ No "where did this data go?" mysteries

---

## Backward Compatibility

During migration, `students.class_id` is kept and auto-synced:

```sql
-- Trigger automatically updates students.class_id when enrollment changes
CREATE TRIGGER sync_student_class_id
  AFTER INSERT OR UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION sync_student_class_id();
```

This allows gradual migration of frontend code.

**Eventually:** `students.class_id` can be:
1. Removed completely, OR
2. Kept as a computed/cached field for quick queries

---

## Testing

### Verify Enrollment System

```sql
-- 1. Check enrollments created
SELECT COUNT(*) FROM enrollments;

-- 2. Check current enrollments view
SELECT * FROM current_enrollments LIMIT 5;

-- 3. Test historical lookup
SELECT get_student_class(
  (SELECT id FROM students LIMIT 1),
  (SELECT id FROM sessions WHERE is_current = true),
  (SELECT id FROM terms WHERE is_current = true)
);

-- 4. Check enrollment history
SELECT * FROM get_enrollment_history((SELECT id FROM students LIMIT 1));
```

### Test Transfer (Should NOT Delete Results)

```typescript
// 1. Note student's result count
const { count: beforeCount } = await supabase
  .from('results')
  .select('*', { count: 'exact', head: true })
  .eq('student_id', studentId);

// 2. Transfer student
await fetch('/api/admin', {
  method: 'POST',
  body: JSON.stringify({
    action: 'transfer-students',
    studentIds: [studentId],
    targetClassId: newClassId
  })
});

// 3. Verify results still exist
const { count: afterCount } = await supabase
  .from('results')
  .select('*', { count: 'exact', head: true })
  .eq('student_id', studentId);

console.assert(beforeCount === afterCount, 'Results should be preserved!');
```

---

## Troubleshooting

### Issue: "No current session/term found"
**Solution:** Ensure a session and term have `is_current = true`.

### Issue: Duplicate enrollment error
**Solution:** A student can only have one enrollment per session/term. Check if enrollment already exists.

### Issue: Old queries still using students.class_id
**Solution:** Update to use `current_enrollments` view or `get_student_class()` function.

### Issue: Position calculations wrong
**Solution:** Ensure using updated `get_student_position()` function that looks up historical class.

---

## Support

For questions or issues:
1. Check migration file: `supabase/migrations/20260206_create_enrollments_system.sql`
2. Review helper functions: `lib/enrollment-utils.ts`
3. Check API endpoints: `app/api/admin/route.ts` and `app/api/admin/promote/route.ts`
