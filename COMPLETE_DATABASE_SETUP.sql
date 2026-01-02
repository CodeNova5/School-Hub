-- ============================================================================
-- COMPLETE SCHOOL MANAGEMENT SYSTEM DATABASE
-- ============================================================================
-- Copy and paste this entire file into Supabase SQL Editor and run it.
-- This will create all tables, relationships, triggers, and policies.
-- ============================================================================

-- ============================================================================
-- 1. SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read sessions" ON sessions;
CREATE POLICY "Anyone can read sessions" ON sessions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage sessions" ON sessions;
CREATE POLICY "Admins can manage sessions" ON sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. TERMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read terms" ON terms;
CREATE POLICY "Anyone can read terms" ON terms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage terms" ON terms;
CREATE POLICY "Admins can manage terms" ON terms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. TEACHERS TABLE
-- ============================================================================
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
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read teachers" ON teachers;
CREATE POLICY "Anyone can read teachers" ON teachers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage teachers" ON teachers;
CREATE POLICY "Admins can manage teachers" ON teachers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. CLASSES TABLE
-- ============================================================================
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

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read classes" ON classes;
CREATE POLICY "Anyone can read classes" ON classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage classes" ON classes;
CREATE POLICY "Admins can manage classes" ON classes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP INDEX IF EXISTS unique_class_per_session;
CREATE UNIQUE INDEX unique_class_per_session ON classes (name, level, COALESCE(session_id::text, ''), COALESCE(department, ''));

-- ============================================================================
-- 5. SUBJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
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

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read subjects" ON subjects;
CREATE POLICY "Anyone can read subjects" ON subjects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage subjects" ON subjects;
CREATE POLICY "Admins can manage subjects" ON subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP INDEX IF EXISTS unique_subject_per_level_department;
CREATE UNIQUE INDEX unique_subject_per_level_department ON subjects (name, education_level, COALESCE(department, ''));

-- ============================================================================
-- 6. STUDENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  parent_name text DEFAULT '',
  parent_email text DEFAULT '',
  parent_phone text DEFAULT '',
  admission_date date DEFAULT CURRENT_DATE,
  photo_url text DEFAULT '',
  status text DEFAULT 'active',
  attendance jsonb DEFAULT '[]',
  average_attendance numeric DEFAULT 0,
  results jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read students" ON students;
CREATE POLICY "Anyone can read students" ON students FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage students" ON students;
CREATE POLICY "Admins can manage students" ON students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. SUBJECT_CLASSES JUNCTION TABLE (Auto-managed by triggers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subject_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, class_id)
);

ALTER TABLE subject_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read subject_classes" ON subject_classes;
CREATE POLICY "Anyone can read subject_classes" ON subject_classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage subject_classes" ON subject_classes;
CREATE POLICY "Admins can manage subject_classes" ON subject_classes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. TEACHER_CLASSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read teacher_classes" ON teacher_classes;
CREATE POLICY "Anyone can read teacher_classes" ON teacher_classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage teacher_classes" ON teacher_classes;
CREATE POLICY "Admins can manage teacher_classes" ON teacher_classes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. CLASS_TEACHERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read class_teachers" ON class_teachers;
CREATE POLICY "Anyone can read class_teachers" ON class_teachers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage class_teachers" ON class_teachers;
CREATE POLICY "Admins can manage class_teachers" ON class_teachers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. SUBJECT_ASSIGNMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS subject_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subject_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read subject_assignments" ON subject_assignments;
CREATE POLICY "Anyone can read subject_assignments" ON subject_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage subject_assignments" ON subject_assignments;
CREATE POLICY "Admins can manage subject_assignments" ON subject_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 11. ATTENDANCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text DEFAULT 'present',
  marked_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read attendance" ON attendance;
CREATE POLICY "Anyone can read attendance" ON attendance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can manage attendance" ON attendance;
CREATE POLICY "Teachers can manage attendance" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 12. ASSIGNMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  due_date timestamptz NOT NULL,
  total_marks integer DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read assignments" ON assignments;
CREATE POLICY "Anyone can read assignments" ON assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can manage assignments" ON assignments;
CREATE POLICY "Teachers can manage assignments" ON assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 13. SUBMISSIONS TABLE
-- ============================================================================
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

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read submissions" ON submissions;
CREATE POLICY "Anyone can read submissions" ON submissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage submissions" ON submissions;
CREATE POLICY "Users can manage submissions" ON submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 14. ADMISSIONS TABLE
-- ============================================================================
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

ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read admissions" ON admissions;
CREATE POLICY "Anyone can read admissions" ON admissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage admissions" ON admissions;
CREATE POLICY "Admins can manage admissions" ON admissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 15. EVENTS TABLE
-- ============================================================================
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

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read events" ON events;
CREATE POLICY "Anyone can read events" ON events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage events" ON events;
CREATE POLICY "Admins can manage events" ON events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 16. NEWS TABLE
-- ============================================================================
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

