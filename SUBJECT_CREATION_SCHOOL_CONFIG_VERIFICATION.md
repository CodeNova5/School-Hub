# Subject Creation with School Configuration Verification

## Overview
The bulk subject creation system now validates predefined subjects against **actual school database configuration** before loading them. This ensures scalability across schools with different setups.

## How It Works

### 1. **Validation Flow**
```
User clicks "Load Predefined Nigerian Subjects"
    ↓
System fetches predefined subjects for the education level
    ↓
System validates each predefined subject against school's configured:
  - Religions (from school_religions table)
  - Departments (from school_departments table)
    ↓
Only subjects with matching school config are loaded
    ↓
User sees warnings for skipped subjects with reasons
```

### 2. **Smart Matching Logic**

#### For Religion Subjects:
- **Detects type**: Is it "Christian Religious Studies" → maps to "Christian"
- **Matches keywords**: Looks for school religions containing:
  - Christian: "Christian", "CRS", "Christ", "Christianity"
  - Islamic: "Islamic", "Islam", "IRS", "Muslim", "Muslims"
- **Validates**: Only loads if school has matching religion configured

#### For Department Subjects:
- **Categorizes**: Physics → "science", Literature → "arts", etc.
- **Matches semantically**: Looks for school departments with keywords:
  - science: "Science", "STEM", "STEM Education", "Pure Science"
  - arts: "Arts", "Humanities", "Literature", "Language", "Social Arts"
  - social: "Social", "Social Science", "Social Studies", "Commercial"
- **Flexible**: Works with exact names or partial matches

## Test Scenarios

### Scenario 1: Single Religion School (Christian-only)
**School Configuration:**
```
Religions: ["Christianity"]
Departments: ["Science", "Arts"]
```

**Expected Result:**
- ✅ Christian Religious Studies → Loaded (maps to "Christianity")
- ❌ Islamic Religious Studies → Skipped with warning
- ✅ Other subjects (Math, Science, etc.) → All loaded

**Warning Message:**
```
School doesn't have "Islamic" configured. 
Configure it in School Settings or skip "Islamic Religious Studies"
```

---

### Scenario 2: Two Religions School (Christian + Islamic)
**School Configuration:**
```
Religions: ["Christian", "Islamic"]
Departments: ["Science", "Arts", "Social Studies"]
```

**Expected Result:**
- ✅ Christian Religious Studies → Loaded (maps to "Christian")
- ✅ Islamic Religious Studies → Loaded (maps to "Islamic")
- ✅ All other subjects → Loaded

**Warnings:** None

---

### Scenario 3: Custom Religion Names
**School Configuration:**
```
Religions: ["CRS", "IRS"]  # Custom abbreviations
Departments: ["STEM", "Languages"]
```

**Expected Result:**
- ✅ Christian Religious Studies → Loaded (maps to "CRS")
- ✅ Islamic Religious Studies → Loaded (maps to "IRS")
- ✅ Physics → Loaded (department "STEM" contains "STEM")
- ✅ French Language → Loaded (will use default department or none)

**Notes:**
- System uses intelligent keyword matching
- "CRS" is recognized as Christian via keyword matching
- "IRS" is recognized as Islamic via keyword matching

---

### Scenario 4: No Religion Config
**School Configuration:**
```
Religions: []  # Empty
Departments: ["Science", "Arts"]
```

**Expected Result:**
- ❌ Christian Religious Studies → Skipped
- ❌ Islamic Religious Studies → Skipped
- ✅ All other subjects → Loaded

**Warnings:**
```
Cannot load "Christian Religious Studies" - no religions configured in school
Cannot load "Islamic Religious Studies" - no religions configured in school
```

---

### Scenario 5: Department Mapping
**School Configuration:**
```
Religions: ["Christian", "Islamic"]
Departments: ["Science & Technology", "Language Arts", "Social Programs"]
```

**Expected Result:**
```
Subject Mapping:
- Physics → "Science & Technology" (contains "science" keyword)
- Chemistry → "Science & Technology" (contains "science" keyword)
- English Language → "Language Arts" (contains "language" keyword)
- History → "Social Programs" (matches via "social" keyword)
- Economics → "Social Programs" (matches via "social" keyword)
```

---

## Data Integrity Benefits

### 1. **No Orphaned Records**
- Subjects are never created with non-existent religion IDs
- Prevents database inconsistencies

### 2. **Timetable Compatibility**
- Religion subjects with valid IDs → Timetable can schedule them properly
- Systems that expect both CRS and IRS work correctly

### 3. **Audit Trail**
- Configuration warnings logged to console for admin review
- Shows exactly which subjects were skipped and why

### 4. **Scalability**
- System works with any school configuration
- No hardcoded assumptions about religion/department names
- Handles edge cases (single religion, custom names, missing config)

