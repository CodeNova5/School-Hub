# Subject Creation Debug Guide

## The Issue
When creating subjects, only the `subjects` table was being populated, but `subject_classes` entries were not being created for each class.

## Root Cause
The original code used **direct Supabase client** to fetch classes:
```typescript
const { data: classes, error: classesError } = await supabase
  .from('classes')
  .select('id, name')
  .eq('education_level', selectedLevel);
```

This likely failed silently due to:
- RLS (Row Level Security) policies blocking the read
- The error was not being logged or shown to the user
- The code continued anyway without classes data
- `subject_classes` insertion was skipped silently

## The Fix
Changed to use the **API layer** for all database operations:
```typescript
const classesResponse = await fetch('/api/admin-read', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'select',
    table: 'classes',
    select: 'id, name',
    filters: { education_level: selectedLevel },
    order: [{ column: 'name', ascending: true }],
  }),
});
```

## Added Comprehensive Debugging
The code now logs:
- ✅ Subject created
- 🔍 Fetching classes for level
- 📚 Classes found (with data)
- 📝 Creating subject_classes entries (with data)
- 🔧 Subject classes response (status + data)
- 👨‍🏫 Teacher assignment process
- 📋 Empty classes found
- 🎯 Assigning to specific class IDs
- ✅ Final success messages

## How to Debug Subject Creation

### Step 1: Open Browser Console
1. Press `F12` or right-click → **Inspect**
2. Go to **Console** tab
3. Keep it open while creating a subject

### Step 2: Create a Subject and Watch Logs
Expected log sequence:
```
✅ Subject created: {id: "...", name: "Mathematics", ...}
🔍 Fetching classes for level: Primary
📚 Classes found: [
  {id: "class1", name: "Primary 1"},
  {id: "class2", name: "Primary 2"},
  ...
]
📝 Creating subject_classes entries: [
  {class_id: "class1", subject_id: "...", subject_code: "MAT-Primary 1"},
  {class_id: "class2", subject_id: "...", subject_code: "MAT-Primary 2"},
  ...
]
🔧 Subject classes response: {status: 200, data: [...]}
✅ Subject classes created successfully
```

### Step 3: Verify in Supabase
1. Go to your Supabase dashboard
2. Check **subjects** table → new subject should exist
3. Check **subject_classes** table → should have one row per class
4. Verify **subject_code** is properly generated (e.g., "MAT-Primary 1")

## Common Issues & Fixes

### Issue: Classes not found
**Error message:** `Could not find classes to apply subjects to.`

**Causes:**
- RLS policies blocking class reads
- Selected level has no classes
- API endpoint down

**Fix:** Check your Supabase RLS policies and ensure classes exist for that level

### Issue: Subject created but no subject_classes
**Error message:** None (silent failure before fix)

**Causes:**
- Classes fetch failed
- Subject classes insert failed
- RLS policies on subject_classes table

**Fix:** Check browser console for detailed error messages

### Issue: Only some classes get the subject
**Cause:** Subject classes insert for some but not all classes

**Fix:** Check if classes have different education_level values or if there's a batch insert limit

## Performance Notes
- Subjects are applied to ALL classes in a level automatically
- If level has 100 classes, 100 subject_classes rows are created
- Teacher assignment happens separately only for classes with no class_teacher

## Testing Checklist
- [ ] Create a subject from dropdown list
- [ ] Create a custom subject
- [ ] Create optional subject
- [ ] Assign teacher during creation
- [ ] Verify in Supabase: subject row exists
- [ ] Verify in Supabase: subject_classes rows exist (one per class)
- [ ] Verify subject_code format is correct
- [ ] Verify teacher assignment worked (if selected)
- [ ] Check browser console for all expected logs
- [ ] Verify no error messages
