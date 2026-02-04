-- ============================================================================
-- SCHOOL MANAGEMENT SYSTEM - COMPLETE DATABASE SETUP
-- ============================================================================
-- This migration creates the entire database schema including:
-- 1. All core tables (sessions, teachers, students, classes, subjects, etc.)
-- 2. Granular RBAC system with super_admin and custom roles
-- 3. Parent portal functionality
-- 4. Results publication control system
-- 5. Complete Row Level Security (RLS) policies
-- ============================================================================

-- ============================================================================
-- PART 1: GRANULAR RBAC SYSTEM (NEW SYSTEM)
-- ============================================================================

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL
);

-- Role-Permission junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- User-Role links (many-to-many)
CREATE TABLE IF NOT EXISTS user_role_links (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Insert default roles
INSERT INTO roles (name) VALUES
('super_admin'),
('admin')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (key) VALUES
('manage_admins'),
('edit_timetable'),
('edit_results'),
('edit_students'),
('edit_subjects'),
('edit_class'),
('edit_attendance'),
('edit_calendar'),
('edit_settings'),
('admin_full')
ON CONFLICT (key) DO NOTHING;

-- Grant all permissions to super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Helper function: Check if user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_role_links ul
    JOIN role_permissions rp ON rp.role_id = ul.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ul.user_id = auth.uid()
      AND p.key = p_key
  );
$$;

-- Helper function: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT has_permission('admin_full');
$$;

-- Helper function: Check if user can access admin area
CREATE OR REPLACE FUNCTION can_access_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT has_permission('admin_full')
      OR has_permission('edit_timetable')
      OR has_permission('edit_results')
      OR has_permission('manage_admins');
$$;

-- Enable RLS on RBAC tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for RBAC tables
CREATE POLICY "read roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "only super admin manages roles"
  ON roles FOR ALL
  TO authenticated
  USING (has_permission('manage_admins'))
  WITH CHECK (has_permission('manage_admins'));

CREATE POLICY "read permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "only super admin manages permissions"
  ON permissions FOR ALL
  TO authenticated
  USING (has_permission('manage_admins'))
  WITH CHECK (has_permission('manage_admins'));

CREATE POLICY "read role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "only super admin manages role permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (has_permission('manage_admins'))
  WITH CHECK (has_permission('manage_admins'));

CREATE POLICY "users read their own roles"
  ON user_role_links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "only super admin assigns roles"
  ON user_role_links FOR ALL
  TO authenticated
  USING (has_permission('manage_admins'))
  WITH CHECK (has_permission('manage_admins'));

-- ============================================================================
-- PART 2: CORE TABLES
-- ============================================================================

-- SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_is_current ON sessions(is_current);

-- TERMS TABLE
CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terms_session ON terms(session_id);
CREATE INDEX IF NOT EXISTS idx_terms_is_current ON terms(is_current);

-- TEACHERS TABLE
CREATE TABLE IF NOT EXISTS teachers (
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

CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);

