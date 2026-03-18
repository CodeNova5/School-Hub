-- ============================================================================
-- FIX PERIOD_SLOTS TABLE - Drop and recreate with proper school_id support
-- ============================================================================

-- Drop dependent tables first
DROP TABLE IF EXISTS timetable_entries CASCADE;

-- Drop period_slots
DROP TABLE IF EXISTS period_slots CASCADE;

-- Recreate period_slots with proper multitenancy
CREATE TABLE period_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  period_number integer,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_break boolean DEFAULT false,
  duration_minutes integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT period_slots_break_number_rule CHECK (
    (is_break = true AND period_number IS NULL)
    OR (is_break = false AND period_number BETWEEN 1 AND 20)
  ),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_period_slots_school ON period_slots(school_id);
CREATE INDEX idx_period_slots_day ON period_slots(day_of_week);
CREATE INDEX idx_period_slots_day_start_time ON period_slots(school_id, day_of_week, start_time);
CREATE UNIQUE INDEX unique_period_slots_class_period_per_day
  ON period_slots(school_id, day_of_week, period_number)
  WHERE is_break = false;

-- Recreate timetable_entries
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

-- Enable RLS
ALTER TABLE period_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for period_slots
CREATE POLICY "School users can read period_slots"
  ON period_slots FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage period_slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- RLS Policies for timetable_entries
CREATE POLICY "School users can read timetable_entries"
  ON timetable_entries FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage timetable_entries"
  ON timetable_entries FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

