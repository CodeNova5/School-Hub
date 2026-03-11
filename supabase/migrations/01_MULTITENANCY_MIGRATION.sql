-- ============================================================================
-- MULTI-TENANCY MIGRATION
-- ============================================================================
-- This migration adds multi-school support to the existing School Hub system.
--
-- What it does:
--   1. Creates the `schools` table
--   2. Adds `school_id` to all core tables
--   3. Updates `user_role_links` to support per-school roles
--   4. Adds super_admin helpers (is_super_admin, get_my_school_id)
--   5. Adds can_access_super_admin() RPC for middleware
--   6. Adds JWT custom claims function (school_id + role in token)
--   7. Updates RLS policies to filter by school_id
--   8. Migrates all existing data to a default school
--
-- SAFETY: Run this on a NEW or BACKED-UP database only.
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE SCHOOLS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  subdomain   text UNIQUE,
  address     text DEFAULT '',
  phone       text DEFAULT '',
  email       text DEFAULT '',
  logo_url    text DEFAULT '',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage schools (policies set after helper fns below)

-- ============================================================================
-- STEP 2: ADD school_id TO ALL CORE TABLES
-- ============================================================================

-- Sessions
ALTER TABLE sessions     ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Terms (derived from sessions but kept explicit for fast RLS)
ALTER TABLE terms        ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Teachers
ALTER TABLE teachers     ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Classes
ALTER TABLE classes      ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Subjects
ALTER TABLE subjects     ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Students
ALTER TABLE students     ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Parents
ALTER TABLE parents      ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Attendance
ALTER TABLE attendance   ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Assignments
ALTER TABLE assignments  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Assignment Submissions
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Submissions (legacy)
ALTER TABLE submissions  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Results
ALTER TABLE results      ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Admissions
ALTER TABLE admissions   ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Events
ALTER TABLE events       ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- News
ALTER TABLE news         ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- School Settings (now properly per-school)
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Period Slots
ALTER TABLE period_slots ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Timetable Entries
ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Subject Classes
ALTER TABLE subject_classes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Subject Assignments
ALTER TABLE subject_assignments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Student Subjects
ALTER TABLE student_subjects ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Student Optional Subjects
ALTER TABLE student_optional_subjects ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Results Publication
ALTER TABLE results_publication ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Notification Tokens (keep global but add school for filtering)
ALTER TABLE notification_tokens ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 4: ADD school_id TO SCHOOL CONFIGURATION TABLES
--   These tables define configurable values per school:
--   - school_education_levels
--   - school_class_levels
--   - school_streams
--   - school_departments
--   - school_religions
-- ============================================================================

-- Add school_id to school_education_levels if not present
ALTER TABLE school_education_levels ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- Add school_id to school_class_levels if not present
ALTER TABLE school_class_levels ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- Add school_id to school_streams if not present
ALTER TABLE school_streams ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- Add school_id to school_departments if not present
ALTER TABLE school_departments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- Add school_id to school_religions if not present
ALTER TABLE school_religions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 5: DATA MIGRATION
--   Create a default school and assign all existing data to it.
--   After this, we enforce NOT NULL.
-- ============================================================================

