-- ============================================================================
-- CLASS HISTORY AND PROMOTION SYSTEM
-- ============================================================================
-- This migration creates:
-- 1. class_history table to track student class membership over time
-- 2. promotion_settings table for configurable promotion thresholds
-- 3. Helper functions for promotion logic
-- ============================================================================

-- Class History Table
-- Tracks which students were in which classes for each session
CREATE TABLE IF NOT EXISTS class_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_number text NOT NULL,
  class_name text NOT NULL,
  education_level text NOT NULL,
  department text,
  -- Performance summary for this session
  terms_completed int DEFAULT 0,
  average_score numeric DEFAULT 0,
  cumulative_grade text,
  position int,
  total_students int,
  -- Promotion outcome
  promoted boolean DEFAULT false,
  promotion_status text CHECK (
    promotion_status IN ('promoted', 'graduated', 'repeated', 'pending', 'withdrawn')
  ),
  promoted_to_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  promotion_notes text,
  -- Timestamps
  recorded_at timestamptz DEFAULT now(),
  promoted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, class_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_class_history_student ON class_history(student_id);
CREATE INDEX IF NOT EXISTS idx_class_history_class ON class_history(class_id);
CREATE INDEX IF NOT EXISTS idx_class_history_session ON class_history(session_id);
CREATE INDEX IF NOT EXISTS idx_class_history_status ON class_history(promotion_status);

-- Promotion Settings Table
-- Stores configurable promotion thresholds and rules
CREATE TABLE IF NOT EXISTS promotion_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  minimum_pass_percentage numeric DEFAULT 40 NOT NULL,
  require_all_terms boolean DEFAULT false,
  auto_promote boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_settings_session ON promotion_settings(session_id);

-- Insert default promotion settings for current session
INSERT INTO promotion_settings (session_id, minimum_pass_percentage, require_all_terms, auto_promote)
SELECT id, 40, false, true
FROM sessions
WHERE is_current = true
ON CONFLICT (session_id) DO NOTHING;

-- Helper function to get next class in progression
CREATE OR REPLACE FUNCTION get_next_class(current_class_name text, current_education_level text, current_department text DEFAULT NULL)
RETURNS TABLE (
  class_id uuid,
  class_name text,
  education_level text,
  department text
) 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Define class progression rules
  -- Pre-Primary: Creche -> Nursery 1 -> Nursery 2 -> KG 1 -> KG 2
  -- Primary: Primary 1 -> Primary 2 -> Primary 3 -> Primary 4 -> Primary 5 -> Primary 6
  -- JSS: JSS 1 -> JSS 2 -> JSS 3
  -- SSS: SS 1 -> SS 2 -> SS 3
  
  RETURN QUERY
  WITH next_class_info AS (
    SELECT 
      CASE 
        -- Pre-Primary progression
        WHEN current_class_name = 'Creche' THEN 'Nursery 1'
        WHEN current_class_name = 'Nursery 1' THEN 'Nursery 2'
        WHEN current_class_name = 'Nursery 2' THEN 'KG 1'
        WHEN current_class_name = 'KG 1' THEN 'KG 2'
        WHEN current_class_name = 'KG 2' THEN 'Primary 1'
        
        -- Primary progression
        WHEN current_class_name = 'Primary 1' THEN 'Primary 2'
        WHEN current_class_name = 'Primary 2' THEN 'Primary 3'
        WHEN current_class_name = 'Primary 3' THEN 'Primary 4'
        WHEN current_class_name = 'Primary 4' THEN 'Primary 5'
        WHEN current_class_name = 'Primary 5' THEN 'Primary 6'
        WHEN current_class_name = 'Primary 6' THEN 'JSS 1'
        
        -- JSS progression
        WHEN current_class_name = 'JSS 1' THEN 'JSS 2'
        WHEN current_class_name = 'JSS 2' THEN 'JSS 3'
        WHEN current_class_name = 'JSS 3' THEN 'SS 1'
        
        -- SSS progression
        WHEN current_class_name = 'SS 1' THEN 'SS 2'
        WHEN current_class_name = 'SS 2' THEN 'SS 3'
        WHEN current_class_name = 'SS 3' THEN NULL -- Graduation
        
        ELSE NULL
      END as next_class_name,
      CASE 
        WHEN current_class_name IN ('Creche', 'Nursery 1', 'Nursery 2', 'KG 1', 'KG 2') THEN 'Pre-Primary'
        WHEN current_class_name LIKE 'Primary%' THEN 'Primary'
        WHEN current_class_name LIKE 'JSS%' THEN 'JSS'
        WHEN current_class_name LIKE 'SS%' THEN 'SSS'
        ELSE NULL
      END as next_education_level
  )
  SELECT 
    c.id,
    c.name,
    c.education_level,
    c.department
  FROM classes c, next_class_info
  WHERE c.name = next_class_info.next_class_name
    AND c.education_level = next_class_info.next_education_level
    AND (
      -- For SSS, match department if specified
      (next_class_info.next_education_level = 'SSS' AND c.department = current_department)
      OR next_class_info.next_education_level != 'SSS'
    )
  LIMIT 1;
