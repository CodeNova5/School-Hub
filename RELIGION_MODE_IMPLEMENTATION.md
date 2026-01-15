# Religion Mode Support for Timetable - Implementation Summary

## Overview
Added support for religious subjects (Christian Religious Studies and Islamic Religious Studies) to be scheduled in the same period, similar to how departmental subjects work for SSS classes.

## Changes Made

### 1. Database Schema (`supabase/migrations/add_religion_to_timetable.sql`)
- Added `religion` column to `timetable_entries` table
  - Type: `text`
  - Allowed values: `'Christian'`, `'Muslim'`, or `NULL`
- Updated unique constraint to support both department and religion combinations
  - New index: `unique_class_period_dept_religion`
  - Allows multiple entries per period slot (one per department or religion)

### 2. Timetable Page (`app/admin/timetable/page.tsx`)

#### State Management
- Added `religionMode` state to toggle religion mode
- Added form fields:
  - `formChristianSubjectClassId` - for Christian Religious Studies (CRS)
  - `formMuslimSubjectClassId` - for Islamic Religious Studies (IRS)

#### Helper Functions
- Added `subjectClassesByReligion(religion?: string)` - filters subject classes by religion
- Updated `subjectClassesByDepartment()` to exclude religious subjects when no department is specified

#### Entry Management
- **Create Entry**: Supports creating CRS/IRS entries in the same period
- **Edit Entry**: Detects and loads religious entries correctly
- **Delete Entry**: Handles deletion of all religious subjects in a slot
- **Teacher Clash Detection**: Checks for conflicts when assigning religious subjects

#### Grouping and Display
- Updated `groupedEntries` to handle religion field
- Religious subjects displayed as: `CRS / IRS` (similar to departmental subjects)
- Teacher names shown for each religious subject

#### UI Components
- Added "Religion Mode (CRS/IRS)" checkbox in the dialog
- Mutual exclusivity: Enabling religion mode disables departmental mode and vice versa
- Subject selectors for:
  - Christian Religious Studies (CRS)
  - Islamic Religious Studies (IRS)
- Both selectors allow "None" option for flexibility

### 3. Auto-Timetable Wizard (`components/auto-timetable-wizard.tsx`)

#### Interface Updates
- Added `religion` field to `SubjectFrequency` interface
- Added `religion` field to `GeneratedEntry` interface
- Updated subject pool to track `religion` property

#### Generation Logic
- Automatically detects and includes religious subjects in generation
- Applies same scheduling constraints as departmental subjects:
  - Teacher clash prevention
  - Workload balancing
  - Even distribution across days
- Generates entries with proper `religion` field set

## Usage

### Adding Religious Subjects to Timetable

1. **Manual Entry**:
   - Click "Add Entry" or edit an existing slot
   - Check "Religion Mode (CRS/IRS)"
   - Select Christian Religious Studies from the first dropdown
   - Select Islamic Religious Studies from the second dropdown
   - Click "Save"

2. **Auto-Generate**:
   - Religious subjects are automatically detected by their `religion` field in the database
   - The wizard will schedule them with the same frequency rules as other subjects
   - Generated entries will have the `religion` field properly set

### Database Setup

Run the migration file to add religion support:
```sql
-- Run this in Supabase SQL Editor
\i supabase/migrations/add_religion_to_timetable.sql
```

Or copy the contents and execute directly.

### Subject Configuration

Ensure subjects have the `religion` field set in the `subjects` table:
- Christian Religious Studies: `religion = 'Christian'`
- Islamic Religious Studies: `religion = 'Muslim'`
- Other subjects: `religion = NULL`

## Benefits

1. **Flexibility**: Schools can schedule CRS and IRS at the same time
2. **Consistency**: Works the same way as departmental subjects (Science/Arts/Commercial)
3. **Teacher Management**: Prevents double-booking of teachers
4. **Clear Display**: Shows both subjects clearly in timetable view (e.g., "CRS / IRS")
5. **Auto-Generation Support**: Wizard automatically handles religious subjects

## Example Timetable Entry

```
Period 3 (10:00 - 10:40)
Class: Primary 5A
Subjects: Christian Religious Studies / Islamic Religious Studies
Teachers: John Doe / Jane Smith
```

In the database:
```
Entry 1: { subject_class_id: 'crs-uuid', religion: 'Christian' }
Entry 2: { subject_class_id: 'irs-uuid', religion: 'Muslim' }
```

## Technical Notes

- The `religion` field is mutually exclusive with the `department` field
- When `religionMode = true`, the `departmentalMode` is automatically set to `false`
- The unique constraint allows one entry per `(class_id, period_slot_id, department, religion)` combination
- Religious subjects are filtered out from regular subject lists when appropriate
