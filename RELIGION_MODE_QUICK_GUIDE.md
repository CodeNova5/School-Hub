# Quick Guide: Using Religion Mode in Timetable

## Step 1: Run the Database Migration

Open Supabase SQL Editor and run:
```sql
-- Add religion column to timetable_entries
ALTER TABLE timetable_entries
ADD COLUMN IF NOT EXISTS religion text
CHECK (religion IS NULL OR religion = ANY (ARRAY['Christian', 'Muslim']));

-- Update unique constraint
DROP INDEX IF EXISTS unique_class_period_dept;

CREATE UNIQUE INDEX unique_class_period_dept_religion
ON timetable_entries (class_id, period_slot_id, COALESCE(department, 'NONE'), COALESCE(religion, 'NONE'));
```

## Step 2: Verify Subjects Have Religion Field

Check that your religious subjects have the religion field set:
```sql
-- View religious subjects
SELECT id, name, religion, education_level 
FROM subjects 
WHERE religion IS NOT NULL;

-- If needed, update subjects
UPDATE subjects 
SET religion = 'Christian' 
WHERE name ILIKE '%christian%' OR name ILIKE '%crs%';

UPDATE subjects 
SET religion = 'Muslim' 
WHERE name ILIKE '%islamic%' OR name ILIKE '%irs%';
```

## Step 3: Use in Timetable

### Manual Entry:
1. Go to Admin → Timetable Management
2. Click "Add Entry" (or edit existing)
3. Select Day, Period, and Class
4. ✅ Check "Religion Mode (CRS/IRS)"
5. Select Christian Religious Studies (if available)
6. Select Islamic Religious Studies (if available)
7. Click "Save"

### Auto-Generate:
1. Click "Auto-Generate Timetable"
2. Select the class
3. The wizard will automatically:
   - Detect religious subjects
   - Set default frequency (usually 2 periods/week)
   - Schedule them without conflicts

## Features

✅ **Both subjects in same period**: CRS and IRS can be taught simultaneously  
✅ **Teacher clash detection**: Prevents double-booking teachers  
✅ **Mutual exclusivity**: Can't use Religion Mode and Departmental Mode together  
✅ **Flexible selection**: Can choose only CRS, only IRS, or both  
✅ **Display format**: Shows as "CRS / IRS" in timetable view  

## Example Use Case

**Scenario**: Primary 5A has 30 students
- 18 Christian students → CRS
- 12 Muslim students → IRS

**Timetable Entry**:
```
Tuesday, Period 4 (11:00-11:40)
Class: Primary 5A
Religion Mode: ✓
Christian RS: Mrs. Johnson
Islamic RS: Mr. Ibrahim
```

**Result**: Both teachers teach their respective groups at the same time in different locations.

## Troubleshooting

**"Choose at least one religious subject to add"**  
→ Select at least CRS or IRS before saving

**Teacher clash detected**  
→ Teacher is already assigned to another class at this time. Choose different period or teacher.

**Subject not appearing in dropdown**  
→ Check that:
   1. Subject has `religion` field set in database
   2. Subject is linked to the class via `subject_classes` table
   3. Subject has a teacher assigned

## Visual Guide

```
┌─────────────────────────────────────┐
│  Add/Edit Timetable Entry           │
├─────────────────────────────────────┤
│  Day: [Tuesday ▼]                   │
│  Period: [Period 4 (11:00-11:40) ▼] │
│  Class: [Primary 5A ▼]              │
│                                      │
│  ☐ Departmental Mode (SSS)          │
│  ☑ Religion Mode (CRS/IRS)          │
│                                      │
│  Christian Religious Studies (CRS)  │
│  [CRS - Mrs. Johnson ▼]             │
│                                      │
│  Islamic Religious Studies (IRS)    │
│  [IRS - Mr. Ibrahim ▼]              │
│                                      │
│  [Cancel]  [Save]                   │
└─────────────────────────────────────┘
```
