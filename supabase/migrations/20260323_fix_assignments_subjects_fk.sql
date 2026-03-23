-- Fix the foreign key relationship between assignments and subjects
-- Issue: PGRST200 - Could not find a relationship between 'assignments' and 'subjects'
--
-- Root Cause: 
--   - subjects table has school_id NOT NULL with PRIMARY KEY on (id) only
--   - assignments.subject_id only references subjects.id
--   - PostgREST cannot detect the relationship because school_id is NOT NULL and unreferenced
--   - Solution: Create a composite FK (subject_id, school_id) → subjects(id, school_id)
--
-- Implementation:
--   1. Add UNIQUE constraint on subjects(id, school_id) to support the composite FK
--   2. Drop old single-column FK on assignments.subject_id
--   3. Add composite FK on assignments(subject_id, school_id)

-- Step 1: Ensure subjects has UNIQUE constraint on (id, school_id)
-- This is required to create a composite FK to this column pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_id_school_id 
ON subjects(id, school_id);

-- Step 2: Drop old foreign key constraint
ALTER TABLE assignments 
DROP CONSTRAINT IF EXISTS assignments_subject_id_fkey;

-- Step 3: Add composite foreign key
-- Now PostgREST will detect the relationship properly
ALTER TABLE assignments 
ADD CONSTRAINT assignments_subject_id_school_id_fkey 
  FOREIGN KEY (subject_id, school_id) 
  REFERENCES subjects(id, school_id) 
  ON DELETE CASCADE;
