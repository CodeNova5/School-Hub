-- =============================================================================
-- Academics And Assessment Structure (SQL)
-- Source: supabase/structure/01-academics-and-assessment.md
-- Depends on: supabase/structure/00-core-and-tenancy.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Junction and classroom binding tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subject_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  subject_code text,
  department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  is_optional boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  prerequisite_subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  prerequisite_min_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (prerequisite_min_score IS NULL OR prerequisite_min_score >= 0),
  UNIQUE(school_id, subject_id, class_id)
);

CREATE TABLE IF NOT EXISTS student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_class_id uuid NOT NULL REFERENCES subject_classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_class_id)
);

CREATE TABLE IF NOT EXISTS student_optional_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

-- -----------------------------------------------------------------------------
-- 2) Assessment and learning workflow tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  instructions text DEFAULT '',
  subject_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  total_marks numeric NOT NULL DEFAULT 100 CHECK (total_marks > 0),
  submission_type text NOT NULL DEFAULT 'text',
  allow_late_submission boolean NOT NULL DEFAULT false,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_text text DEFAULT '',
  file_url text DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_on_time boolean NOT NULL DEFAULT true,
  grade numeric CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100)),
  feedback text DEFAULT '',
  graded_at timestamptz,
  graded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  content text DEFAULT '',
  file_url text DEFAULT '',
  marks_obtained numeric,
  feedback text DEFAULT '',
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_class_id uuid NOT NULL REFERENCES subject_classes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  total numeric DEFAULT 0,
  grade text DEFAULT '',
  remark text DEFAULT '',
  class_teacher_remark text DEFAULT '',
  class_teacher_name text DEFAULT '',
  class_teacher_signature text DEFAULT '',
  principal_remark text DEFAULT '',
  principal_signature text DEFAULT '',
  next_term_begins date,
  class_position integer,
  total_students integer,
  class_average numeric,
  entered_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  attendance integer DEFAULT 0,
  is_visible_to_parents boolean NOT NULL DEFAULT false,
  welcome_test_score numeric,
  mid_term_test_score numeric,
  vetting_score numeric,
  exam_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_class_id, session_id, term_id)
);

CREATE TABLE IF NOT EXISTS results_publication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  welcome_test_published boolean NOT NULL DEFAULT false,
  mid_term_test_published boolean NOT NULL DEFAULT false,
  vetting_published boolean NOT NULL DEFAULT false,
  exam_published boolean NOT NULL DEFAULT false,
  published_component_keys text[] DEFAULT ARRAY[]::text[],
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  is_published_to_parents boolean NOT NULL DEFAULT false,
  calculation_mode text NOT NULL DEFAULT 'all' CHECK (calculation_mode IN ('welcome_only', 'welcome_midterm', 'welcome_midterm_vetting', 'all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, session_id, term_id)
);

-- -----------------------------------------------------------------------------
-- 3) Result settings (compatibility with existing app naming)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS result_school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  pass_percentage numeric NOT NULL DEFAULT 40 CHECK (pass_percentage >= 0 AND pass_percentage <= 100),
  is_configured boolean NOT NULL DEFAULT false,
  configured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, grade_label),
  UNIQUE(school_id, display_order)
);

CREATE TABLE IF NOT EXISTS result_component_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  result_id uuid NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  component_key text NOT NULL,
  score numeric NOT NULL DEFAULT 0 CHECK (score >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(result_id, component_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'result_settings'
  ) THEN
    EXECUTE 'CREATE VIEW result_settings AS SELECT * FROM result_school_settings';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) Promotion and class history tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_number text NOT NULL,
  class_name text NOT NULL,
  education_level text NOT NULL,
  department text,
  terms_completed integer DEFAULT 0,
  average_score numeric DEFAULT 0,
  cumulative_grade text,
  position integer,
  total_students integer,
  promoted boolean DEFAULT false,
  promotion_status text CHECK (promotion_status IN ('promoted', 'graduated', 'repeated', 'pending', 'withdrawn')),
  promoted_to_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  promotion_notes text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id, session_id)
);