-- Insert default school (idempotent)
INSERT INTO schools (id, name, subdomain, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default School', 'default', true)
ON CONFLICT (id) DO NOTHING;

-- Helper variable for migration
DO $$
DECLARE
  default_school_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Sessions
  UPDATE sessions     SET school_id = default_school_id WHERE school_id IS NULL;
  -- Terms
  UPDATE terms        SET school_id = default_school_id WHERE school_id IS NULL;
  -- Teachers
  UPDATE teachers     SET school_id = default_school_id WHERE school_id IS NULL;
  -- Classes
  UPDATE classes      SET school_id = default_school_id WHERE school_id IS NULL;
  -- Subjects
  UPDATE subjects     SET school_id = default_school_id WHERE school_id IS NULL;
  -- Students
  UPDATE students     SET school_id = default_school_id WHERE school_id IS NULL;
  -- Parents
  UPDATE parents      SET school_id = default_school_id WHERE school_id IS NULL;
  -- Attendance
  UPDATE attendance   SET school_id = default_school_id WHERE school_id IS NULL;
  -- Assignments
  UPDATE assignments  SET school_id = default_school_id WHERE school_id IS NULL;
  -- Assignment Submissions
  UPDATE assignment_submissions SET school_id = default_school_id WHERE school_id IS NULL;
  -- Submissions (legacy)
  UPDATE submissions  SET school_id = default_school_id WHERE school_id IS NULL;
  -- Results
  UPDATE results      SET school_id = default_school_id WHERE school_id IS NULL;
  -- Admissions
  UPDATE admissions   SET school_id = default_school_id WHERE school_id IS NULL;
  -- Events
  UPDATE events       SET school_id = default_school_id WHERE school_id IS NULL;
  -- News
  UPDATE news         SET school_id = default_school_id WHERE school_id IS NULL;
  -- School Settings
  UPDATE school_settings SET school_id = default_school_id WHERE school_id IS NULL;
  -- Period Slots
  UPDATE period_slots SET school_id = default_school_id WHERE school_id IS NULL;
  -- Timetable Entries
  UPDATE timetable_entries SET school_id = default_school_id WHERE school_id IS NULL;
  -- Subject Classes
  UPDATE subject_classes SET school_id = default_school_id WHERE school_id IS NULL;
  -- Subject Assignments
  UPDATE subject_assignments SET school_id = default_school_id WHERE school_id IS NULL;
  -- Student Subjects
  UPDATE student_subjects SET school_id = default_school_id WHERE school_id IS NULL;
  -- Student Optional Subjects
  UPDATE student_optional_subjects SET school_id = default_school_id WHERE school_id IS NULL;
  -- Results Publication
  UPDATE results_publication SET school_id = default_school_id WHERE school_id IS NULL;
  -- Notification Tokens (optional, not strict)
  UPDATE notification_tokens SET school_id = default_school_id WHERE school_id IS NULL;

  -- School Configuration Tables: Backfill school_id for all existing records
  UPDATE school_education_levels SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE school_class_levels SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE school_streams SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE school_departments SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE school_religions SET school_id = default_school_id WHERE school_id IS NULL;

  -- Assign all existing admin users' roles to default school
  -- (super_admin role links stay with school_id = NULL)
  UPDATE user_role_links
  SET school_id = default_school_id
  WHERE school_id IS NULL
    AND role_id NOT IN (SELECT id FROM roles WHERE name = 'super_admin');
END $$;

-- ============================================================================
-- STEP 6: ENFORCE NOT NULL on school_id (except user_role_links which allows NULL)
-- ============================================================================

-- Configuration tables: enforce NOT NULL on school_id
ALTER TABLE school_education_levels ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE school_class_levels ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE school_streams ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE school_departments ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE school_religions ALTER COLUMN school_id SET NOT NULL;

-- Core tables: enforce NOT NULL on school_id
ALTER TABLE sessions     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE terms        ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE teachers     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE classes      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE subjects     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE students     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE parents      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE attendance   ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE assignments  ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE results      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE admissions   ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE events       ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE news         ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE school_settings ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE period_slots ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE timetable_entries ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE subject_classes ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE results_publication ALTER COLUMN school_id SET NOT NULL;
-- Note: assignment_submissions, submissions, student_subjects,
-- student_optional_subjects, subject_assignments, notification_tokens
-- are left nullable as they derive context from their parent tables.

-- ============================================================================
-- STEP 7: UPDATE UNIQUE CONSTRAINTS TO BE PER-SCHOOL
-- ============================================================================

-- Classes: unique per school (not global)
DROP INDEX IF EXISTS unique_class_per_level_stream;
CREATE UNIQUE INDEX IF NOT EXISTS unique_class_per_level_stream_school
  ON classes (school_id, class_level_id, COALESCE(stream_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Subjects: unique per school
DROP INDEX IF EXISTS unique_subject_per_level_department;
CREATE UNIQUE INDEX IF NOT EXISTS unique_subject_per_level_department_school
  ON subjects (school_id, name, education_level_id, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(religion_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Teachers: staff_id unique per school (drop global unique, add composite)
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_staff_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS unique_teacher_staff_id_per_school
  ON teachers (school_id, staff_id);

-- Students: student_id unique per school (drop global unique, add composite)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_student_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS unique_student_id_per_school
  ON students (school_id, student_id);

-- School settings: key unique per school
ALTER TABLE school_settings DROP CONSTRAINT IF EXISTS school_settings_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS unique_school_settings_key_per_school
  ON school_settings (school_id, key);

-- Period slots: day/period unique per school
ALTER TABLE period_slots DROP CONSTRAINT IF EXISTS unique_day_period;
CREATE UNIQUE INDEX IF NOT EXISTS unique_period_slot_per_school
  ON period_slots (school_id, day_of_week, period_number);

-- Subject_classes: unique per school
ALTER TABLE subject_classes DROP CONSTRAINT IF EXISTS subject_classes_subject_id_class_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS unique_subject_class_per_school
  ON subject_classes (school_id, subject_id, class_id);

-- Results_publication: unique per school
ALTER TABLE results_publication DROP CONSTRAINT IF EXISTS results_publication_class_id_session_id_term_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS unique_results_pub_per_school
  ON results_publication (school_id, class_id, session_id, term_id);

-- ============================================================================
-- STEP 8: ADD INDEXES FOR school_id COLUMNS
-- ============================================================================

-- Configuration table indexes
CREATE INDEX IF NOT EXISTS idx_school_education_levels_school ON school_education_levels(school_id);
CREATE INDEX IF NOT EXISTS idx_school_class_levels_school ON school_class_levels(school_id);
CREATE INDEX IF NOT EXISTS idx_school_streams_school ON school_streams(school_id);
CREATE INDEX IF NOT EXISTS idx_school_departments_school ON school_departments(school_id);
CREATE INDEX IF NOT EXISTS idx_school_religions_school ON school_religions(school_id);

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_school     ON sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_terms_school         ON terms(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school      ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school       ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school      ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school      ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_parents_school       ON parents(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school    ON attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_school   ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_results_school       ON results(school_id);
CREATE INDEX IF NOT EXISTS idx_admissions_school    ON admissions(school_id);
CREATE INDEX IF NOT EXISTS idx_events_school        ON events(school_id);
CREATE INDEX IF NOT EXISTS idx_news_school          ON news(school_id);
CREATE INDEX IF NOT EXISTS idx_school_settings_school ON school_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_period_slots_school  ON period_slots(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_school ON timetable_entries(school_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_school ON subject_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_results_pub_school   ON results_publication(school_id);
CREATE INDEX IF NOT EXISTS idx_user_role_links_school ON user_role_links(school_id);

-- ============================================================================
-- STEP 9: HELPER FUNCTIONS (Super Admin + School Context)
-- ============================================================================

-- Check if the current user is a super_admin (platform-wide, no school restriction)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_role_links ul
    JOIN roles r ON r.id = ul.role_id
    WHERE ul.user_id = auth.uid()
      AND r.name = 'super_admin'
      AND ul.school_id IS NULL
  );
$$;

-- Get the school_id of the currently authenticated user.
-- Returns NULL for super_admin or if user has no school assignment.
-- Checks in order: admins → user_role_links → students → teachers → parents
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result uuid;
BEGIN
  -- Try to get from admins table first (for admins)
  SELECT school_id INTO result FROM admins WHERE user_id = auth.uid() LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Fallback to user_role_links (for explicit role assignments)
  SELECT school_id INTO result 
  FROM user_role_links 
  WHERE user_id = auth.uid() AND school_id IS NOT NULL 
  LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Check students table (students table always has school_id)
  SELECT school_id INTO result FROM students WHERE user_id = auth.uid() LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Check teachers table
  SELECT school_id INTO result FROM teachers WHERE user_id = auth.uid() LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Check parents table
  SELECT school_id INTO result FROM parents WHERE user_id = auth.uid() LIMIT 1;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Lookup school_id for a given user_id (used in API routes via service role)
CREATE OR REPLACE FUNCTION get_school_id_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result uuid;
BEGIN
  SELECT school_id INTO result FROM admins WHERE user_id = p_user_id LIMIT 1;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Simple is_admin: just check if user is in admins table and is_active
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid() AND is_active = true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Simple can_access_admin: check if user is an active admin
CREATE OR REPLACE FUNCTION can_access_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid() AND is_active = true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- New: check access to super_admin area (used by middleware)
CREATE OR REPLACE FUNCTION can_access_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT is_super_admin();
$$;

-- can_access_teacher: user is a teacher in some school
CREATE OR REPLACE FUNCTION can_access_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teachers WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- can_access_student: user is an active student
CREATE OR REPLACE FUNCTION can_access_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- can_access_parent: user is an active parent
CREATE OR REPLACE FUNCTION can_access_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM parents WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- ============================================================================
-- STEP 10: JWT CUSTOM CLAIMS (Simplified)
--   Add school_id and admin status to JWT token
-- ============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  claims       jsonb;
  user_school  uuid;
  user_is_admin boolean;
  v_user_id    uuid;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  claims    := event->'claims';

  -- Initialize defaults
  user_school := NULL;
  user_is_admin := false;

  -- Safely try to get admin status and school_id from admins table
  BEGIN
    SELECT school_id, is_active
    INTO user_school, user_is_admin
    FROM admins WHERE user_id = v_user_id LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Table might not exist yet or query fails - use defaults
    user_school := NULL;
    user_is_admin := false;
  END;

  -- Only merge if we have valid values
  IF user_school IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_metadata, school_id}',  to_jsonb(user_school));
    claims := jsonb_set(claims, '{app_metadata, school_id}',   to_jsonb(user_school));
  END IF;

  -- Always stamp is_admin status
  claims := jsonb_set(claims, '{user_metadata, is_admin}',   to_jsonb(user_is_admin));
  claims := jsonb_set(claims, '{app_metadata, is_admin}',    to_jsonb(user_is_admin));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon;

-- ============================================================================
-- STEP 11: GET SCHOOL BY SUBDOMAIN (used by middleware)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_school_by_subdomain(p_subdomain text)
RETURNS TABLE (id uuid, name text, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, name, is_active FROM schools WHERE subdomain = p_subdomain LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_school_by_subdomain TO anon, authenticated;

-- ============================================================================
-- STEP 12: ADD RLS POLICIES FOR SCHOOL CONFIGURATION TABLES
--   These tables are school-specific and need proper access control
-- ============================================================================

-- -------------------- SCHOOL_EDUCATION_LEVELS --------------------
DROP POLICY IF EXISTS "School users can read education levels" ON school_education_levels;
DROP POLICY IF EXISTS "Admins can manage education levels"      ON school_education_levels;

CREATE POLICY "School users can read education levels"
  ON school_education_levels FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage education levels"
  ON school_education_levels FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- SCHOOL_CLASS_LEVELS --------------------
DROP POLICY IF EXISTS "School users can read class levels" ON school_class_levels;
DROP POLICY IF EXISTS "Admins can manage class levels"      ON school_class_levels;

CREATE POLICY "School users can read class levels"
  ON school_class_levels FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage class levels"
  ON school_class_levels FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- SCHOOL_STREAMS --------------------
DROP POLICY IF EXISTS "School users can read streams" ON school_streams;
DROP POLICY IF EXISTS "Admins can manage streams"      ON school_streams;

CREATE POLICY "School users can read streams"
  ON school_streams FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage streams"
  ON school_streams FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- SCHOOL_DEPARTMENTS --------------------
DROP POLICY IF EXISTS "School users can read departments" ON school_departments;
DROP POLICY IF EXISTS "Admins can manage departments"      ON school_departments;

CREATE POLICY "School users can read departments"
  ON school_departments FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage departments"
  ON school_departments FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- SCHOOL_RELIGIONS --------------------
DROP POLICY IF EXISTS "School users can read religions" ON school_religions;
DROP POLICY IF EXISTS "Admins can manage religions"      ON school_religions;

CREATE POLICY "School users can read religions"
  ON school_religions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage religions"
  ON school_religions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- ============================================================================
-- STEP 13: UPDATE RLS POLICIES (Simplified)
--   Pattern: SELECT/ALL with simple school_id checks
-- ============================================================================

-- -------------------- SCHOOLS TABLE --------------------
DROP POLICY IF EXISTS "super admin reads schools"     ON schools;
DROP POLICY IF EXISTS "super admin manages schools"   ON schools;
DROP POLICY IF EXISTS "authenticated reads own school" ON schools;

CREATE POLICY "authenticated reads own school"
  ON schools FOR SELECT
  TO authenticated
  USING (is_super_admin() OR id = get_my_school_id());

CREATE POLICY "super admin manages schools"
  ON schools FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- -------------------- SESSIONS --------------------
DROP POLICY IF EXISTS "Authenticated users can read sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can manage sessions"            ON sessions;
DROP POLICY IF EXISTS "School users can read sessions"        ON sessions;

CREATE POLICY "School users can read sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- TERMS --------------------
DROP POLICY IF EXISTS "Authenticated users can read terms" ON terms;
DROP POLICY IF EXISTS "Admins can manage terms"            ON terms;
DROP POLICY IF EXISTS "School users can read terms"         ON terms;

CREATE POLICY "School users can read terms"
  ON terms FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage terms"
  ON terms FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- TEACHERS --------------------
DROP POLICY IF EXISTS "Authenticated users can read teachers" ON teachers;
DROP POLICY IF EXISTS "Admins can manage teachers"            ON teachers;
DROP POLICY IF EXISTS "Parents can view children teachers"    ON teachers;
DROP POLICY IF EXISTS "School users can read teachers"        ON teachers;

CREATE POLICY "School users can read teachers"
  ON teachers FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can manage teachers"
  ON teachers FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- CLASSES --------------------
DROP POLICY IF EXISTS "Authenticated users can read classes" ON classes;
DROP POLICY IF EXISTS "Admins can manage classes"            ON classes;
DROP POLICY IF EXISTS "Parents can view children classes"    ON classes;
DROP POLICY IF EXISTS "School users can read classes"        ON classes;

CREATE POLICY "School users can read classes"
  ON classes FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR id IN (SELECT class_id FROM students WHERE parent_email IN (SELECT email FROM parents WHERE user_id = auth.uid()))
    OR id IN (SELECT class_id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage classes"
  ON classes FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- SUBJECTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can manage subjects"            ON subjects;
DROP POLICY IF EXISTS "Parents can view subjects"             ON subjects;
DROP POLICY IF EXISTS "School users can read subjects"        ON subjects;

CREATE POLICY "School users can read subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
  );

CREATE POLICY "Admins can manage subjects"
  ON subjects FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- STUDENTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read students" ON students;
DROP POLICY IF EXISTS "Admins can manage students"            ON students;
DROP POLICY IF EXISTS "Parents can view their children"       ON students;
DROP POLICY IF EXISTS "School users can read students"        ON students;

CREATE POLICY "School users can read students"
  ON students FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR user_id = auth.uid()
    OR parent_email IN (SELECT email FROM parents WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage students"
  ON students FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- SUBJECT_CLASSES --------------------
DROP POLICY IF EXISTS "Authenticated users can read subject_classes" ON subject_classes;
DROP POLICY IF EXISTS "Admins can manage subject_classes"            ON subject_classes;
DROP POLICY IF EXISTS "School users can read subject_classes"        ON subject_classes;

CREATE POLICY "School users can read subject_classes"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage subject_classes"
  ON subject_classes FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- SUBJECT_ASSIGNMENTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read subject_assignments" ON subject_assignments;
DROP POLICY IF EXISTS "Admins can manage subject_assignments"            ON subject_assignments;
DROP POLICY IF EXISTS "School users can read subject_assignments"        ON subject_assignments;

CREATE POLICY "School users can read subject_assignments"
  ON subject_assignments FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage subject_assignments"
  ON subject_assignments FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- ATTENDANCE --------------------
DROP POLICY IF EXISTS "Authenticated users can read attendance"              ON attendance;
DROP POLICY IF EXISTS "Teachers can manage attendance for their classes"     ON attendance;
DROP POLICY IF EXISTS "Admins can manage attendance"                         ON attendance;
DROP POLICY IF EXISTS "Parents can view children attendance"                 ON attendance;
DROP POLICY IF EXISTS "School users can read attendance"                     ON attendance;

CREATE POLICY "School users can read attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR student_id IN (
        SELECT id FROM students WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
  );

CREATE POLICY "Teachers can manage attendance for their classes"
  ON attendance FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND class_id IN (
      SELECT id FROM classes
      WHERE class_teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage attendance"
  ON attendance FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- ASSIGNMENTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read assignments"  ON assignments;
DROP POLICY IF EXISTS "Admins can manage assignments"             ON assignments;
DROP POLICY IF EXISTS "Parents can view children assignments"     ON assignments;
DROP POLICY IF EXISTS "School users can read assignments"         ON assignments;

CREATE POLICY "School users can read assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
  );

CREATE POLICY "Admins can manage assignments"
  ON assignments FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- ASSIGNMENT_SUBMISSIONS --------------------
DROP POLICY IF EXISTS "Authenticated users can read assignment_submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Admins can manage assignment_submissions"            ON assignment_submissions;
DROP POLICY IF EXISTS "Parents can view children submissions"               ON assignment_submissions;
DROP POLICY IF EXISTS "School users can read assignment_submissions"        ON assignment_submissions;

CREATE POLICY "School users can read assignment_submissions"
  ON assignment_submissions FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR student_id IN (
        SELECT id FROM students WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
  );

CREATE POLICY "Admins can manage assignment_submissions"
  ON assignment_submissions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- SUBMISSIONS (legacy) --------------------
DROP POLICY IF EXISTS "Authenticated users can read submissions" ON submissions;
DROP POLICY IF EXISTS "Admins can manage submissions"            ON submissions;
DROP POLICY IF EXISTS "School users can read submissions"        ON submissions;

CREATE POLICY "School users can read submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage submissions"
  ON submissions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- RESULTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read results" ON results;
DROP POLICY IF EXISTS "Admins can manage results"            ON results;
DROP POLICY IF EXISTS "Parents can view children results"    ON results;
DROP POLICY IF EXISTS "School users can read results"        ON results;

CREATE POLICY "School users can read results"
  ON results FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR student_id IN (
        SELECT id FROM students WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
    OR student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage results"
  ON results FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- STUDENT_SUBJECTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read student_subjects" ON student_subjects;
DROP POLICY IF EXISTS "Admins can manage student_subjects"             ON student_subjects;
DROP POLICY IF EXISTS "Parents can view children subjects"             ON student_subjects;
DROP POLICY IF EXISTS "School users can read student_subjects"         ON student_subjects;

CREATE POLICY "School users can read student_subjects"
  ON student_subjects FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR student_id IN (
        SELECT id FROM students WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
  );

CREATE POLICY "Admins can manage student_subjects"
  ON student_subjects FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- STUDENT_OPTIONAL_SUBJECTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read student_optional_subjects" ON student_optional_subjects;
DROP POLICY IF EXISTS "Admins can manage student_optional_subjects"             ON student_optional_subjects;
DROP POLICY IF EXISTS "School users can read student_optional_subjects"         ON student_optional_subjects;

CREATE POLICY "School users can read student_optional_subjects"
  ON student_optional_subjects FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage student_optional_subjects"
  ON student_optional_subjects FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- ADMISSIONS --------------------
DROP POLICY IF EXISTS "Authenticated users can read admissions" ON admissions;
DROP POLICY IF EXISTS "Admins can manage admissions"            ON admissions;
DROP POLICY IF EXISTS "School users can read admissions"        ON admissions;

CREATE POLICY "School users can read admissions"
  ON admissions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage admissions"
  ON admissions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- EVENTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read events" ON events;
DROP POLICY IF EXISTS "Admins can manage events"            ON events;
DROP POLICY IF EXISTS "School users can read events"        ON events;

CREATE POLICY "School users can read events"
  ON events FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage events"
  ON events FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- NEWS --------------------
DROP POLICY IF EXISTS "Authenticated users can read news" ON news;
DROP POLICY IF EXISTS "Admins can manage news"            ON news;
DROP POLICY IF EXISTS "School users can read news"        ON news;

CREATE POLICY "School users can read news"
  ON news FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage news"
  ON news FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- TESTIMONIALS --------------------
DROP POLICY IF EXISTS "Authenticated users can read testimonials" ON testimonials;
DROP POLICY IF EXISTS "Admins can manage testimonials"            ON testimonials;
DROP POLICY IF EXISTS "School users can read testimonials"        ON testimonials;

CREATE POLICY "School users can read testimonials"
  ON testimonials FOR SELECT
  TO authenticated
  USING (true); -- public content, no school restriction needed

CREATE POLICY "Admins can manage testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (is_super_admin() OR is_admin())
  WITH CHECK (is_super_admin() OR is_admin());

-- -------------------- SCHOOL_SETTINGS --------------------
DROP POLICY IF EXISTS "Authenticated users can read school_settings" ON school_settings;
DROP POLICY IF EXISTS "Admins can manage school_settings"            ON school_settings;
DROP POLICY IF EXISTS "School users can read school_settings"        ON school_settings;

CREATE POLICY "School users can read school_settings"
  ON school_settings FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage school_settings"
  ON school_settings FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- PERIOD_SLOTS --------------------
DROP POLICY IF EXISTS "Authenticated users can read period_slots" ON period_slots;
DROP POLICY IF EXISTS "Admins can manage period_slots"            ON period_slots;
DROP POLICY IF EXISTS "School users can read period_slots"        ON period_slots;

CREATE POLICY "School users can read period_slots"
  ON period_slots FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage period_slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- TIMETABLE_ENTRIES --------------------
DROP POLICY IF EXISTS "Authenticated users can read timetable_entries" ON timetable_entries;
DROP POLICY IF EXISTS "Admins can manage timetable_entries"            ON timetable_entries;
DROP POLICY IF EXISTS "Parents can view children timetable"            ON timetable_entries;
DROP POLICY IF EXISTS "School users can read timetable_entries"        ON timetable_entries;

CREATE POLICY "School users can read timetable_entries"
  ON timetable_entries FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR class_id IN (
        SELECT class_id FROM students WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
  );

CREATE POLICY "Admins can manage timetable_entries"
  ON timetable_entries FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -------------------- PARENTS --------------------
DROP POLICY IF EXISTS "Parents can read own data"       ON parents;
DROP POLICY IF EXISTS "Parents can update own data"     ON parents;
DROP POLICY IF EXISTS "Users can read all parents"      ON parents;
DROP POLICY IF EXISTS "Admins can manage parents"       ON parents;
DROP POLICY IF EXISTS "Service role can insert parents" ON parents;

CREATE POLICY "Parents can read own data"
  ON parents FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
  );

CREATE POLICY "Parents can update own data"
  ON parents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage parents"
  ON parents FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Service role can insert parents"
  ON parents FOR INSERT
  WITH CHECK (true);

-- -------------------- NOTIFICATION_TOKENS --------------------
DROP POLICY IF EXISTS "Users can read all tokens"                   ON notification_tokens;
DROP POLICY IF EXISTS "Admins can manage notification tokens"       ON notification_tokens;
DROP POLICY IF EXISTS "Service role can insert notification tokens" ON notification_tokens;
DROP POLICY IF EXISTS "Users can read own tokens"                   ON notification_tokens;

CREATE POLICY "Users can read own tokens"
  ON notification_tokens FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
  );

CREATE POLICY "Admins can manage notification tokens"
  ON notification_tokens FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Service role can insert notification tokens"
  ON notification_tokens FOR INSERT
  WITH CHECK (true);

-- -------------------- RESULTS_PUBLICATION --------------------
DROP POLICY IF EXISTS "Admins can manage results publication"          ON results_publication;
DROP POLICY IF EXISTS "Authenticated users can view publication settings" ON results_publication;
DROP POLICY IF EXISTS "School users can view results publication"     ON results_publication;

CREATE POLICY "School users can view results publication"
  ON results_publication FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage results publication"
  ON results_publication FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- ============================================================================
-- STEP 14: ADD super_admin ROLE (if not already present)
-- ============================================================================

INSERT INTO roles (name) VALUES ('super_admin') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('admin')       ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('teacher')     ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('student')     ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('parent')      ON CONFLICT (name) DO NOTHING;

-- Grant manage_schools permission to super_admin
INSERT INTO permissions (key) VALUES ('manage_schools') ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 15: INITIALIZE DEFAULT SCHOOL CONFIGURATION VALUES
--   Seed the default school with common configuration values
-- ============================================================================

-- Helper function to seed default education levels for a school
CREATE OR REPLACE FUNCTION seed_default_education_levels(p_school_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO school_education_levels (school_id, name, code, order_sequence, is_active)
  VALUES
    (p_school_id, 'Primary', 'PRI', 1, true),
    (p_school_id, 'Secondary', 'SEC', 2, true),
    (p_school_id, 'Tertiary', 'TER', 3, true)
  ON CONFLICT (school_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to seed default class levels for a school
CREATE OR REPLACE FUNCTION seed_default_class_levels(p_school_id uuid)
RETURNS void AS $$
DECLARE
  v_education_level_id uuid;
  v_class_num int;
BEGIN
  -- Get Primary education level
  SELECT id INTO v_education_level_id 
  FROM school_education_levels 
  WHERE school_id = p_school_id AND code = 'PRI' LIMIT 1;
  
  IF v_education_level_id IS NOT NULL THEN
    FOR v_class_num IN 1..6 LOOP
      INSERT INTO school_class_levels (school_id, education_level_id, name, code, order_sequence, is_active)
      VALUES (p_school_id, v_education_level_id, 'Class ' || v_class_num::text, 'PRI' || v_class_num::text, v_class_num, true)
      ON CONFLICT (school_id, education_level_id, name) DO NOTHING;
    END LOOP;
  END IF;

  -- Get Secondary education level
  SELECT id INTO v_education_level_id 
  FROM school_education_levels 
  WHERE school_id = p_school_id AND code = 'SEC' LIMIT 1;
  
  IF v_education_level_id IS NOT NULL THEN
    FOR v_class_num IN 1..4 LOOP
      INSERT INTO school_class_levels (school_id, education_level_id, name, code, order_sequence, is_active)
      VALUES (p_school_id, v_education_level_id, 'Form ' || v_class_num::text, 'SEC' || v_class_num::text, v_class_num, true)
      ON CONFLICT (school_id, education_level_id, name) DO NOTHING;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to seed default streams
CREATE OR REPLACE FUNCTION seed_default_streams(p_school_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO school_streams (school_id, name, code, is_active)
  VALUES
    (p_school_id, 'Stream A', 'A', true),
    (p_school_id, 'Stream B', 'B', true),
    (p_school_id, 'Stream C', 'C', true)
  ON CONFLICT (school_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to seed default departments
CREATE OR REPLACE FUNCTION seed_default_departments(p_school_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO school_departments (school_id, name, code, is_active)
  VALUES
    (p_school_id, 'Science', 'SCI', true),
    (p_school_id, 'Arts', 'ART', true),
    (p_school_id, 'Commercial', 'COM', true)
  ON CONFLICT (school_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to seed default religions
CREATE OR REPLACE FUNCTION seed_default_religions(p_school_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO school_religions (school_id, name, code, is_active)
  VALUES
    (p_school_id, 'Christian', 'CHR', true),
    (p_school_id, 'Muslim', 'MUS', true),
    (p_school_id, 'Hindu', 'HIN', true),
    (p_school_id, 'Other', 'OTH', true)
  ON CONFLICT (school_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master function to initialize all default configurations for a school
CREATE OR REPLACE FUNCTION initialize_school_configurations(p_school_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM seed_default_education_levels(p_school_id);
  PERFORM seed_default_class_levels(p_school_id);
  PERFORM seed_default_streams(p_school_id);
  PERFORM seed_default_departments(p_school_id);
  PERFORM seed_default_religions(p_school_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize configurations for the default school
SELECT initialize_school_configurations('00000000-0000-0000-0000-000000000001');

-- ============================================================================
-- COMPLETION
-- ============================================================================
-- ✅ schools table created
-- ✅ school_id added to all core tables AND configuration tables
-- ✅ Existing data migrated to Default School (id: 00000000-0000-0000-0000-000000000001)
-- ✅ NOT NULL enforced on critical tables
-- ✅ Unique constraints updated to be per-school
-- ✅ is_super_admin(), get_my_school_id() helper functions created
-- ✅ can_access_super_admin() RPC created for middleware
-- ✅ custom_access_token_hook installed (configure in Supabase Dashboard → Auth → Hooks)
-- ✅ ALL RLS policies updated to filter by school_id (including configuration tables)
-- ✅ School configuration tables (education levels, class levels, streams, departments, religions) initialized
-- ✅ Helper functions created for seeding default configurations per school
--
-- NEW CONFIGURABLE SCHOOL VALUES:
-- ✅ school_education_levels: define education structure (Primary, Secondary, Tertiary)
-- ✅ school_class_levels: define class names per education level (Class 1-6, Form 1-4)
-- ✅ school_streams: define class divisions (Stream A, B, C or Science, Arts, etc.)
-- ✅ school_departments: define departments (Science, Arts, Commercial)
-- ✅ school_religions: define religion options (Christian, Muslim, etc.)
--
-- NEXT STEPS:
-- 1. In Supabase Dashboard → Authentication → Hooks → Custom Access Token:
--    Set the hook function to: public.custom_access_token_hook
-- 2. Update Default School name/subdomain to your real school:
--    UPDATE schools SET name='Your School Name', subdomain='yourschool'
--    WHERE id='00000000-0000-0000-0000-000000000001';
-- 3. Customize default configurations (or use initialize_school_configurations() for any new school):
--    - View: SELECT * FROM school_education_levels WHERE school_id = '<school-id>'
--    - Add: INSERT INTO school_education_levels (school_id, name, code, is_active) VALUES (...)
-- 4. Create a new school and auto-seed its configurations:
--    WITH new_school AS (
--      INSERT INTO schools (name, subdomain) VALUES ('New School', 'newschool')
--      RETURNING id
--    )
--    SELECT initialize_school_configurations((SELECT id FROM new_school));
-- 5. To create a super_admin user:
--    INSERT INTO user_role_links (user_id, role_id, school_id)
--    SELECT '<your-user-id>', id, NULL FROM roles WHERE name = 'super_admin';

-- ============================================================================
-- LEGACY TABLE: user_roles (used by create-teacher API route)
-- Adding school_id if the table already exists in the database.
-- This block is safe to run even if user_roles does not exist yet.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'user_roles'
  ) THEN
    -- Add school_id column if missing
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'user_roles'
        AND column_name  = 'school_id'
    ) THEN
      ALTER TABLE public.user_roles
        ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

      -- Backfill existing rows with the default school
      UPDATE public.user_roles
         SET school_id = '00000000-0000-0000-0000-000000000001'
       WHERE school_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_user_roles_school_id
        ON public.user_roles(school_id);
    END IF;
  END IF;
END;
$$;

-- Likewise, add school_id to the admins table (created by create_admins_table.sql)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'admins'
      AND column_name  = 'school_id'
  ) THEN
    -- already exists, nothing to do
    NULL;
  ELSE
    IF EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'admins'
    ) THEN
      ALTER TABLE public.admins
        ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

      UPDATE public.admins
         SET school_id = '00000000-0000-0000-0000-000000000001'
       WHERE school_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_admins_school_id
        ON public.admins(school_id);
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- ENABLE RLS ON SCHOOL CONFIGURATION TABLES
-- ============================================================================

ALTER TABLE school_education_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_class_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_religions ENABLE ROW LEVEL SECURITY;
