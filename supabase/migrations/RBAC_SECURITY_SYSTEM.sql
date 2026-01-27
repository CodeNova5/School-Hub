-- ============================================================================
-- ROLE-BASED ACCESS CONTROL (RBAC) SECURITY SYSTEM
-- ============================================================================
-- This migration adds proper role management and Row Level Security (RLS)
-- to prevent unauthorized access across the school management system.
-- ============================================================================

-- ============================================================================
-- PREREQUISITE: Ensure teachers and students have required columns
-- ============================================================================
-- Add user_id and activation columns to teachers if they don't exist
ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS activation_token_hash text,
ADD COLUMN IF NOT EXISTS activation_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS activation_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- Add user_id and activation columns to students if they don't exist
ALTER TABLE students
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS activation_token_hash text,
ADD COLUMN IF NOT EXISTS activation_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS activation_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- ============================================================================
-- 1. CREATE USER ROLES TABLE
-- ============================================================================
-- Stores all user roles and permissions
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'class_teacher', 'subject_teacher', 'student', 'parent')),
  
  -- Optional: Link to specific teacher/student record
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  
  -- For class teachers: which class they manage
  managed_class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_teacher_id ON user_roles(teacher_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_student_id ON user_roles(student_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_managed_class ON user_roles(managed_class_id);

-- Create unique index with COALESCE to handle NULL values properly
-- This prevents duplicate role assignments for the same user/teacher/student/class combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique_combination
ON user_roles (
  user_id, 
  role, 
  COALESCE(teacher_id::text, ''), 
  COALESCE(student_id::text, ''), 
  COALESCE(managed_class_id::text, '')
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

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

-- ============================================================================
-- 2. HELPER FUNCTIONS FOR ROLE CHECKING
-- ============================================================================

-- Check if current user has a specific role
CREATE OR REPLACE FUNCTION has_role(check_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = check_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is a class teacher
CREATE OR REPLACE FUNCTION is_class_teacher()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('class_teacher');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is a subject teacher
CREATE OR REPLACE FUNCTION is_subject_teacher()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('subject_teacher');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is a teacher (class or subject)
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('class_teacher') OR has_role('subject_teacher');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is a student
CREATE OR REPLACE FUNCTION is_student()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('student');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's teacher ID
CREATE OR REPLACE FUNCTION get_current_teacher_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT teacher_id FROM user_roles
    WHERE user_id = auth.uid()
    AND teacher_id IS NOT NULL
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's student ID
CREATE OR REPLACE FUNCTION get_current_student_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT student_id FROM user_roles
    WHERE user_id = auth.uid()
    AND student_id IS NOT NULL
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user manages a specific class (as class teacher)
CREATE OR REPLACE FUNCTION manages_class(check_class_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'class_teacher'
    AND managed_class_id = check_class_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user teaches a specific subject class
CREATE OR REPLACE FUNCTION teaches_subject_class(check_subject_class_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subject_classes sc
    JOIN user_roles ur ON ur.teacher_id = sc.teacher_id
    WHERE ur.user_id = auth.uid()
    AND sc.id = check_subject_class_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. UPDATE RLS POLICIES FOR ALL TABLES
-- ============================================================================

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can manage sessions" ON sessions;

CREATE POLICY "Authenticated users can read sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- TERMS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read terms" ON terms;
DROP POLICY IF EXISTS "Admins can manage terms" ON terms;

CREATE POLICY "Authenticated users can read terms"
  ON terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage terms"
  ON terms FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- TEACHERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read teachers" ON teachers;
DROP POLICY IF EXISTS "Admins can manage teachers" ON teachers;

CREATE POLICY "Authenticated users can read teachers"
  ON teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can update their own profile"
  ON teachers FOR UPDATE
  TO authenticated
  USING (id = get_current_teacher_id())
  WITH CHECK (id = get_current_teacher_id());

CREATE POLICY "Only admins can insert/delete teachers"
  ON teachers FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can delete teachers"
  ON teachers FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- CLASSES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read classes" ON classes;
DROP POLICY IF EXISTS "Admins can manage classes" ON classes;

CREATE POLICY "Authenticated users can read classes"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage classes"
  ON classes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- SUBJECTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON subjects;

CREATE POLICY "Authenticated users can read subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage subjects"
  ON subjects FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- STUDENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read students" ON students;
DROP POLICY IF EXISTS "Admins can manage students" ON students;

CREATE POLICY "Authenticated users can read students"
  ON students FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    is_teacher() OR 
    id = get_current_student_id()
  );

CREATE POLICY "Students can update their own profile"
  ON students FOR UPDATE
  TO authenticated
  USING (id = get_current_student_id())
  WITH CHECK (id = get_current_student_id());

CREATE POLICY "Admins and class teachers can manage students"
  ON students FOR ALL
  TO authenticated
  USING (
    is_admin() OR 
    manages_class(class_id)
  )
  WITH CHECK (
    is_admin() OR 
    manages_class(class_id)
  );

-- ============================================================================
-- SUBJECT_CLASSES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read subject_classes" ON subject_classes;
DROP POLICY IF EXISTS "Admins can manage subject_classes" ON subject_classes;

CREATE POLICY "Authenticated users can read subject_classes"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage subject_classes"
  ON subject_classes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- SUBJECT_ASSIGNMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read subject_assignments" ON subject_assignments;
DROP POLICY IF EXISTS "Admins can manage subject_assignments" ON subject_assignments;

CREATE POLICY "Authenticated users can read subject_assignments"
  ON subject_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage subject_assignments"
  ON subject_assignments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- ATTENDANCE TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read attendance" ON attendance;
DROP POLICY IF EXISTS "Teachers can manage attendance" ON attendance;

CREATE POLICY "Teachers and students can read attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    is_teacher() OR
    student_id = get_current_student_id()
  );

CREATE POLICY "Teachers can manage attendance for their classes"
  ON attendance FOR ALL
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = attendance.student_id
      AND (
        manages_class(s.class_id) OR
        EXISTS (
          SELECT 1 FROM subject_classes sc
          JOIN user_roles ur ON ur.teacher_id = sc.teacher_id
          WHERE ur.user_id = auth.uid()
          AND sc.class_id = s.class_id
        )
      )
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = attendance.student_id
      AND (
        manages_class(s.class_id) OR
        EXISTS (
          SELECT 1 FROM subject_classes sc
          JOIN user_roles ur ON ur.teacher_id = sc.teacher_id
          WHERE ur.user_id = auth.uid()
          AND sc.class_id = s.class_id
        )
      )
    )
  );

-- ============================================================================
-- ASSIGNMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can manage assignments" ON assignments;

CREATE POLICY "Students and teachers can read assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    is_teacher() OR
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = get_current_student_id()
      AND s.class_id = assignments.class_id
    )
  );