CREATE TABLE IF NOT EXISTS promotion_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  minimum_pass_percentage numeric NOT NULL DEFAULT 40,
  require_all_terms boolean NOT NULL DEFAULT false,
  auto_promote boolean NOT NULL DEFAULT true,
  last_processed_at timestamptz,
  processing_lock_id text,
  processing_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

CREATE TABLE IF NOT EXISTS promotion_class_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  destination_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  mapped_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, source_class_id)
);

CREATE TABLE IF NOT EXISTS promotion_class_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  total_students integer DEFAULT 0,
  processed_students integer DEFAULT 0,
  promoted_students integer DEFAULT 0,
  graduated_students integer DEFAULT 0,
  repeated_students integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, class_id)
);

-- -----------------------------------------------------------------------------
-- 5) Compatibility and integrity adjustments
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_id_school_id ON subjects(id, school_id);

ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_subject_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignments_subject_id_school_id_fkey'
  ) THEN
    ALTER TABLE assignments
      ADD CONSTRAINT assignments_subject_id_school_id_fkey
      FOREIGN KEY (subject_id, school_id)
      REFERENCES subjects(id, school_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

UPDATE student_subjects ss
SET school_id = s.school_id
FROM students s
WHERE ss.school_id IS NULL
  AND s.id = ss.student_id;

ALTER TABLE student_subjects
  ALTER COLUMN school_id SET NOT NULL;

CREATE OR REPLACE FUNCTION populate_student_subjects_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT school_id INTO NEW.school_id
    FROM students
    WHERE id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_populate_student_subjects_school_id ON student_subjects;
CREATE TRIGGER trigger_populate_student_subjects_school_id
  BEFORE INSERT ON student_subjects
  FOR EACH ROW
  EXECUTE FUNCTION populate_student_subjects_school_id();

CREATE OR REPLACE FUNCTION check_submission_on_time()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.submitted_at::date > (SELECT due_date FROM assignments WHERE id = NEW.assignment_id) THEN
    NEW.submitted_on_time := false;
  ELSE
    NEW.submitted_on_time := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_submission_on_time ON assignment_submissions;
CREATE TRIGGER trigger_check_submission_on_time
  BEFORE INSERT OR UPDATE ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION check_submission_on_time();

-- -----------------------------------------------------------------------------
-- 6) Shared helper functions used by academic workflows
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_result_settings_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_school_result_config(p_school_id uuid)
RETURNS TABLE(is_valid boolean, message text)
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION is_student_already_processed(p_student_id uuid, p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM class_history
    WHERE student_id = p_student_id
      AND session_id = p_session_id
      AND promotion_status IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION get_unprocessed_students_for_class(
  p_class_id uuid,
  p_session_id uuid,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  student_id uuid,
  student_id_number text,
  student_name text,
  class_id uuid,
  class_name text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id,
    s.student_id,
    CONCAT(s.first_name, ' ', s.last_name),
    c.id,
    c.name
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE c.id = p_class_id
    AND NOT is_student_already_processed(s.id, p_session_id)
  ORDER BY s.first_name, s.last_name
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION acquire_promotion_processing_lock(
  p_session_id uuid,
  p_lock_id text,
  p_lock_ttl_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO promotion_settings (session_id)
  VALUES (p_session_id)
  ON CONFLICT (session_id) DO NOTHING;

  UPDATE promotion_settings
  SET
    processing_lock_id = p_lock_id,
    processing_started_at = now(),
    updated_at = now()
  WHERE session_id = p_session_id
    AND last_processed_at IS NULL
    AND (
      processing_lock_id IS NULL
      OR processing_started_at IS NULL
      OR processing_started_at < now() - make_interval(secs => p_lock_ttl_seconds)
      OR processing_lock_id = p_lock_id
    );

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION release_promotion_processing_lock(
  p_session_id uuid,
  p_lock_id text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE promotion_settings
  SET
    processing_lock_id = NULL,
    processing_started_at = NULL,
    updated_at = now()
  WHERE session_id = p_session_id
    AND processing_lock_id = p_lock_id;

  RETURN FOUND;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7) Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subject_classes_school ON subject_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_subject ON subject_classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_class ON subject_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_teacher ON subject_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_department ON subject_classes(department_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_religion ON subject_classes(religion_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_is_optional ON subject_classes(is_optional);

CREATE INDEX IF NOT EXISTS idx_student_subjects_school ON student_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject_class ON student_subjects(subject_class_id);

CREATE INDEX IF NOT EXISTS idx_student_optional_subjects_school ON student_optional_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_student_optional_subjects_student ON student_optional_subjects(student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_school ON attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

CREATE INDEX IF NOT EXISTS idx_assignments_school ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_term ON assignments(term_id);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_school ON assignment_submissions(school_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id);

CREATE INDEX IF NOT EXISTS idx_submissions_school ON submissions(school_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);

CREATE INDEX IF NOT EXISTS idx_results_school ON results(school_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_subject_class ON results(subject_class_id);
CREATE INDEX IF NOT EXISTS idx_results_term ON results(term_id);

CREATE INDEX IF NOT EXISTS idx_results_publication_school ON results_publication(school_id);
CREATE INDEX IF NOT EXISTS idx_results_publication_class_session_term ON results_publication(class_id, session_id, term_id);

CREATE INDEX IF NOT EXISTS idx_result_school_settings_school ON result_school_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_result_component_templates_school ON result_component_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_result_grade_scales_school ON result_grade_scales(school_id);
CREATE INDEX IF NOT EXISTS idx_result_component_scores_school ON result_component_scores(school_id);
CREATE INDEX IF NOT EXISTS idx_result_component_scores_result ON result_component_scores(result_id);

CREATE INDEX IF NOT EXISTS idx_class_history_school ON class_history(school_id);
CREATE INDEX IF NOT EXISTS idx_class_history_student ON class_history(student_id);
CREATE INDEX IF NOT EXISTS idx_class_history_class ON class_history(class_id);
CREATE INDEX IF NOT EXISTS idx_class_history_session ON class_history(session_id);

CREATE INDEX IF NOT EXISTS idx_promotion_settings_session ON promotion_settings(session_id);
CREATE INDEX IF NOT EXISTS idx_promotion_settings_processing_lock ON promotion_settings(session_id, processing_lock_id, processing_started_at);

CREATE INDEX IF NOT EXISTS idx_promotion_class_mappings_school_id ON promotion_class_mappings(school_id);
CREATE INDEX IF NOT EXISTS idx_promotion_class_mappings_session_id ON promotion_class_mappings(session_id);

CREATE INDEX IF NOT EXISTS idx_promotion_class_progress_school_id ON promotion_class_progress(school_id);
CREATE INDEX IF NOT EXISTS idx_promotion_class_progress_session_id ON promotion_class_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_promotion_class_progress_status ON promotion_class_progress(status) WHERE status != 'completed';

-- -----------------------------------------------------------------------------
-- 8) updated_at triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_subject_classes_updated_at ON subject_classes;
CREATE TRIGGER set_subject_classes_updated_at BEFORE UPDATE ON subject_classes FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_assignments_updated_at ON assignments;
CREATE TRIGGER set_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_assignment_submissions_updated_at ON assignment_submissions;
CREATE TRIGGER set_assignment_submissions_updated_at BEFORE UPDATE ON assignment_submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_submissions_updated_at ON submissions;
CREATE TRIGGER set_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_results_updated_at ON results;
CREATE TRIGGER set_results_updated_at BEFORE UPDATE ON results FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_results_publication_updated_at ON results_publication;
CREATE TRIGGER set_results_publication_updated_at BEFORE UPDATE ON results_publication FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS update_result_school_settings_timestamp ON result_school_settings;
CREATE TRIGGER update_result_school_settings_timestamp BEFORE UPDATE ON result_school_settings FOR EACH ROW EXECUTE FUNCTION update_result_settings_timestamp();

DROP TRIGGER IF EXISTS update_result_component_templates_timestamp ON result_component_templates;
CREATE TRIGGER update_result_component_templates_timestamp BEFORE UPDATE ON result_component_templates FOR EACH ROW EXECUTE FUNCTION update_result_settings_timestamp();

DROP TRIGGER IF EXISTS update_result_grade_scales_timestamp ON result_grade_scales;
CREATE TRIGGER update_result_grade_scales_timestamp BEFORE UPDATE ON result_grade_scales FOR EACH ROW EXECUTE FUNCTION update_result_settings_timestamp();

DROP TRIGGER IF EXISTS update_result_component_scores_timestamp ON result_component_scores;
CREATE TRIGGER update_result_component_scores_timestamp BEFORE UPDATE ON result_component_scores FOR EACH ROW EXECUTE FUNCTION update_result_settings_timestamp();

DROP TRIGGER IF EXISTS set_class_history_updated_at ON class_history;
CREATE TRIGGER set_class_history_updated_at BEFORE UPDATE ON class_history FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_promotion_settings_updated_at ON promotion_settings;
CREATE TRIGGER set_promotion_settings_updated_at BEFORE UPDATE ON promotion_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_promotion_class_mappings_updated_at ON promotion_class_mappings;
CREATE TRIGGER set_promotion_class_mappings_updated_at BEFORE UPDATE ON promotion_class_mappings FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_promotion_class_progress_updated_at ON promotion_class_progress;
CREATE TRIGGER set_promotion_class_progress_updated_at BEFORE UPDATE ON promotion_class_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- -----------------------------------------------------------------------------
-- 9) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE subject_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_optional_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE results_publication ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_component_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_component_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_class_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_class_progress ENABLE ROW LEVEL SECURITY;

-- subject_classes: must allow nested expansions cleanly
DROP POLICY IF EXISTS "Subject classes school read" ON subject_classes;
CREATE POLICY "Subject classes school read"
  ON subject_classes FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Subject classes admin manage" ON subject_classes;
CREATE POLICY "Subject classes admin manage"
  ON subject_classes FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- student_subjects: scope through student relationship, not only direct school_id
DROP POLICY IF EXISTS "Student subjects read by relation" ON student_subjects;
CREATE POLICY "Student subjects read by relation"
  ON student_subjects FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM students s
      WHERE s.id = student_subjects.student_id
        AND s.school_id = get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "Student subjects admin manage by relation" ON student_subjects;
CREATE POLICY "Student subjects admin manage by relation"
  ON student_subjects FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM students s
      WHERE s.id = student_subjects.student_id
        AND s.school_id = get_my_school_id()
        AND is_admin()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM students s
      WHERE s.id = student_subjects.student_id
        AND s.school_id = get_my_school_id()
        AND is_admin()
    )
  );

DROP POLICY IF EXISTS "Student optional subjects school read" ON student_optional_subjects;
CREATE POLICY "Student optional subjects school read"
  ON student_optional_subjects FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Student optional subjects admin manage" ON student_optional_subjects;
CREATE POLICY "Student optional subjects admin manage"
  ON student_optional_subjects FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Attendance school read" ON attendance;
CREATE POLICY "Attendance school read"
  ON attendance FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Attendance admin manage" ON attendance;
CREATE POLICY "Attendance admin manage"
  ON attendance FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Assignments school read" ON assignments;
CREATE POLICY "Assignments school read"
  ON assignments FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Assignments teachers and admins manage" ON assignments;
CREATE POLICY "Assignments teachers and admins manage"
  ON assignments FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
    OR (
      school_id = get_my_school_id()
      AND EXISTS (
        SELECT 1
        FROM teachers t
        WHERE t.id = assignments.teacher_id
          AND t.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
    OR (
      school_id = get_my_school_id()
      AND EXISTS (
        SELECT 1
        FROM teachers t
        WHERE t.id = assignments.teacher_id
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Assignment submissions school read" ON assignment_submissions;
CREATE POLICY "Assignment submissions school read"
  ON assignment_submissions FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Students can submit assignments" ON assignment_submissions;
CREATE POLICY "Students can submit assignments"
  ON assignment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    AND school_id IN (SELECT school_id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Students can update their own submissions" ON assignment_submissions;
CREATE POLICY "Students can update their own submissions"
  ON assignment_submissions FOR UPDATE TO authenticated
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    AND school_id IN (SELECT school_id FROM students WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    AND school_id IN (SELECT school_id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Submissions school read" ON submissions;
CREATE POLICY "Submissions school read"
  ON submissions FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Submissions school manage" ON submissions;
CREATE POLICY "Submissions school manage"
  ON submissions FOR ALL TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id())
  WITH CHECK (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Results school read" ON results;
CREATE POLICY "Results school read"
  ON results FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Results admin manage" ON results;
CREATE POLICY "Results admin manage"
  ON results FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Class teachers can manage class results" ON results;
CREATE POLICY "Class teachers can manage class results"
  ON results FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND EXISTS (
        SELECT 1
        FROM subject_classes sc
        JOIN classes c ON c.id = sc.class_id
        JOIN teachers t ON t.id = c.class_teacher_id
        WHERE sc.id = results.subject_class_id
          AND sc.school_id = results.school_id
          AND c.school_id = results.school_id
          AND t.school_id = results.school_id
          AND t.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = get_my_school_id()
      AND EXISTS (
        SELECT 1
        FROM subject_classes sc
        JOIN classes c ON c.id = sc.class_id
        JOIN teachers t ON t.id = c.class_teacher_id
        WHERE sc.id = results.subject_class_id
          AND sc.school_id = results.school_id
          AND c.school_id = results.school_id
          AND t.school_id = results.school_id
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Results publication school read" ON results_publication;
CREATE POLICY "Results publication school read"
  ON results_publication FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Results publication admin manage" ON results_publication;
CREATE POLICY "Results publication admin manage"
  ON results_publication FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read result school settings" ON result_school_settings;
CREATE POLICY "School users can read result school settings"
  ON result_school_settings FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage result school settings" ON result_school_settings;
CREATE POLICY "Admins can manage result school settings"
  ON result_school_settings FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read result component templates" ON result_component_templates;
CREATE POLICY "School users can read result component templates"
  ON result_component_templates FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage result component templates" ON result_component_templates;
CREATE POLICY "Admins can manage result component templates"
  ON result_component_templates FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read result grade scales" ON result_grade_scales;
CREATE POLICY "School users can read result grade scales"
  ON result_grade_scales FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage result grade scales" ON result_grade_scales;
CREATE POLICY "Admins can manage result grade scales"
  ON result_grade_scales FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read result component scores" ON result_component_scores;
CREATE POLICY "School users can read result component scores"
  ON result_component_scores FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "School users can manage result component scores" ON result_component_scores;
CREATE POLICY "School users can manage result component scores"
  ON result_component_scores FOR ALL TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id())
  WITH CHECK (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Class history school read" ON class_history;
CREATE POLICY "Class history school read"
  ON class_history FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = class_history.student_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Class history admin manage" ON class_history;
CREATE POLICY "Class history admin manage"
  ON class_history FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Promotion settings school read" ON promotion_settings;
CREATE POLICY "Promotion settings school read"
  ON promotion_settings FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM sessions se
      WHERE se.id = promotion_settings.session_id
        AND se.school_id = get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "Promotion settings school manage" ON promotion_settings;
CREATE POLICY "Promotion settings school manage"
  ON promotion_settings FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      is_admin()
      AND EXISTS (
        SELECT 1
        FROM sessions se
        WHERE se.id = promotion_settings.session_id
          AND se.school_id = get_my_school_id()
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      is_admin()
      AND EXISTS (
        SELECT 1
        FROM sessions se
        WHERE se.id = promotion_settings.session_id
          AND se.school_id = get_my_school_id()
      )
    )
  );

DROP POLICY IF EXISTS "Promotion mappings school read" ON promotion_class_mappings;
CREATE POLICY "Promotion mappings school read"
  ON promotion_class_mappings FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Promotion mappings admin manage" ON promotion_class_mappings;
CREATE POLICY "Promotion mappings admin manage"
  ON promotion_class_mappings FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Promotion progress school read" ON promotion_class_progress;
CREATE POLICY "Promotion progress school read"
  ON promotion_class_progress FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Promotion progress admin manage" ON promotion_class_progress;
CREATE POLICY "Promotion progress admin manage"
  ON promotion_class_progress FOR ALL TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));
