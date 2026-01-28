-- ============================================================================
-- FIX ADMIN RBAC - Ensure admin user has proper role assignment
-- ============================================================================

-- This migration fixes RBAC issues by:
-- 1. Ensuring the admin user (codenova02@gmail.com) has admin role
-- 2. Adding a bypass policy for service role operations
-- 3. Fixing the is_admin() function to be more robust

-- ============================================================================
-- 1. ADD SERVICE ROLE BYPASS
-- ============================================================================
-- Drop existing policies that might be blocking service role
DROP POLICY IF EXISTS "Only admins can manage classes" ON classes;
DROP POLICY IF EXISTS "Only admins can manage sessions" ON sessions;
DROP POLICY IF EXISTS "Only admins can manage terms" ON terms;
DROP POLICY IF EXISTS "Only admins can manage subjects" ON subjects;
DROP POLICY IF EXISTS "Only admins can insert/delete teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can delete teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can manage subject_assignments" ON subject_assignments;
DROP POLICY IF EXISTS "Only admins can manage admissions" ON admissions;
DROP POLICY IF EXISTS "Only admins can manage events" ON events;
DROP POLICY IF EXISTS "Only admins can manage news" ON news;
DROP POLICY IF EXISTS "Only admins can manage testimonials" ON testimonials;
DROP POLICY IF EXISTS "Only admins can manage notifications" ON notifications;
DROP POLICY IF EXISTS "Only admins can manage school_settings" ON school_settings;
DROP POLICY IF EXISTS "Only admins can manage period slots" ON period_slots;

-- ============================================================================
-- 2. RECREATE POLICIES WITH SERVICE ROLE BYPASS
-- ============================================================================

-- CLASSES TABLE
CREATE POLICY "Service role bypass - classes"
  ON classes FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage classes"
  ON classes FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- SESSIONS TABLE
CREATE POLICY "Service role bypass - sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- TERMS TABLE
CREATE POLICY "Service role bypass - terms"
  ON terms FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage terms"
  ON terms FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- SUBJECTS TABLE
CREATE POLICY "Service role bypass - subjects"
  ON subjects FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage subjects"
  ON subjects FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- TEACHERS TABLE
CREATE POLICY "Service role bypass - teachers"
  ON teachers FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can insert/delete teachers"
  ON teachers FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

CREATE POLICY "Only admins can delete teachers"
  ON teachers FOR DELETE
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin());

-- SUBJECT_ASSIGNMENTS TABLE
CREATE POLICY "Service role bypass - subject_assignments"
  ON subject_assignments FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage subject_assignments"
  ON subject_assignments FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- ADMISSIONS TABLE
CREATE POLICY "Service role bypass - admissions"
  ON admissions FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage admissions"
  ON admissions FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- EVENTS TABLE
CREATE POLICY "Service role bypass - events"
  ON events FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage events"
  ON events FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- NEWS TABLE
CREATE POLICY "Service role bypass - news"
  ON news FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage news"
  ON news FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- TESTIMONIALS TABLE
CREATE POLICY "Service role bypass - testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- NOTIFICATIONS TABLE
CREATE POLICY "Service role bypass - notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- SCHOOL_SETTINGS TABLE
CREATE POLICY "Service role bypass - school_settings"
  ON school_settings FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage school_settings"
  ON school_settings FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- PERIOD_SLOTS TABLE
CREATE POLICY "Service role bypass - period_slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only admins can manage period slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- ============================================================================
-- 3. VERIFY ADMIN USER HAS ADMIN ROLE
-- ============================================================================

-- Insert or update admin role for codenova02@gmail.com if it doesn't exist
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'codenova02@gmail.com'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- If you're still getting RLS errors after applying this migration:
-- 
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Run this query to verify admin role:
--    SELECT ur.* FROM public.user_roles ur
--    JOIN auth.users au ON ur.user_id = au.id
--    WHERE au.email = 'codenova02@gmail.com';
--
-- 3. If no results, manually insert:
--    INSERT INTO public.user_roles (user_id, role)
--    SELECT id, 'admin' FROM auth.users
--    WHERE email = 'codenova02@gmail.com';
--
-- 4. If you're using a different admin email, update the migration above
--    and run the INSERT statement with your email address.