## Implementation Details

### New Functions in `nigerian-subjects.ts`

#### `validateReligionSubject(subjectName, religions)`
```typescript
// Validates if a religion subject can be loaded
// Returns: { canLoad: boolean, warning?: string }

Example:
- validateReligionSubject("Christian Religious Studies", [{id: "1", name: "Christian"}])
  → { canLoad: true }

- validateReligionSubject("Christian Religious Studies", [])
  → { canLoad: false, warning: "Cannot load... - no religions configured" }

- validateReligionSubject("Christian Religious Studies", [{id: "1", name: "Islamic"}])
  → { canLoad: false, warning: "School doesn't have \"Christian\" configured..." }
```

#### `validatePredefinedSubjectsForSchool(subjects, religions)`
```typescript
// Validates all subjects against school config
// Returns: { loadable: PredefinedSubject[], warnings: string[] }

Example:
const { loadable, warnings } = validatePredefinedSubjectsForSchool(
  sssSubjects,
  schoolReligions
);
// loadable = all valid subjects
// warnings = array of warning messages for skipped subjects
```

### Updated in `bulk-create-subjects-dialog.tsx`

1. **Import validation function**
   ```typescript
   import { validatePredefinedSubjectsForSchool } from "@/lib/nigerian-subjects";
   ```

2. **Call validation in loadPredefinedSubjects()**
   ```typescript
   const { loadable, warnings } = validatePredefinedSubjectsForSchool(
     predefinedSubjects,
     religions
   );
   ```

3. **Display warnings in UI**
   - Shows amber warning box with list of skipped subjects
   - Explains why they were skipped
   - Suggests configuring missing religions in School Settings

## Deployment Checklist

- [x] Validation functions created
- [x] Smart matching logic updated (better keyword matching)
- [x] Dialog imports new validation function
- [x] Warnings displayed in UI
- [x] No database changes needed (uses existing schema)
- [x] Backward compatible (old code still works, just logs warnings)

## Future Enhancements

1. **Admin Dashboard**
   - Show school configuration summary
   - Allow quick subject mapping adjustments
   - Preview what subjects will load before bulk creation

2. **Configuration Suggestions**
   - "You have Physics but no Science department. Create Science department?"
   - "You have both Christian and Islamic but no religion subjects. Add religion subjects?"

3. **Batch Import**
   - Allow schools to upload custom subject templates
   - Map templates to their database configuration automatically

## Testing Commands

### Test 1: Christian-only School
```typescript
// Mock data
const sssSubjects = getSubjectsForLevel("SSS");
const christianOnly = [{ id: "1", name: "Christian", is_active: true }];

const result = validatePredefinedSubjectsForSchool(sssSubjects, christianOnly);
console.log(result.warnings); // Should show Islamic Religious Studies warning
```

### Test 2: Custom Religion Names
```typescript
const customReligions = [
  { id: "1", name: "CRS" },
  { id: "2", name: "IRS" }
];

const result = validatePredefinedSubjectsForSchool(sssSubjects, customReligions);
console.log(result.loadable.filter(s => s.category === "religion").length); // Should be 2
```

### Test 3: Department Mapping
```typescript
const depts = [{ id: "1", name: "STEM" }];

const smartDept = getSmartDepartmentId("Physics", depts);
console.log(smartDept); // Should match "STEM" via keyword
```

## Troubleshooting

### Issue: Islamic subject missing even though religion is configured

**Check:**
1. Religion name in database contains "islam", "irs", or "muslim"?
2. Case-insensitive matching, but spelling must match

**Solution:**
```sql
SELECT id, name FROM school_religions WHERE school_id = 'SCHOOL_ID';
-- Ensure names contain recognizable keywords
```

### Issue: Department not being assigned to Physics

**Check:**
1. Department name contains "science" or similar keyword
2. Exact name: "Science" OR "STEM" OR "Physics Department"

**Solution:**
```sql
SELECT id, name FROM school_departments WHERE school_id = 'SCHOOL_ID';
-- Rename to include keyword or update getSmartDepartmentId logic
```

## Code Locations

| Component | File | Purpose |
|-----------|------|---------|
| Validation Logic | `lib/nigerian-subjects.ts` | Validates subjects against school config |
| Predefined Subjects | `lib/nigerian-subjects.ts` | LEVEL_SUBJECTS, SUBJECT_CATEGORIES |
| Bulk Creation UI | `components/bulk-create-subjects-dialog.tsx` | User wizard with warnings |
| Database Schema | `supabase/migrations/00_COMPLETE_DATABASE_SETUP.sql` | school_religions, school_departments table definitions |

---

**Last Updated:** March 12, 2026  
**Status:** ✅ Production Ready
