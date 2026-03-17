-- ============================================================================
-- DIRECT FIX - Run this in Supabase SQL Editor to completely rebuild period_slots
-- ============================================================================

-- Step 1: Check current constraints (run this to see what's there)
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'period_slots';

-- Step 2: Drop all constraints and rebuild
BEGIN;

-- Disable RLS temporarily
ALTER TABLE IF EXISTS period_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS timetable_entries DISABLE ROW LEVEL SECURITY;

-- Drop dependent table
DROP TABLE IF EXISTS timetable_entries CASCADE;

-- Drop old period_slots completely
DROP TABLE IF EXISTS period_slots CASCADE;

-- Step 3: Create fresh period_slots with NO CONSTRAINTS except as part of column definition
CREATE TABLE period_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  day_of_week text NOT NULL,
  period_number integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_break boolean DEFAULT false,
  duration_minutes integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 4: Add constraints AFTER table creation (cleaner way)
ALTER TABLE period_slots
  ADD CONSTRAINT period_slots_day_check CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  ADD CONSTRAINT period_slots_period_check CHECK (period_number > 0 AND period_number <= 20),
  ADD CONSTRAINT period_slots_time_check CHECK (end_time > start_time),
  ADD CONSTRAINT period_slots_unique_school_day_period UNIQUE (school_id, day_of_week, period_number);

-- Step 5: Create indexes
CREATE INDEX idx_period_slots_school ON period_slots(school_id);
CREATE INDEX idx_period_slots_day ON period_slots(day_of_week);
CREATE INDEX idx_period_slots_school_day_period ON period_slots(school_id, day_of_week, period_number);

-- Step 6: Recreate timetable_entries
CREATE TABLE timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_slot_id uuid NOT NULL REFERENCES period_slots(id) ON DELETE CASCADE,
  subject_class_id uuid REFERENCES subject_classes(id) ON DELETE SET NULL,
  department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_timetable_entries_school ON timetable_entries(school_id);
CREATE INDEX idx_timetable_entries_class_id ON timetable_entries(class_id);
CREATE INDEX idx_timetable_entries_period_slot_id ON timetable_entries(period_slot_id);
CREATE INDEX idx_timetable_entries_subject_class_id ON timetable_entries(subject_class_id);
CREATE INDEX idx_timetable_entries_department ON timetable_entries(department_id);
CREATE INDEX idx_timetable_entries_religion ON timetable_entries(religion_id);

-- Step 7: Enable RLS
ALTER TABLE period_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop old policies if they exist
DROP POLICY IF EXISTS "School users can read period_slots" ON period_slots;
DROP POLICY IF EXISTS "Admins can manage period_slots" ON period_slots;
DROP POLICY IF EXISTS "School users can read timetable_entries" ON timetable_entries;
DROP POLICY IF EXISTS "Admins can manage timetable_entries" ON timetable_entries;
DROP POLICY IF EXISTS "Teachers can manage timetable_entries for their classes" ON timetable_entries;

-- Step 9: Create new RLS policies
CREATE POLICY "School users can read period_slots"
  ON period_slots FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage period_slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "School users can read timetable_entries"
  ON timetable_entries FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage timetable_entries"
  ON timetable_entries FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

COMMIT;

-- Verify the constraints are correct
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'period_slots'
ORDER BY constraint_name;
