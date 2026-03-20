-- ============================================================================
-- SCHOOL RESULT SETTINGS (SCALABLE AND FLEXIBLE RESULT MODEL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS result_school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  pass_percentage numeric NOT NULL DEFAULT 40 CHECK (pass_percentage >= 0 AND pass_percentage <= 100),
  is_configured boolean NOT NULL DEFAULT false,
  configured_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id)
);

CREATE TABLE IF NOT EXISTS result_component_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  component_key text NOT NULL,
  component_name text NOT NULL,
  max_score numeric NOT NULL CHECK (max_score > 0),
  display_order integer NOT NULL CHECK (display_order > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, component_key),
  UNIQUE(school_id, display_order)
);

CREATE TABLE IF NOT EXISTS result_grade_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_label text NOT NULL,
  min_percentage numeric NOT NULL CHECK (min_percentage >= 0 AND min_percentage <= 100),
  remark text DEFAULT '',
  display_order integer NOT NULL CHECK (display_order > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, grade_label),
  UNIQUE(school_id, display_order)
);

CREATE TABLE IF NOT EXISTS result_component_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  result_id uuid NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  component_key text NOT NULL,
  score numeric NOT NULL DEFAULT 0 CHECK (score >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(result_id, component_key)
);

CREATE INDEX IF NOT EXISTS idx_result_school_settings_school ON result_school_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_result_component_templates_school ON result_component_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_result_component_templates_order ON result_component_templates(school_id, display_order);
CREATE INDEX IF NOT EXISTS idx_result_grade_scales_school ON result_grade_scales(school_id);
CREATE INDEX IF NOT EXISTS idx_result_grade_scales_order ON result_grade_scales(school_id, display_order);
CREATE INDEX IF NOT EXISTS idx_result_component_scores_school ON result_component_scores(school_id);
CREATE INDEX IF NOT EXISTS idx_result_component_scores_result ON result_component_scores(result_id);

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION update_result_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_result_school_settings_timestamp ON result_school_settings;
CREATE TRIGGER update_result_school_settings_timestamp
  BEFORE UPDATE ON result_school_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_result_settings_timestamp();

DROP TRIGGER IF EXISTS update_result_component_templates_timestamp ON result_component_templates;
CREATE TRIGGER update_result_component_templates_timestamp
  BEFORE UPDATE ON result_component_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_result_settings_timestamp();

DROP TRIGGER IF EXISTS update_result_grade_scales_timestamp ON result_grade_scales;
CREATE TRIGGER update_result_grade_scales_timestamp
  BEFORE UPDATE ON result_grade_scales
  FOR EACH ROW
  EXECUTE FUNCTION update_result_settings_timestamp();

DROP TRIGGER IF EXISTS update_result_component_scores_timestamp ON result_component_scores;
CREATE TRIGGER update_result_component_scores_timestamp
  BEFORE UPDATE ON result_component_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_result_settings_timestamp();

-- Config validator used by API before activating settings
CREATE OR REPLACE FUNCTION validate_school_result_config(p_school_id uuid)
RETURNS TABLE(is_valid boolean, message text) AS $$
DECLARE
  active_components_count integer;
  total_max_score numeric;
  grade_rows_count integer;
  min_grade_floor numeric;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(max_score), 0)
  INTO active_components_count, total_max_score
  FROM result_component_templates
  WHERE school_id = p_school_id
    AND is_active = true;

  IF active_components_count = 0 THEN
    RETURN QUERY SELECT false, 'At least one active result component is required';
    RETURN;
  END IF;

  IF total_max_score <= 0 THEN
    RETURN QUERY SELECT false, 'Total component maximum score must be greater than zero';
    RETURN;
  END IF;

  SELECT COUNT(*), MIN(min_percentage)
  INTO grade_rows_count, min_grade_floor
  FROM result_grade_scales
  WHERE school_id = p_school_id;

  IF grade_rows_count = 0 THEN
    RETURN QUERY SELECT false, 'At least one grade scale row is required';
    RETURN;
  END IF;

  IF COALESCE(min_grade_floor, 0) > 0 THEN
    RETURN QUERY SELECT false, 'Grade scale must include a floor row at 0%';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Result configuration is valid';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE result_school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_component_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_component_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users can read result school settings" ON result_school_settings;
DROP POLICY IF EXISTS "Admins can manage result school settings" ON result_school_settings;

CREATE POLICY "School users can read result school settings"
  ON result_school_settings FOR SELECT
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage result school settings"
  ON result_school_settings FOR ALL
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read result component templates" ON result_component_templates;
DROP POLICY IF EXISTS "Admins can manage result component templates" ON result_component_templates;

CREATE POLICY "School users can read result component templates"
  ON result_component_templates FOR SELECT
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage result component templates"
  ON result_component_templates FOR ALL
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read result grade scales" ON result_grade_scales;
DROP POLICY IF EXISTS "Admins can manage result grade scales" ON result_grade_scales;

CREATE POLICY "School users can read result grade scales"
  ON result_grade_scales FOR SELECT
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage result grade scales"
  ON result_grade_scales FOR ALL
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read result component scores" ON result_component_scores;
DROP POLICY IF EXISTS "School users can manage result component scores" ON result_component_scores;

CREATE POLICY "School users can read result component scores"
  ON result_component_scores FOR SELECT
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "School users can manage result component scores"
  ON result_component_scores FOR ALL
  USING (is_super_admin() OR school_id = get_my_school_id())
  WITH CHECK (is_super_admin() OR school_id = get_my_school_id());