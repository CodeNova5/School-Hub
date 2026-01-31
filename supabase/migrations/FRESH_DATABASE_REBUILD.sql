-- ============================================================================
-- STEP 2: CREATE BASE TABLES (no foreign key dependencies)
-- ============================================================================

-- 1. SESSIONS TABLE
-- ============================================================================
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sessions_is_current ON sessions(is_current);

-- 2. TEACHERS TABLE
-- ============================================================================
CREATE TABLE teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text DEFAULT '',
  address text DEFAULT '',
  qualification text DEFAULT '',
  specialization text DEFAULT '',
  date_of_birth date,
  hire_date date DEFAULT CURRENT_DATE,
  photo_url text DEFAULT '',
  bio text DEFAULT '',
  status text DEFAULT 'active',
  activation_token_hash text,
  activation_expires_at timestamptz,
  activation_used boolean DEFAULT false,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE INDEX idx_teachers_status ON teachers(status);
CREATE INDEX idx_teachers_email ON teachers(email);

-- ============================================================================
-- STEP 3: CREATE DEPENDENT TABLES
-- ============================================================================

-- 3. TERMS TABLE
-- ============================================================================
CREATE TABLE terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_terms_session ON terms(session_id);
CREATE INDEX idx_terms_is_current ON terms(is_current);

-- 4. CLASSES TABLE
-- ============================================================================
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text NOT NULL CHECK (
    level = ANY (ARRAY[
      'Nursery 1', 'Nursery 2', 'KG 1', 'KG 2',
      'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
      'JSS 1', 'JSS 2', 'JSS 3',
      'SSS 1', 'SSS 2', 'SSS 3'
    ])
  ),
  education_level text NOT NULL CHECK (
    education_level = ANY (ARRAY['Pre-Primary', 'Primary', 'JSS', 'SSS'])
  ),
  department text CHECK (
    department IS NULL OR department = ANY (ARRAY['Science', 'Arts', 'Commercial'])
  ),
  capacity integer DEFAULT 30,
  room_number text,
  stream text,
  class_teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  academic_year text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_classes_education_level ON classes(education_level);
CREATE INDEX idx_classes_department ON classes(department);
CREATE INDEX idx_classes_session ON classes(session_id);
CREATE INDEX idx_classes_teacher ON classes(class_teacher_id);
CREATE UNIQUE INDEX unique_class_per_level_stream ON classes (education_level, level, COALESCE(stream, ''));

-- 5. SUBJECTS TABLE
-- ============================================================================
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject_code text,
  education_level text NOT NULL DEFAULT 'Primary' CHECK (
    education_level = ANY (ARRAY['Pre-Primary', 'Primary', 'JSS', 'SSS'])
  ),
  department text CHECK (
    department IS NULL OR department = ANY (ARRAY['Science', 'Arts', 'Commercial'])
  ),
  religion text CHECK (
    religion IS NULL OR religion = ANY (ARRAY['Christian', 'Muslim'])
  ),
  is_optional boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subjects_education_level ON subjects(education_level);
CREATE INDEX idx_subjects_department ON subjects(department);
CREATE INDEX idx_subjects_religion ON subjects(religion);
CREATE UNIQUE INDEX unique_subject_per_level_department ON subjects (name, education_level, COALESCE(department, ''), COALESCE(religion, ''));

-- 6. STUDENTS TABLE
-- ============================================================================
CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  student_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  date_of_birth date,
  gender text DEFAULT '',
  address text DEFAULT '',
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  department text,
  religion text CHECK (
    religion IS NULL OR religion = ANY (ARRAY['Christian', 'Muslim'])
  ),
  parent_name text DEFAULT '',
  parent_email text DEFAULT '',
  parent_phone text DEFAULT '',
  admission_date date DEFAULT CURRENT_DATE,
  photo_url text DEFAULT '',
  status text DEFAULT 'active',
  attendance jsonb DEFAULT '[]',
  average_attendance numeric DEFAULT 0,
  results jsonb DEFAULT '[]',
  activation_token_hash text,
  activation_expires_at timestamptz,
  activation_used boolean DEFAULT false,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_religion ON students(religion);

-- 7. SUBJECT_CLASSES JUNCTION TABLE
-- ============================================================================
CREATE TABLE subject_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_code text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, class_id)
);

