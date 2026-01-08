-- ============================================================================
-- STUDENT SUBJECTS AND RESULTS ENHANCEMENT
-- ============================================================================
-- Run this SQL in Supabase SQL Editor after running COMPLETE_DATABASE_SETUP.sql
-- ============================================================================

-- ============================================================================
-- 1. STUDENT_SUBJECTS TABLE
-- Tracks which subjects each student is offering (for subject selection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, subject_id, session_id)
);

ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read student_subjects" ON student_subjects;
CREATE POLICY "Anyone can read student_subjects" ON student_subjects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can manage student_subjects" ON student_subjects;
CREATE POLICY "Teachers can manage student_subjects" ON student_subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject ON student_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_session ON student_subjects(session_id);

-- ============================================================================
-- 2. UPDATE RESULTS TABLE STRUCTURE
-- Store detailed test scores instead of just final marks
-- ============================================================================

-- Drop existing results table if it exists and recreate with new structure
DROP TABLE IF EXISTS results CASCADE;

CREATE TABLE results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  student_id uuid REFERENCES students(id) ON DELETE CASCADE,

  -- 🔥 THIS IS THE KEY CHANGE
  subject_class_id uuid REFERENCES subject_classes(id) ON DELETE CASCADE,

  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id) ON DELETE CASCADE,

  -- Test scores
  welcome_test numeric DEFAULT 0 CHECK (welcome_test >= 0 AND welcome_test <= 10),
  mid_term_test numeric DEFAULT 0 CHECK (mid_term_test >= 0 AND mid_term_test <= 20),
  vetting numeric DEFAULT 0 CHECK (vetting >= 0 AND vetting <= 10),
  exam numeric DEFAULT 0 CHECK (exam >= 0 AND exam <= 60),

  -- Calculated fields
  total numeric DEFAULT 0,
  grade text DEFAULT '',
  remark text DEFAULT '',

  -- Teacher and principal comments (per student per term)
  class_teacher_remark text DEFAULT '',
  class_teacher_name text DEFAULT '',
  class_teacher_signature text DEFAULT '',
  principal_remark text DEFAULT '',
  principal_signature text DEFAULT '',

  next_term_begins date,

  -- Class position and statistics
  class_position integer,
  total_students integer,
  class_average numeric,

  -- Metadata
  entered_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- 🔥 CRITICAL UNIQUE RULE
  UNIQUE(student_id, subject_class_id, term_id)
);


ALTER TABLE results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read results" ON results;
CREATE POLICY "Anyone can read results" ON results FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can manage results" ON results;

CREATE POLICY "Teachers can manage results" ON results FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_results_student ON results(student_id);
CREATE INDEX idx_results_subject_class ON results(subject_class_id);
CREATE INDEX idx_results_term ON results(term_id);
CREATE INDEX idx_results_session ON results(session_id);

-- ============================================================================
-- 3. TRIGGER TO AUTO-CALCULATE TOTAL AND GRADE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_result_totals()
RETURNS TRIGGER AS $$
DECLARE
  calculated_total numeric;
  calculated_grade text;
  calculated_remark text;
BEGIN
  -- Calculate total
  calculated_total := COALESCE(NEW.welcome_test, 0) +
                      COALESCE(NEW.mid_term_test, 0) +
                      COALESCE(NEW.vetting, 0) +
                      COALESCE(NEW.exam, 0);

  NEW.total := calculated_total;

  -- Calculate grade and remark based on total
  IF calculated_total >= 75 THEN
    calculated_grade := 'A1';
    calculated_remark := 'Excellent';
  ELSIF calculated_total >= 70 THEN
    calculated_grade := 'B2';
    calculated_remark := 'Very Good';
  ELSIF calculated_total >= 65 THEN
    calculated_grade := 'B3';
    calculated_remark := 'Good';
  ELSIF calculated_total >= 60 THEN
    calculated_grade := 'C4';
    calculated_remark := 'Credit';
  ELSIF calculated_total >= 55 THEN
    calculated_grade := 'C5';
    calculated_remark := 'Credit';
  ELSIF calculated_total >= 50 THEN
    calculated_grade := 'C6';
    calculated_remark := 'Credit';
  ELSIF calculated_total >= 45 THEN
    calculated_grade := 'D7';
    calculated_remark := 'Pass';
  ELSIF calculated_total >= 40 THEN
    calculated_grade := 'E8';
    calculated_remark := 'Pass';
  ELSE
    calculated_grade := 'F9';
    calculated_remark := 'Fail';
  END IF;

  NEW.grade := calculated_grade;
  NEW.remark := calculated_remark;
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_result_totals ON results;
CREATE TRIGGER trigger_calculate_result_totals
  BEFORE INSERT OR UPDATE OF welcome_test, mid_term_test, vetting, exam ON results
  FOR EACH ROW
  EXECUTE FUNCTION calculate_result_totals();