CREATE POLICY "Teachers can manage their own assignments"
  ON assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR
    teacher_id = get_current_teacher_id()
  );

CREATE POLICY "Teachers can update their own assignments"
  ON assignments FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR
    teacher_id = get_current_teacher_id()
  )
  WITH CHECK (
    is_admin() OR
    teacher_id = get_current_teacher_id()
  );

CREATE POLICY "Teachers can delete their own assignments"
  ON assignments FOR DELETE
  TO authenticated
  USING (
    is_admin() OR
    teacher_id = get_current_teacher_id()
  );

-- ============================================================================
-- ASSIGNMENT_SUBMISSIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Teachers can manage submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Teachers can grade submissions" ON assignment_submissions;

CREATE POLICY "Teachers and students can read submissions"
  ON assignment_submissions FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    student_id = get_current_student_id() OR
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
      AND a.teacher_id = get_current_teacher_id()
    )
  );

CREATE POLICY "Students can submit their own assignments"
  ON assignment_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = get_current_student_id()
  );

CREATE POLICY "Students can update their own pending submissions"
  ON assignment_submissions FOR UPDATE
  TO authenticated
  USING (
    student_id = get_current_student_id() AND
    graded_at IS NULL
  )
  WITH CHECK (
    student_id = get_current_student_id() AND
    graded_at IS NULL
  );

CREATE POLICY "Teachers can grade submissions"
  ON assignment_submissions FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
      AND a.teacher_id = get_current_teacher_id()
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
      AND a.teacher_id = get_current_teacher_id()
    )
  );

-- ============================================================================
-- SUBMISSIONS TABLE (legacy)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read submissions" ON submissions;
DROP POLICY IF EXISTS "Users can manage submissions" ON submissions;

CREATE POLICY "Users can read relevant submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    student_id = get_current_student_id() OR
    is_teacher()
  );

CREATE POLICY "Students can manage their submissions"
  ON submissions FOR ALL
  TO authenticated
  USING (
    is_admin() OR
    student_id = get_current_student_id()
  )
  WITH CHECK (
    is_admin() OR
    student_id = get_current_student_id()
  );

-- ============================================================================
-- RESULTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read results" ON results;
DROP POLICY IF EXISTS "Teachers can manage results" ON results;

CREATE POLICY "Students and teachers can read results"
  ON results FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    student_id = get_current_student_id() OR
    is_teacher()
  );

CREATE POLICY "Teachers can enter results for their subject classes"
  ON results FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR
    teaches_subject_class(subject_class_id) OR
    EXISTS (
      SELECT 1 FROM students s
      JOIN subject_classes sc ON sc.class_id = s.class_id
      WHERE s.id = results.student_id
      AND manages_class(s.class_id)
    )
  );

CREATE POLICY "Teachers can update results for their subject classes"
  ON results FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR
    teaches_subject_class(subject_class_id) OR
    EXISTS (
      SELECT 1 FROM students s
      JOIN subject_classes sc ON sc.class_id = s.class_id
      WHERE s.id = results.student_id
      AND manages_class(s.class_id)
    )
  )
  WITH CHECK (
    is_admin() OR
    teaches_subject_class(subject_class_id) OR
    EXISTS (
      SELECT 1 FROM students s
      JOIN subject_classes sc ON sc.class_id = s.class_id
      WHERE s.id = results.student_id
      AND manages_class(s.class_id)
    )
  );