CREATE INDEX idx_subject_classes_subject ON subject_classes(subject_id);
CREATE INDEX idx_subject_classes_teacher ON subject_classes(teacher_id);
CREATE INDEX idx_subject_classes_class ON subject_classes(class_id);

-- 8. STUDENT_SUBJECTS TABLE
-- ============================================================================
CREATE TABLE student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  subject_class_id uuid REFERENCES subject_classes(id) ON DELETE CASCADE,

  UNIQUE(student_id, subject_class_id)
);

CREATE INDEX idx_student_subjects_subject_class ON student_subjects(subject_class_id);

-- 9. STUDENT_OPTIONAL_SUBJECTS TABLE
-- ============================================================================
CREATE TABLE student_optional_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

CREATE INDEX idx_student_optional_subjects_student ON student_optional_subjects(student_id);
CREATE INDEX idx_student_optional_subjects_subject ON student_optional_subjects(subject_id);

-- 10. SUBJECT_ASSIGNMENTS TABLE
-- ============================================================================
CREATE TABLE subject_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subject_assignments_subject ON subject_assignments(subject_id);
CREATE INDEX idx_subject_assignments_teacher ON subject_assignments(teacher_id);
CREATE INDEX idx_subject_assignments_class ON subject_assignments(class_id);

-- 11. ATTENDANCE TABLE
-- ============================================================================
CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  date date NOT NULL,
  status text DEFAULT 'present',
  marked_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_class ON attendance(class_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_term ON attendance(term_id);

-- 12. ASSIGNMENTS TABLE
-- ============================================================================
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  instructions text DEFAULT '',
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  total_marks integer DEFAULT 100,
  submission_type text DEFAULT 'text',
  allow_late_submission boolean DEFAULT false,
  file_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX idx_assignments_class ON assignments(class_id);
CREATE INDEX idx_assignments_subject ON assignments(subject_id);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
CREATE INDEX idx_assignments_session ON assignments(session_id);
CREATE INDEX idx_assignments_term ON assignments(term_id);

-- 13. ASSIGNMENT_SUBMISSIONS TABLE
-- ============================================================================
CREATE TABLE assignment_submissions (
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
  graded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON assignment_submissions(student_id);
CREATE INDEX idx_submissions_submitted_at ON assignment_submissions(submitted_at);
CREATE INDEX idx_submissions_graded_by ON assignment_submissions(graded_by);

-- 14. SUBMISSIONS TABLE (legacy)
-- ============================================================================
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  submitted_at timestamptz DEFAULT now(),
  content text DEFAULT '',
  file_url text DEFAULT '',
  marks_obtained integer,
  feedback text DEFAULT '',
  status text DEFAULT 'pending'
);

CREATE INDEX idx_submissions_legacy_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_legacy_student ON submissions(student_id);

-- 15. RESULTS TABLE
-- ============================================================================
CREATE TABLE results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
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
  subject_name text,
  
  -- Teacher and principal comments
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
  
  -- Unique constraint
  UNIQUE(student_id, subject_class_id, session_id, term_id)
);

CREATE INDEX idx_results_student ON results(student_id);
CREATE INDEX idx_results_subject_class ON results(subject_class_id);
CREATE INDEX idx_results_term ON results(term_id);
CREATE INDEX idx_results_session ON results(session_id);

-- 16. ADMISSIONS TABLE
-- ============================================================================
CREATE TABLE admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  date_of_birth date,
  gender text DEFAULT '',
  address text DEFAULT '',
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text NOT NULL,
  desired_class text NOT NULL,
  previous_school text DEFAULT '',
  status text DEFAULT 'pending',
  exam_date timestamptz,
  exam_location text DEFAULT '',
  notes text DEFAULT '',
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX idx_admissions_status ON admissions(status);

-- 17. EVENTS TABLE
-- ============================================================================
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  event_type text DEFAULT 'meeting',
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  location text DEFAULT '',
  is_all_day boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_type ON events(event_type);

-- 18. NEWS TABLE
-- ============================================================================
CREATE TABLE news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  excerpt text DEFAULT '',
  image_url text DEFAULT '',
  category text DEFAULT 'announcement',
  published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_news_published ON news(published);