-- ============================================================================
-- 4. FUNCTION TO GET STUDENT CLASS POSITION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_student_position(
  p_student_id uuid,
  p_term_id uuid
)
RETURNS TABLE(
  class_position integer,
  total_score numeric,
  total_students integer,
  average_percentage numeric
) AS $$
DECLARE
  student_total numeric;
  student_count integer;
  student_position integer;
  student_avg numeric;
BEGIN
  -- Get student's total score for the term
  SELECT SUM(r.total)
  INTO student_total
  FROM results r
  WHERE r.student_id = p_student_id
    AND r.term_id = p_term_id;

  -- Get student's position (based on total scores)
  WITH class_totals AS (
    SELECT
      r.student_id,
      SUM(r.total) as total_score
    FROM results r
JOIN subject_classes sc ON sc.id = r.subject_class_id
    WHERE r.term_id = p_term_id
     AND sc.class_id = (SELECT class_id FROM students WHERE id = p_student_id)
    GROUP BY r.student_id
  )
  SELECT
    COUNT(*) + 1,
    COUNT(DISTINCT ct.student_id)
  INTO student_position, student_count
  FROM class_totals ct
  WHERE ct.total_score > student_total;

  -- Calculate average percentage
  WITH subject_count AS (
    SELECT COUNT(*) as num_subjects
    FROM results
    WHERE student_id = p_student_id
      AND term_id = p_term_id
  )
  SELECT
    CASE
      WHEN sc.num_subjects > 0
      THEN (student_total / (sc.num_subjects * 100.0)) * 100
      ELSE 0
    END
  INTO student_avg
  FROM subject_count sc;

  RETURN QUERY SELECT student_position, student_total, student_count, student_avg;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ASSIGNMENTS TABLE
-- Stores assignments created by teachers
-- ============================================================================

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  instructions text DEFAULT '',
  due_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read assignments" ON assignments;
CREATE POLICY "Anyone can read assignments" ON assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can manage assignments" ON assignments;
CREATE POLICY "Teachers can manage assignments" ON assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

-- ============================================================================
-- 6. ASSIGNMENT_SUBMISSIONS TABLE
-- Stores student submissions for assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  submission_text text DEFAULT '',
  file_url text DEFAULT '',
  submitted_at timestamptz DEFAULT now(),
  submitted_on_time boolean DEFAULT true,
  grade numeric CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100)),
  feedback text DEFAULT '',
  graded_at timestamptz,
  graded_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read submissions" ON assignment_submissions;
CREATE POLICY "Anyone can read submissions" ON assignment_submissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can manage submissions" ON assignment_submissions;
CREATE POLICY "Teachers can manage submissions" ON assignment_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON assignment_submissions(submitted_at);

-- ============================================================================
-- 7. TRIGGER TO MARK LATE SUBMISSIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_submission_on_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submitted_at::date > (
    SELECT due_date FROM assignments WHERE id = NEW.assignment_id
  ) THEN
    NEW.submitted_on_time := false;
  ELSE
    NEW.submitted_on_time := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_submission_on_time ON assignment_submissions;
CREATE TRIGGER trigger_check_submission_on_time
  BEFORE INSERT ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION check_submission_on_time();

-- ============================================================================
-- DONE!
-- ============================================================================
-- ✓ student_subjects table created for tracking student subject selections
-- ✓ results table recreated with detailed score columns
-- ✓ Auto-calculation trigger for total and grade
-- ✓ Function to calculate student position in class
-- ✓ assignments table for teacher-created assignments
-- ✓ assignment_submissions table for student submissions
-- ✓ Trigger to automatically check if submission is on time
-- ============================================================================
