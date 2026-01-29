-- ============================================================================
-- FIX RLS POLICIES - Proper function references
-- ============================================================================
-- This migration fixes issues where is_admin() was being treated as a column
-- Ensures all policies use proper function calls with public schema prefix

-- ============================================================================
-- DROP ALL PROBLEMATIC POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Only admins can manage sessions" ON sessions;
DROP POLICY IF EXISTS "Only admins can manage terms" ON terms;
DROP POLICY IF EXISTS "Only admins can manage teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can insert/delete teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can delete teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can manage classes" ON classes;
DROP POLICY IF EXISTS "Only admins can manage subjects" ON subjects;
DROP POLICY IF EXISTS "Only admins can manage subject_classes" ON subject_classes;
DROP POLICY IF EXISTS "Only admins can manage subject_assignments" ON subject_assignments;
DROP POLICY IF EXISTS "Only admins can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Only admins can manage assignments" ON assignments;
DROP POLICY IF EXISTS "Only admins can manage results" ON results;
DROP POLICY IF EXISTS "Only admins can manage admissions" ON admissions;
DROP POLICY IF EXISTS "Only admins can manage events" ON events;
DROP POLICY IF EXISTS "Only admins can manage news" ON news;
DROP POLICY IF EXISTS "Only admins can manage testimonials" ON testimonials;
DROP POLICY IF EXISTS "Only admins can manage notifications" ON notifications;
DROP POLICY IF EXISTS "Only admins can manage school_settings" ON school_settings;
DROP POLICY IF EXISTS "Only admins can manage period slots" ON period_slots;
DROP POLICY IF EXISTS "Only admins can manage student_optional_subjects" ON student_optional_subjects;

-- Drop any with service role bypass
DROP POLICY IF EXISTS "Service role bypass - classes" ON classes;
DROP POLICY IF EXISTS "Service role bypass - sessions" ON sessions;
DROP POLICY IF EXISTS "Service role bypass - terms" ON terms;
DROP POLICY IF EXISTS "Service role bypass - subjects" ON subjects;
DROP POLICY IF EXISTS "Service role bypass - teachers" ON teachers;

-- ============================================================================
-- RECREATE POLICIES WITH PROPER FUNCTION CALLS
-- ============================================================================

-- SESSIONS TABLE
CREATE POLICY "Admin: manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- TERMS TABLE
CREATE POLICY "Admin: manage terms"
  ON terms FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- TEACHERS TABLE
CREATE POLICY "Admin: read teachers"
  ON teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin: manage teachers"
  ON teachers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin: update teachers"
  ON teachers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin: delete teachers"
  ON teachers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- CLASSES TABLE
CREATE POLICY "Admin: manage classes"
  ON classes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SUBJECTS TABLE
CREATE POLICY "Admin: manage subjects"
  ON subjects FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SUBJECT_CLASSES TABLE
CREATE POLICY "Admin: manage subject_classes"
  ON subject_classes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SUBJECT_ASSIGNMENTS TABLE
CREATE POLICY "Admin: manage subject_assignments"
  ON subject_assignments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ATTENDANCE TABLE
CREATE POLICY "Admin: manage attendance"
  ON attendance FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ASSIGNMENTS TABLE
CREATE POLICY "Admin: manage assignments"
  ON assignments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RESULTS TABLE
CREATE POLICY "Admin: manage results"
  ON results FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ADMISSIONS TABLE
CREATE POLICY "Admin: manage admissions"
  ON admissions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- EVENTS TABLE
CREATE POLICY "Admin: manage events"
  ON events FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NEWS TABLE
CREATE POLICY "Admin: manage news"
  ON news FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- TESTIMONIALS TABLE
CREATE POLICY "Admin: manage testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NOTIFICATIONS TABLE
CREATE POLICY "Admin: manage notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SCHOOL_SETTINGS TABLE
CREATE POLICY "Admin: manage school_settings"
  ON school_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PERIOD_SLOTS TABLE
CREATE POLICY "Admin: manage period_slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- STUDENT_OPTIONAL_SUBJECTS TABLE
CREATE POLICY "Admin: manage student_optional_subjects"
  ON student_optional_subjects FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