CREATE POLICY "Only admins can delete results"
  ON results FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- STUDENT_SUBJECTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read student_subjects" ON student_subjects;
DROP POLICY IF EXISTS "Teachers can manage student_subjects" ON student_subjects;

CREATE POLICY "Users can read student subjects"
  ON student_subjects FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    student_id = get_current_student_id() OR
    is_teacher()
  );

CREATE POLICY "Class teachers can manage student subjects"
  ON student_subjects FOR ALL
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_subjects.student_id
      AND manages_class(s.class_id)
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_subjects.student_id
      AND manages_class(s.class_id)
    )
  );

-- ============================================================================
-- ADMISSIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read admissions" ON admissions;
DROP POLICY IF EXISTS "Admins can manage admissions" ON admissions;

CREATE POLICY "Admins can read all admissions"
  ON admissions FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can manage admissions"
  ON admissions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read events" ON events;
DROP POLICY IF EXISTS "Admins can manage events" ON events;

CREATE POLICY "Authenticated users can read events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage events"
  ON events FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- NEWS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read news" ON news;
DROP POLICY IF EXISTS "Admins can manage news" ON news;

CREATE POLICY "Authenticated users can read news"
  ON news FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage news"
  ON news FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- TESTIMONIALS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can manage testimonials" ON testimonials;

CREATE POLICY "Authenticated users can read testimonials"
  ON testimonials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;

CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    user_id = auth.uid()
  );

CREATE POLICY "Only admins can manage notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- SCHOOL_SETTINGS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read school_settings" ON school_settings;
DROP POLICY IF EXISTS "Admins can manage school_settings" ON school_settings;

CREATE POLICY "Authenticated users can read school_settings"
  ON school_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage school_settings"
  ON school_settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- TIMETABLE TABLES (period_slots and timetable_entries)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view period slots" ON period_slots;
DROP POLICY IF EXISTS "Admins can insert period slots" ON period_slots;
DROP POLICY IF EXISTS "Admins can update period slots" ON period_slots;
DROP POLICY IF EXISTS "Admins can delete period slots" ON period_slots;

CREATE POLICY "Authenticated users can read period slots"
  ON period_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage period slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================================
-- STUDENT_OPTIONAL_SUBJECTS TABLE
-- ============================================================================
CREATE POLICY "Users can read student optional subjects"
  ON student_optional_subjects FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    student_id = get_current_student_id() OR
    is_teacher()
  );

CREATE POLICY "Class teachers and admins can manage optional subjects"
  ON student_optional_subjects FOR ALL
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_optional_subjects.student_id
      AND manages_class(s.class_id)
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_optional_subjects.student_id
      AND manages_class(s.class_id)
    )
  );

-- Enable RLS on student_optional_subjects if not already enabled
ALTER TABLE student_optional_subjects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE ADMIN SETUP FUNCTION
-- ============================================================================
-- This function should be called once to set up the first admin user

CREATE OR REPLACE FUNCTION setup_admin_user(admin_email text)
RETURNS void AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the user ID from email
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', admin_email;
  END IF;

  -- Insert admin role
  INSERT INTO user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Admin role assigned to user %', admin_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. TRIGGER TO AUTO-CREATE STUDENT ROLE
-- ============================================================================
-- When a student is activated, automatically create their user role

CREATE OR REPLACE FUNCTION auto_create_student_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true AND NEW.user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, student_id)
    VALUES (NEW.user_id, 'student', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_student_role ON students;
CREATE TRIGGER trigger_auto_create_student_role
  AFTER INSERT OR UPDATE OF is_active, user_id ON students
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_student_role();

-- ============================================================================
-- 6. TRIGGER TO AUTO-CREATE TEACHER ROLE
-- ============================================================================
-- When a teacher is activated, automatically create their user role

CREATE OR REPLACE FUNCTION auto_create_teacher_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true AND NEW.user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, teacher_id)
    VALUES (NEW.user_id, 'subject_teacher', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_teacher_role ON teachers;
CREATE TRIGGER trigger_auto_create_teacher_role
  AFTER INSERT OR UPDATE OF is_active, user_id ON teachers
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_teacher_role();

-- ============================================================================
-- DONE! RBAC SYSTEM DEPLOYED
-- ============================================================================
-- Next steps:
-- 1. Run: SELECT setup_admin_user('admin@yourschool.com');
-- 2. Assign class teachers: INSERT INTO user_roles (user_id, role, teacher_id, managed_class_id) VALUES (...);
-- 3. Teachers and students will auto-get roles when activated
-- ============================================================================

COMMENT ON TABLE user_roles IS 'Stores user roles and permissions for RBAC';
COMMENT ON FUNCTION is_admin() IS 'Check if current user is an admin';
COMMENT ON FUNCTION is_teacher() IS 'Check if current user is a teacher (class or subject)';
COMMENT ON FUNCTION manages_class(uuid) IS 'Check if current user manages a specific class';
COMMENT ON FUNCTION teaches_subject_class(uuid) IS 'Check if current user teaches a specific subject class';