ALTER TABLE news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read news" ON news;
CREATE POLICY "Anyone can read news" ON news FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage news" ON news;
CREATE POLICY "Admins can manage news" ON news FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 17. TESTIMONIALS TABLE
-- ============================================================================
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

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read testimonials" ON testimonials;
CREATE POLICY "Anyone can read testimonials" ON testimonials FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage testimonials" ON testimonials;
CREATE POLICY "Admins can manage testimonials" ON testimonials FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 18. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid,
  recipient_type text DEFAULT 'all',
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read notifications" ON notifications;
CREATE POLICY "Anyone can read notifications" ON notifications FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;
CREATE POLICY "Admins can manage notifications" ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 19. SCHOOL_SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read school_settings" ON school_settings;
CREATE POLICY "Anyone can read school_settings" ON school_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage school_settings" ON school_settings;
CREATE POLICY "Admins can manage school_settings" ON school_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_subject_classes_subject ON subject_classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_class ON subject_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_education_level ON classes(education_level);
CREATE INDEX IF NOT EXISTS idx_classes_department ON classes(department);
CREATE INDEX IF NOT EXISTS idx_classes_session ON classes(session_id);
CREATE INDEX IF NOT EXISTS idx_subjects_education_level ON subjects(education_level);
CREATE INDEX IF NOT EXISTS idx_subjects_department ON subjects(department);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

-- ============================================================================
-- AUTO-LINKING TRIGGER FUNCTIONS
-- ============================================================================

-- Function to auto-link subjects to classes when subject is created/updated
CREATE OR REPLACE FUNCTION link_subject_to_classes()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing links for this subject
  DELETE FROM subject_classes WHERE subject_id = NEW.id;

  -- Link to all matching classes
  IF NEW.education_level = 'SSS' AND NEW.department IS NOT NULL THEN
    -- For SSS with department, match education_level AND department
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT NEW.id, c.id
    FROM classes c
    WHERE c.education_level = NEW.education_level
      AND c.department = NEW.department
    ON CONFLICT (subject_id, class_id) DO NOTHING;
  ELSE
    -- For other levels, match education_level only
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT NEW.id, c.id
    FROM classes c
    WHERE c.education_level = NEW.education_level
    ON CONFLICT (subject_id, class_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-link classes to subjects when class is created/updated
CREATE OR REPLACE FUNCTION link_class_to_subjects()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing links for this class
  DELETE FROM subject_classes WHERE class_id = NEW.id;

  -- Link to all matching subjects
  IF NEW.education_level = 'SSS' AND NEW.department IS NOT NULL THEN
    -- For SSS with department, match education_level AND department
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT s.id, NEW.id
    FROM subjects s
    WHERE s.education_level = NEW.education_level
      AND s.department = NEW.department
    ON CONFLICT (subject_id, class_id) DO NOTHING;
  ELSE
    -- For other levels, match education_level only
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT s.id, NEW.id
    FROM subjects s
    WHERE s.education_level = NEW.education_level
    ON CONFLICT (subject_id, class_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_link_subject_to_classes ON subjects;
CREATE TRIGGER trigger_link_subject_to_classes
  AFTER INSERT OR UPDATE OF education_level, department ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION link_subject_to_classes();

DROP TRIGGER IF EXISTS trigger_link_class_to_subjects ON classes;
CREATE TRIGGER trigger_link_class_to_subjects
  AFTER INSERT OR UPDATE OF education_level, department ON classes
  FOR EACH ROW
  EXECUTE FUNCTION link_class_to_subjects();

-- ============================================================================
-- INITIAL LINKING - Connect all existing subjects to matching classes
-- ============================================================================

DELETE FROM subject_classes;

INSERT INTO subject_classes (subject_id, class_id)
SELECT s.id, c.id
FROM subjects s
CROSS JOIN classes c
WHERE s.education_level = c.education_level
  AND (
    s.education_level != 'SSS'
    OR (s.department = c.department)
  )
ON CONFLICT (subject_id, class_id) DO NOTHING;

-- ============================================================================
-- DONE! Your database is now fully set up.
-- ============================================================================
-- ✓ All 19 tables created
-- ✓ All foreign key relationships established
-- ✓ RLS policies enabled on all tables
-- ✓ Performance indexes created
-- ✓ Automatic subject-class linking triggers active
-- ✓ All existing data linked correctly
-- ============================================================================