END;
$$;

-- Function to calculate student session performance
CREATE OR REPLACE FUNCTION calculate_session_performance(
  p_student_id uuid,
  p_session_id uuid
)
RETURNS TABLE (
  terms_completed int,
  average_score numeric,
  cumulative_grade text,
  passed boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_min_pass_percentage numeric;
BEGIN
  -- Get minimum pass percentage for this session
  SELECT minimum_pass_percentage INTO v_min_pass_percentage
  FROM promotion_settings
  WHERE session_id = p_session_id;
  
  -- Default to 40% if not set
  v_min_pass_percentage := COALESCE(v_min_pass_percentage, 40);
  
  RETURN QUERY
  WITH term_averages AS (
    SELECT 
      term_id,
      AVG(total) as term_avg
    FROM results
    WHERE student_id = p_student_id
      AND session_id = p_session_id
    GROUP BY term_id
  )
  SELECT 
    COUNT(*)::int as terms_completed,
    COALESCE(AVG(term_avg), 0)::numeric as average_score,
    CASE 
      WHEN AVG(term_avg) >= 75 THEN 'A1'
      WHEN AVG(term_avg) >= 70 THEN 'B2'
      WHEN AVG(term_avg) >= 65 THEN 'B3'
      WHEN AVG(term_avg) >= 60 THEN 'C4'
      WHEN AVG(term_avg) >= 55 THEN 'C5'
      WHEN AVG(term_avg) >= 50 THEN 'C6'
      WHEN AVG(term_avg) >= 45 THEN 'D7'
      WHEN AVG(term_avg) >= 40 THEN 'E8'
      ELSE 'F9'
    END as cumulative_grade,
    COALESCE(AVG(term_avg), 0) >= v_min_pass_percentage as passed
  FROM term_averages;
END;
$$;

-- Enable RLS
ALTER TABLE class_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_history
CREATE POLICY "Admins can view all class history"
  ON class_history FOR SELECT
  TO authenticated
  USING (can_access_admin());

CREATE POLICY "Admins can manage class history"
  ON class_history FOR ALL
  TO authenticated
  USING (can_access_admin())
  WITH CHECK (can_access_admin());

CREATE POLICY "Teachers can view class history for their classes"
  ON class_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.user_id = auth.uid()
        AND t.id IN (
          SELECT class_teacher_id FROM classes WHERE id = class_history.class_id
        )
    )
  );

CREATE POLICY "Students can view their own class history"
  ON class_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.user_id = auth.uid()
        AND s.id = class_history.student_id
    )
  );

CREATE POLICY "Parents can view their children's class history"
  ON class_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.parent_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND s.id = class_history.student_id
    )
  );

-- RLS Policies for promotion_settings
CREATE POLICY "Admins can manage promotion settings"
  ON promotion_settings FOR ALL
  TO authenticated
  USING (can_access_admin())
  WITH CHECK (can_access_admin());

CREATE POLICY "Everyone can view promotion settings"
  ON promotion_settings FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE class_history IS 'Tracks student class membership history for each session - Who was in which class when';
COMMENT ON TABLE promotion_settings IS 'Configurable promotion rules and thresholds per session';
COMMENT ON FUNCTION get_next_class IS 'Returns the next class in the educational progression';
COMMENT ON FUNCTION calculate_session_performance IS 'Calculates a student''s overall performance for a session';
