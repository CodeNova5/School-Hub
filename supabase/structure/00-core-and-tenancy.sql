-- =============================================================================
-- Core And Tenancy Structure (SQL)
-- Source: supabase/structure/00-core-and-tenancy.md
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared timestamp helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE,
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, session_id, name)
);

CREATE TABLE IF NOT EXISTS school_education_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text DEFAULT '',
  order_sequence integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS school_class_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  education_level_id uuid NOT NULL REFERENCES school_education_levels(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  order_sequence integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, education_level_id, name)
);

CREATE TABLE IF NOT EXISTS school_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS school_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS school_religions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS school_level_subject_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  education_level_id uuid NOT NULL REFERENCES school_education_levels(id) ON DELETE CASCADE,
  department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  name text NOT NULL,
  is_optional boolean NOT NULL DEFAULT false,
  order_sequence integer NOT NULL DEFAULT 1 CHECK (order_sequence > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, education_level_id, name)
);

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text DEFAULT '',
  status text DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, staff_id)
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  class_level_id uuid NOT NULL REFERENCES school_class_levels(id) ON DELETE RESTRICT,
  stream_id uuid REFERENCES school_streams(id) ON DELETE SET NULL,
  department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  class_teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_level_id, stream_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject_code text,
  education_level_id uuid REFERENCES school_education_levels(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  is_optional boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  student_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  status text DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id)
);

CREATE TABLE IF NOT EXISTS parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email text,
  name text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS period_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  period_number integer,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_break boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT period_slots_break_number_rule CHECK (
    (is_break = true AND period_number IS NULL)
    OR (is_break = false AND period_number BETWEEN 1 AND 20)
  ),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_slot_id uuid NOT NULL REFERENCES period_slots(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_id, period_slot_id)
);

CREATE TABLE IF NOT EXISTS notification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_type text DEFAULT 'web',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name text NOT NULL,
  email text UNIQUE,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sessions_school_id ON sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_terms_school_id ON terms(school_id);