CREATE INDEX idx_news_category ON news(category);

-- 19. TESTIMONIALS TABLE
-- ============================================================================
CREATE TABLE testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text DEFAULT 'alumni',
  content text NOT NULL,
  photo_url text DEFAULT '',
  year text DEFAULT '',
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_testimonials_published ON testimonials(published);

-- 20. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- 21. SCHOOL_SETTINGS TABLE
-- ============================================================================
CREATE TABLE school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_school_settings_key ON school_settings(key);

-- ============================================================================
-- STEP 4: TIMETABLE TABLES
-- ============================================================================

-- 22. PERIOD_SLOTS TABLE
-- ============================================================================
CREATE TABLE period_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week text NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  period_number integer NOT NULL CHECK (period_number > 0),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_break boolean DEFAULT false,
  duration_minutes integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_day_period UNIQUE (day_of_week, period_number),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_period_slots_day ON period_slots(day_of_week);
CREATE INDEX idx_period_slots_day_period ON period_slots(day_of_week, period_number);

-- ============================================================================
-- STEP 5: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function: Calculate result totals and grades
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
  
  -- Calculate grade and remark
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

CREATE TRIGGER trigger_calculate_result_totals
  BEFORE INSERT OR UPDATE OF welcome_test, mid_term_test, vetting, exam ON results
  FOR EACH ROW
  EXECUTE FUNCTION calculate_result_totals();

-- Function: Check submission on time
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

CREATE TRIGGER trigger_check_submission_on_time
  BEFORE INSERT ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION check_submission_on_time();

