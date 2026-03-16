-- School-level subject presets per education level
-- Used by School Config to define editable initial subject templates for setup flows.

CREATE TABLE IF NOT EXISTS school_level_subject_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  education_level_id uuid NOT NULL REFERENCES school_education_levels(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_optional boolean DEFAULT false,
  department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  order_sequence integer NOT NULL DEFAULT 1 CHECK (order_sequence > 0),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT school_level_subject_presets_unique_name_per_level
    UNIQUE (school_id, education_level_id, name)
);

CREATE INDEX IF NOT EXISTS idx_school_level_subject_presets_school
  ON school_level_subject_presets(school_id);

CREATE INDEX IF NOT EXISTS idx_school_level_subject_presets_level
  ON school_level_subject_presets(education_level_id);

CREATE INDEX IF NOT EXISTS idx_school_level_subject_presets_active
  ON school_level_subject_presets(is_active);

ALTER TABLE school_level_subject_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users can read level subject presets" ON school_level_subject_presets;
DROP POLICY IF EXISTS "Admins can manage level subject presets" ON school_level_subject_presets;

CREATE POLICY "School users can read level subject presets"
  ON school_level_subject_presets FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage level subject presets"
  ON school_level_subject_presets FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));