CREATE INDEX IF NOT EXISTS idx_terms_session_id ON terms(session_id);
CREATE INDEX IF NOT EXISTS idx_school_class_levels_school_id ON school_class_levels(school_id);
CREATE INDEX IF NOT EXISTS idx_school_class_levels_education_level_id ON school_class_levels(education_level_id);
CREATE INDEX IF NOT EXISTS idx_school_level_subject_presets_school_id ON school_level_subject_presets(school_id);
CREATE INDEX IF NOT EXISTS idx_school_level_subject_presets_level_id ON school_level_subject_presets(education_level_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_school_id ON parents(school_id);
CREATE INDEX IF NOT EXISTS idx_parents_user_id ON parents(user_id);
CREATE INDEX IF NOT EXISTS idx_period_slots_school_id ON period_slots(school_id);
CREATE INDEX IF NOT EXISTS idx_period_slots_school_day_start ON period_slots(school_id, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_school_id ON timetable_entries(school_id);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_school_id ON notification_tokens(school_id);
CREATE INDEX IF NOT EXISTS idx_admins_school_id ON admins(school_id);
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_period_slot_per_school
  ON period_slots (school_id, day_of_week, period_number)
  WHERE is_break = false;

-- -----------------------------------------------------------------------------
-- Triggers for updated_at
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_schools_updated_at ON schools;
CREATE TRIGGER set_schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_sessions_updated_at ON sessions;
CREATE TRIGGER set_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_terms_updated_at ON terms;
CREATE TRIGGER set_terms_updated_at BEFORE UPDATE ON terms FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_school_education_levels_updated_at ON school_education_levels;
CREATE TRIGGER set_school_education_levels_updated_at BEFORE UPDATE ON school_education_levels FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_school_class_levels_updated_at ON school_class_levels;
CREATE TRIGGER set_school_class_levels_updated_at BEFORE UPDATE ON school_class_levels FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_school_streams_updated_at ON school_streams;
CREATE TRIGGER set_school_streams_updated_at BEFORE UPDATE ON school_streams FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_school_departments_updated_at ON school_departments;
CREATE TRIGGER set_school_departments_updated_at BEFORE UPDATE ON school_departments FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_school_religions_updated_at ON school_religions;
CREATE TRIGGER set_school_religions_updated_at BEFORE UPDATE ON school_religions FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_school_level_subject_presets_updated_at ON school_level_subject_presets;
CREATE TRIGGER set_school_level_subject_presets_updated_at BEFORE UPDATE ON school_level_subject_presets FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_teachers_updated_at ON teachers;
CREATE TRIGGER set_teachers_updated_at BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_classes_updated_at ON classes;
CREATE TRIGGER set_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_subjects_updated_at ON subjects;
CREATE TRIGGER set_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_students_updated_at ON students;
CREATE TRIGGER set_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_parents_updated_at ON parents;
CREATE TRIGGER set_parents_updated_at BEFORE UPDATE ON parents FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_period_slots_updated_at ON period_slots;
CREATE TRIGGER set_period_slots_updated_at BEFORE UPDATE ON period_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_timetable_entries_updated_at ON timetable_entries;
CREATE TRIGGER set_timetable_entries_updated_at BEFORE UPDATE ON timetable_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_notification_tokens_updated_at ON notification_tokens;
CREATE TRIGGER set_notification_tokens_updated_at BEFORE UPDATE ON notification_tokens FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_admins_updated_at ON admins;
CREATE TRIGGER set_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- -----------------------------------------------------------------------------
-- Shared functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF to_regclass('public.user_role_links') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM user_role_links ul
      JOIN roles r ON r.id = ul.role_id
      WHERE ul.user_id = auth.uid()
        AND r.name = 'super_admin'
        AND ul.school_id IS NULL
    );
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF to_regclass('public.admins') IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM admins
    WHERE user_id = auth.uid()
      AND is_active = true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result uuid;
BEGIN
  SELECT school_id INTO result FROM admins WHERE user_id = auth.uid() LIMIT 1;
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  IF to_regclass('public.user_role_links') IS NOT NULL THEN
    SELECT school_id INTO result
    FROM user_role_links
    WHERE user_id = auth.uid() AND school_id IS NOT NULL
    LIMIT 1;

    IF result IS NOT NULL THEN
      RETURN result;
    END IF;
  END IF;

  SELECT school_id INTO result FROM students WHERE user_id = auth.uid() LIMIT 1;
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  SELECT school_id INTO result FROM teachers WHERE user_id = auth.uid() LIMIT 1;
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  SELECT school_id INTO result FROM parents WHERE user_id = auth.uid() LIMIT 1;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION can_access_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT is_super_admin();
$$;

CREATE OR REPLACE FUNCTION search_users_by_email(search_email text)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role text,
  school_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT a.user_id, a.email, a.name, 'admin'::text, a.school_id
  FROM admins a
  WHERE a.email ILIKE ('%' || search_email || '%')

  UNION ALL

  SELECT t.user_id, COALESCE(t.email, ''), CONCAT(t.first_name, ' ', t.last_name), 'teacher'::text, t.school_id
  FROM teachers t
  WHERE COALESCE(t.email, '') ILIKE ('%' || search_email || '%')

  UNION ALL

  SELECT s.user_id, COALESCE(s.email, ''), CONCAT(s.first_name, ' ', s.last_name), 'student'::text, s.school_id
  FROM students s
  WHERE COALESCE(s.email, '') ILIKE ('%' || search_email || '%')

  UNION ALL

  SELECT p.user_id, COALESCE(p.email, ''), p.name, 'parent'::text, p.school_id
  FROM parents p
  WHERE COALESCE(p.email, '') ILIKE ('%' || search_email || '%');
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_education_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_class_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_religions ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_level_subject_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Schools super admin manage" ON schools;
CREATE POLICY "Schools super admin manage"
  ON schools FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Admins table super admin or self read" ON admins;
CREATE POLICY "Admins table super admin or self read"
  ON admins FOR SELECT
  TO authenticated
  USING (is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins table super admin manage" ON admins;
CREATE POLICY "Admins table super admin manage"
  ON admins FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Sessions school read" ON sessions;
CREATE POLICY "Sessions school read"
  ON sessions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Sessions admin manage" ON sessions;
CREATE POLICY "Sessions admin manage"
  ON sessions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Terms school read" ON terms;
CREATE POLICY "Terms school read"
  ON terms FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Terms admin manage" ON terms;
CREATE POLICY "Terms admin manage"
  ON terms FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read level subject presets" ON school_level_subject_presets;
CREATE POLICY "School users can read level subject presets"
  ON school_level_subject_presets FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage level subject presets" ON school_level_subject_presets;
CREATE POLICY "Admins can manage level subject presets"
  ON school_level_subject_presets FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Teachers school read" ON teachers;
CREATE POLICY "Teachers school read"
  ON teachers FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Teachers admin manage" ON teachers;
CREATE POLICY "Teachers admin manage"
  ON teachers FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Classes school read" ON classes;
CREATE POLICY "Classes school read"
  ON classes FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Classes admin manage" ON classes;
CREATE POLICY "Classes admin manage"
  ON classes FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Subjects school read" ON subjects;
CREATE POLICY "Subjects school read"
  ON subjects FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Subjects admin manage" ON subjects;
CREATE POLICY "Subjects admin manage"
  ON subjects FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Students school read" ON students;
CREATE POLICY "Students school read"
  ON students FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Students admin manage" ON students;
CREATE POLICY "Students admin manage"
  ON students FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Parents school read" ON parents;
CREATE POLICY "Parents school read"
  ON parents FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Parents admin manage" ON parents;
CREATE POLICY "Parents admin manage"
  ON parents FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Period slots school read" ON period_slots;
CREATE POLICY "Period slots school read"
  ON period_slots FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Period slots admin manage" ON period_slots;
CREATE POLICY "Period slots admin manage"
  ON period_slots FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Timetable school read" ON timetable_entries;
CREATE POLICY "Timetable school read"
  ON timetable_entries FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Timetable admin manage" ON timetable_entries;
CREATE POLICY "Timetable admin manage"
  ON timetable_entries FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School config school read" ON school_education_levels;
CREATE POLICY "School config school read"
  ON school_education_levels FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "School config admin manage" ON school_education_levels;
CREATE POLICY "School config admin manage"
  ON school_education_levels FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Class levels school read" ON school_class_levels;
CREATE POLICY "Class levels school read"
  ON school_class_levels FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Class levels admin manage" ON school_class_levels;
CREATE POLICY "Class levels admin manage"
  ON school_class_levels FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Streams school read" ON school_streams;
CREATE POLICY "Streams school read"
  ON school_streams FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Streams admin manage" ON school_streams;
CREATE POLICY "Streams admin manage"
  ON school_streams FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Departments school read" ON school_departments;
CREATE POLICY "Departments school read"
  ON school_departments FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Departments admin manage" ON school_departments;
CREATE POLICY "Departments admin manage"
  ON school_departments FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Religions school read" ON school_religions;
CREATE POLICY "Religions school read"
  ON school_religions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Religions admin manage" ON school_religions;
CREATE POLICY "Religions admin manage"
  ON school_religions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Notification tokens own or school read" ON notification_tokens;
CREATE POLICY "Notification tokens own or school read"
  ON notification_tokens FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR user_id = auth.uid()
    OR school_id = get_my_school_id()
  );

DROP POLICY IF EXISTS "Notification tokens own write" ON notification_tokens;
CREATE POLICY "Notification tokens own write"
  ON notification_tokens FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