-- Function: Link class to subjects (auto-linking)
-- ============================================================================
CREATE OR REPLACE FUNCTION link_class_to_subjects()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove old links
  DELETE FROM subject_classes WHERE class_id = NEW.id;
  
  -- Link subjects by education level (exclude religion-specific subjects)
  INSERT INTO subject_classes (subject_id, class_id)
  SELECT s.id, NEW.id
  FROM subjects s
  WHERE s.education_level = NEW.education_level
    AND s.religion IS NULL
  ON CONFLICT (subject_id, class_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_link_class_to_subjects
  AFTER INSERT OR UPDATE OF education_level, department ON classes
  FOR EACH ROW
  EXECUTE FUNCTION link_class_to_subjects();

-- Function: Get student subjects (including optional and religion)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_student_subjects(student_uuid uuid)
RETURNS TABLE(
  subject_class_id uuid,
  subject_id uuid,
  subject_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    sc.id AS subject_class_id,
    s.id AS subject_id,
    s.name AS subject_name
  FROM students st
  JOIN classes c ON c.id = st.class_id
  JOIN subject_classes sc ON sc.class_id = c.id
  JOIN subjects s ON s.id = sc.subject_id
  WHERE st.id = student_uuid
    AND (
      -- Compulsory subjects
      s.is_optional = false
      -- Optional subjects student selected
      OR (s.is_optional = true AND EXISTS (
        SELECT 1
        FROM student_optional_subjects sos
        WHERE sos.student_id = student_uuid
          AND sos.subject_id = s.id
      ))
      -- Religion-specific subjects
      OR (s.religion IS NOT NULL AND s.religion = st.religion)
    )
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- Function: Get student position
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
  
  -- Get student's position
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
-- STEP 6: SEED DEFAULT PERIOD SLOTS
-- ============================================================================

-- MONDAY-THURSDAY: 13 periods (8:00 AM - 4:00 PM)
INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Monday', 1, '08:00', '08:40', false),
('Monday', 2, '08:40', '09:20', false),
('Monday', 3, '09:20', '10:00', false),
('Monday', 4, '10:00', '10:40', false),
('Monday', 5, '10:40', '11:20', false),
('Monday', 6, '11:20', '12:00', true),
('Monday', 7, '12:00', '12:40', false),
('Monday', 8, '12:40', '13:20', false),
('Monday', 9, '13:20', '14:00', false),
('Monday', 10, '14:00', '14:15', true),
('Monday', 11, '14:15', '14:50', false),
('Monday', 12, '14:50', '15:25', false),
('Monday', 13, '15:25', '16:00', false);

INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Tuesday', 1, '08:00', '08:40', false),
('Tuesday', 2, '08:40', '09:20', false),
('Tuesday', 3, '09:20', '10:00', false),
('Tuesday', 4, '10:00', '10:40', false),
('Tuesday', 5, '10:40', '11:20', false),
('Tuesday', 6, '11:20', '12:00', true),
('Tuesday', 7, '12:00', '12:40', false),
('Tuesday', 8, '12:40', '13:20', false),
('Tuesday', 9, '13:20', '14:00', false),
('Tuesday', 10, '14:00', '14:15', true),
('Tuesday', 11, '14:15', '14:50', false),
('Tuesday', 12, '14:50', '15:25', false),
('Tuesday', 13, '15:25', '16:00', false);

INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Wednesday', 1, '08:00', '08:40', false),
('Wednesday', 2, '08:40', '09:20', false),
('Wednesday', 3, '09:20', '10:00', false),
('Wednesday', 4, '10:00', '10:40', false),
('Wednesday', 5, '10:40', '11:20', false),
('Wednesday', 6, '11:20', '12:00', true),
('Wednesday', 7, '12:00', '12:40', false),
('Wednesday', 8, '12:40', '13:20', false),
('Wednesday', 9, '13:20', '14:00', false),
('Wednesday', 10, '14:00', '14:15', true),
('Wednesday', 11, '14:15', '14:50', false),
('Wednesday', 12, '14:50', '15:25', false),
('Wednesday', 13, '15:25', '16:00', false);

INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Thursday', 1, '08:00', '08:40', false),
('Thursday', 2, '08:40', '09:20', false),
('Thursday', 3, '09:20', '10:00', false),
('Thursday', 4, '10:00', '10:40', false),
('Thursday', 5, '10:40', '11:20', false),
('Thursday', 6, '11:20', '12:00', true),
('Thursday', 7, '12:00', '12:40', false),
('Thursday', 8, '12:40', '13:20', false),
('Thursday', 9, '13:20', '14:00', false),
('Thursday', 10, '14:00', '14:15', true),
('Thursday', 11, '14:15', '14:50', false),
('Thursday', 12, '14:50', '15:25', false),
('Thursday', 13, '15:25', '16:00', false);

-- FRIDAY: 8 periods (8:00 AM - 12:30 PM)
INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Friday', 1, '08:00', '08:30', false),
('Friday', 2, '08:30', '09:00', false),
('Friday', 3, '09:00', '09:30', false),
('Friday', 4, '09:30', '10:00', false),
('Friday', 5, '10:00', '10:30', false),
('Friday', 6, '10:30', '11:00', true),
('Friday', 7, '11:00', '11:45', false),
('Friday', 8, '11:45', '12:30', false);

-- =====================================================================
-- TIMETABLE ENTRIES TABLE (with RBAC/RLS integration)
-- =====================================================================

CREATE TABLE IF NOT EXISTS timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_slot_id uuid NOT NULL REFERENCES period_slots(id) ON DELETE CASCADE,
  subject_class_id uuid REFERENCES subject_classes(id) ON DELETE SET NULL,
  department text, -- Science, Arts, Commercial, etc (nullable)
  religion text,   -- Christian, Muslim, etc (nullable)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_timetable_entries_class_id ON timetable_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_period_slot_id ON timetable_entries(period_slot_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_subject_class_id ON timetable_entries(subject_class_id);

-- Enable Row Level Security
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- =========================
-- RLS POLICIES
-- =========================

-- Allow all authenticated users to read timetable entries
CREATE POLICY "Authenticated users can read timetable entries"
  ON timetable_entries FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete timetable entries
CREATE POLICY "Only admins can manage timetable entries"
  ON timetable_entries FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
  
-- ============================================================================
-- COMPLETION NOTICE
-- ============================================================================
-- ✅ All tables created successfully
-- ✅ All indexes created for performance
-- ✅ All foreign key constraints in place
-- ✅ All triggers and functions installed
-- ✅ Default period slots seeded
-- 
-- NEXT STEPS:
-- 1. Apply your RLS policies (RBAC_SECURITY_SYSTEM.sql)
-- 2. Insert your sessions, teachers, classes, subjects data
-- 3. Enable RLS on all tables as needed
-- 