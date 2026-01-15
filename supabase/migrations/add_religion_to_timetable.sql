-- =====================================================
-- Add Religion Mode Support to Timetable Entries
-- =====================================================
-- This migration adds support for religious subjects (CRS/IRS)
-- to be scheduled in the same period, similar to departmental subjects

-- Add religion column to timetable_entries
ALTER TABLE timetable_entries
ADD COLUMN IF NOT EXISTS religion text
CHECK (religion IS NULL OR religion = ANY (ARRAY['Christian', 'Muslim']));

-- Update the unique constraint to include religion
-- Drop the existing constraint first
DROP INDEX IF EXISTS unique_class_period_dept;

-- Create new constraint that allows both department and religion combinations
CREATE UNIQUE INDEX unique_class_period_dept_religion
ON timetable_entries (class_id, period_slot_id, COALESCE(department, 'NONE'), COALESCE(religion, 'NONE'));

-- Add comment
COMMENT ON COLUMN timetable_entries.religion IS 'Religion for religious subjects (Christian/Muslim). Allows CRS and IRS to be scheduled in the same period.';