-- CLASSES TABLE
CREATE TABLE IF NOT EXISTS classes (
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

CREATE INDEX IF NOT EXISTS idx_classes_education_level ON classes(education_level);
CREATE INDEX IF NOT EXISTS idx_classes_department ON classes(department);
CREATE INDEX IF NOT EXISTS idx_classes_session ON classes(session_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(class_teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_class_per_level_stream ON classes (education_level, level, COALESCE(stream, ''));

-- SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS subjects (
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

CREATE INDEX IF NOT EXISTS idx_subjects_education_level ON subjects(education_level);
CREATE INDEX IF NOT EXISTS idx_subjects_department ON subjects(department);
CREATE INDEX IF NOT EXISTS idx_subjects_religion ON subjects(religion);
CREATE UNIQUE INDEX IF NOT EXISTS unique_subject_per_level_department ON subjects (name, education_level, COALESCE(department, ''), COALESCE(religion, ''));

-- STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
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

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_religion ON students(religion);

-- SUBJECT_CLASSES JUNCTION TABLE
CREATE TABLE IF NOT EXISTS subject_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_code text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_classes_subject ON subject_classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_teacher ON subject_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_class ON subject_classes(class_id);

-- STUDENT_SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  subject_class_id uuid REFERENCES subject_classes(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject_class_id)
);

CREATE INDEX IF NOT EXISTS idx_student_subjects_subject_class ON student_subjects(subject_class_id);

-- STUDENT_OPTIONAL_SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS student_optional_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_student_optional_subjects_student ON student_optional_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_optional_subjects_subject ON student_optional_subjects(subject_id);

-- SUBJECT_ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS subject_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subject_assignments_subject ON subject_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_assignments_teacher ON subject_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subject_assignments_class ON subject_assignments(class_id);

-- ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
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

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_term ON attendance(term_id);

-- ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS assignments (
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

CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_session ON assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_assignments_term ON assignments(term_id);

-- ASSIGNMENT_SUBMISSIONS TABLE
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
  graded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON assignment_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_graded_by ON assignment_submissions(graded_by);

-- SUBMISSIONS TABLE (legacy)
CREATE TABLE IF NOT EXISTS submissions (
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

CREATE INDEX IF NOT EXISTS idx_submissions_legacy_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_legacy_student ON submissions(student_id);

-- RESULTS TABLE
CREATE TABLE IF NOT EXISTS results (
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
  attendance integer DEFAULT 0,
  is_visible_to_parents boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint
  UNIQUE(student_id, subject_class_id, session_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_subject_class ON results(subject_class_id);
CREATE INDEX IF NOT EXISTS idx_results_term ON results(term_id);
CREATE INDEX IF NOT EXISTS idx_results_session ON results(session_id);

-- ADMISSIONS TABLE
CREATE TABLE IF NOT EXISTS admissions (
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

CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);

-- EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
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

CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- NEWS TABLE
CREATE TABLE IF NOT EXISTS news (
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

CREATE INDEX IF NOT EXISTS idx_news_published ON news(published);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);

-- TESTIMONIALS TABLE
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text DEFAULT 'alumni',
  content text NOT NULL,
  photo_url text DEFAULT '',
  year text DEFAULT '',
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_published ON testimonials(published);

-- NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- SCHOOL_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_settings_key ON school_settings(key);

-- PERIOD_SLOTS TABLE
CREATE TABLE IF NOT EXISTS period_slots (
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
  
  CONSTRAINT unique_day_period UNIQUE (day_of_week, period_number),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_period_slots_day ON period_slots(day_of_week);
CREATE INDEX IF NOT EXISTS idx_period_slots_day_period ON period_slots(day_of_week, period_number);

-- TIMETABLE_ENTRIES TABLE
CREATE TABLE IF NOT EXISTS timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_slot_id uuid NOT NULL REFERENCES period_slots(id) ON DELETE CASCADE,
  subject_class_id uuid REFERENCES subject_classes(id) ON DELETE SET NULL,
  department text,
  religion text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timetable_entries_class_id ON timetable_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_period_slot_id ON timetable_entries(period_slot_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_subject_class_id ON timetable_entries(subject_class_id);

-- ============================================================================
-- PART 3: PARENT PORTAL
-- ============================================================================

-- PARENTS TABLE
CREATE TABLE IF NOT EXISTS parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  is_active boolean DEFAULT false,
  activation_token_hash text,
  activation_expires_at timestamptz,
  activation_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parents_email ON parents(email);
CREATE INDEX IF NOT EXISTS idx_parents_user_id ON parents(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_activation_token ON parents(activation_token_hash);

-- ============================================================================
-- PART 4: RESULTS PUBLICATION CONTROL
-- ============================================================================

-- RESULTS_PUBLICATION TABLE
CREATE TABLE IF NOT EXISTS results_publication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  
  -- Component visibility flags
  welcome_test_published boolean DEFAULT false,
  mid_term_test_published boolean DEFAULT false,
  vetting_published boolean DEFAULT false,
  exam_published boolean DEFAULT false,
  
  -- Publication metadata
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  is_published boolean DEFAULT false,
  is_published_to_parents boolean DEFAULT false,
  
  -- Track which calculation mode to use for grades/positions when published
  calculation_mode text DEFAULT 'all' CHECK (calculation_mode IN ('welcome_only', 'welcome_midterm', 'welcome_midterm_vetting', 'all')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(class_id, session_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_results_publication_class_session_term ON results_publication(class_id, session_id, term_id);

-- ============================================================================
-- PART 5: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Calculate result totals and grades
CREATE OR REPLACE FUNCTION calculate_result_totals()
RETURNS TRIGGER AS $$
DECLARE
  calculated_total numeric;
  calculated_grade text;
  calculated_remark text;
BEGIN
  calculated_total := COALESCE(NEW.welcome_test, 0) +
                      COALESCE(NEW.mid_term_test, 0) +
                      COALESCE(NEW.vetting, 0) +
                      COALESCE(NEW.exam, 0);
  
  NEW.total := calculated_total;
  
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

-- Check submission on time
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

-- Link class to subjects (auto-linking)
CREATE OR REPLACE FUNCTION link_class_to_subjects()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM subject_classes WHERE class_id = NEW.id;
  
  INSERT INTO subject_classes (subject_id, class_id)
  SELECT s.id, NEW.id
  FROM subjects s
  WHERE s.education_level = NEW.education_level
    AND s.religion IS NULL
  ON CONFLICT (subject_id, class_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_link_class_to_subjects ON classes;
CREATE TRIGGER trigger_link_class_to_subjects
  AFTER INSERT OR UPDATE OF education_level, department ON classes
  FOR EACH ROW
  EXECUTE FUNCTION link_class_to_subjects();

-- Update results_publication timestamp
CREATE OR REPLACE FUNCTION update_results_publication_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_results_publication_timestamp ON results_publication;
CREATE TRIGGER update_results_publication_timestamp
  BEFORE UPDATE ON results_publication
  FOR EACH ROW
  EXECUTE FUNCTION update_results_publication_timestamp();

-- Get student subjects (including optional and religion)
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
      s.is_optional = false
      OR (s.is_optional = true AND EXISTS (
        SELECT 1
        FROM student_optional_subjects sos
        WHERE sos.student_id = student_uuid
          AND sos.subject_id = s.id
      ))
      OR (s.religion IS NOT NULL AND s.religion = st.religion)
    )
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- Get student position
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
  SELECT SUM(r.total)
  INTO student_total
  FROM results r
  WHERE r.student_id = p_student_id
    AND r.term_id = p_term_id;
  
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
-- PART 6: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_optional_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE results_publication ENABLE ROW LEVEL SECURITY;

-- SESSIONS
CREATE POLICY "Authenticated users can read sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- TERMS
CREATE POLICY "Authenticated users can read terms"
  ON terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage terms"
  ON terms FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- TEACHERS
CREATE POLICY "Authenticated users can read teachers"
  ON teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage teachers"
  ON teachers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- CLASSES
CREATE POLICY "Authenticated users can read classes"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage classes"
  ON classes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- SUBJECTS
CREATE POLICY "Authenticated users can read subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage subjects"
  ON subjects FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- STUDENTS
CREATE POLICY "Authenticated users can read students"
  ON students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage students"
  ON students FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- SUBJECT_CLASSES
CREATE POLICY "Authenticated users can read subject_classes"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage subject_classes"
  ON subject_classes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- SUBJECT_ASSIGNMENTS
CREATE POLICY "Authenticated users can read subject_assignments"
  ON subject_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage subject_assignments"
  ON subject_assignments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ATTENDANCE
CREATE POLICY "Authenticated users can read attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage attendance"
  ON attendance FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ASSIGNMENTS
CREATE POLICY "Authenticated users can read assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage assignments"
  ON assignments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ASSIGNMENT_SUBMISSIONS
CREATE POLICY "Authenticated users can read assignment_submissions"
  ON assignment_submissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage assignment_submissions"
  ON assignment_submissions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- SUBMISSIONS (legacy)
CREATE POLICY "Authenticated users can read submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage submissions"
  ON submissions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RESULTS
CREATE POLICY "Authenticated users can read results"
  ON results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage results"
  ON results FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- STUDENT_SUBJECTS
CREATE POLICY "Authenticated users can read student_subjects"
  ON student_subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage student_subjects"
  ON student_subjects FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ADMISSIONS
CREATE POLICY "Authenticated users can read admissions"
  ON admissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage admissions"
  ON admissions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- EVENTS
CREATE POLICY "Authenticated users can read events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage events"
  ON events FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- NEWS
CREATE POLICY "Authenticated users can read news"
  ON news FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage news"
  ON news FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- TESTIMONIALS
CREATE POLICY "Authenticated users can read testimonials"
  ON testimonials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- NOTIFICATIONS
CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- SCHOOL_SETTINGS
CREATE POLICY "Authenticated users can read school_settings"
  ON school_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage school_settings"
  ON school_settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- PERIOD_SLOTS
CREATE POLICY "Authenticated users can read period_slots"
  ON period_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage period_slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- STUDENT_OPTIONAL_SUBJECTS
CREATE POLICY "Authenticated users can read student_optional_subjects"
  ON student_optional_subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage student_optional_subjects"
  ON student_optional_subjects FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- TIMETABLE_ENTRIES
CREATE POLICY "Authenticated users can read timetable_entries"
  ON timetable_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage timetable_entries"
  ON timetable_entries FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- PARENTS
CREATE POLICY "Parents can read own data"
  ON parents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Parents can update own data"
  ON parents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage parents"
  ON parents FOR ALL
  USING (is_admin());

CREATE POLICY "Service role can insert parents"
  ON parents FOR INSERT
  WITH CHECK (true);

-- Parent access to student data
CREATE POLICY "Parents can view their children"
  ON students FOR SELECT
  USING (
    parent_email IN (
      SELECT email FROM parents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can view children attendance"
  ON attendance FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Parents can view children results"
  ON results FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Parents can view children assignments"
  ON assignments FOR SELECT
  USING (
    subject_id IN (
      SELECT sc.subject_id
      FROM student_subjects ss
      JOIN subject_classes sc ON sc.id = ss.subject_class_id
      WHERE ss.student_id IN (
        SELECT id FROM students
        WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Parents can view children submissions"
  ON assignment_submissions FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Parents can view children timetable"
  ON timetable_entries FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Parents can view children teachers"
  ON teachers FOR SELECT
  USING (
    id IN (
      SELECT sc.teacher_id
      FROM timetable_entries te
      JOIN subject_classes sc ON sc.id = te.subject_class_id
      WHERE te.class_id IN (
        SELECT class_id FROM students
        WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Parents can view children subjects"
  ON student_subjects FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Parents can view children classes"
  ON classes FOR SELECT
  USING (
    id IN (
      SELECT class_id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Parents can view subjects"
  ON subjects FOR SELECT
  USING (
    id IN (
      SELECT sc.subject_id
      FROM student_subjects ss
      JOIN subject_classes sc ON sc.id = ss.subject_class_id
      WHERE ss.student_id IN (
        SELECT id FROM students
        WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
    )
  );

-- RESULTS_PUBLICATION
CREATE POLICY "Admins can manage results publication"
  ON results_publication FOR ALL
  USING (is_admin());

CREATE POLICY "Authenticated users can view publication settings"
  ON results_publication FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- PART 7: SEED DEFAULT PERIOD SLOTS
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
('Monday', 13, '15:25', '16:00', false),

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
('Tuesday', 13, '15:25', '16:00', false),

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
('Wednesday', 13, '15:25', '16:00', false),

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
('Thursday', 13, '15:25', '16:00', false),

('Friday', 1, '08:00', '08:30', false),
('Friday', 2, '08:30', '09:00', false),
('Friday', 3, '09:00', '09:30', false),
('Friday', 4, '09:30', '10:00', false),
('Friday', 5, '10:00', '10:30', false),
('Friday', 6, '10:30', '11:00', true),
('Friday', 7, '11:00', '11:45', false),
('Friday', 8, '11:45', '12:30', false)
ON CONFLICT (day_of_week, period_number) DO NOTHING;

-- ============================================================================
-- COMPLETION NOTICE
-- ============================================================================
-- ✅ Complete database schema created
-- ✅ Granular RBAC system with super_admin role
-- ✅ Parent portal functionality
-- ✅ Results publication control system
-- ✅ All RLS policies configured
-- ✅ Default period slots seeded
-- 
-- NEXT STEPS:
-- 1. Assign super_admin role to your admin user via user_role_links table
-- 2. Create sessions, teachers, classes, and subjects
-- 3. Configure additional roles and permissions as needed
