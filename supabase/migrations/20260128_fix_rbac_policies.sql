-- ============================================================================
-- FIX ADMIN RBAC - Update policies with service role bypass (no duplicate insert)
-- ============================================================================

-- This migration fixes RLS policies to allow service role and admin operations
-- It does NOT attempt to insert duplicate admin roles

-- ============================================================================
-- DROP ALL EXISTING ADMIN-ONLY POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Service role bypass - classes" ON classes;
DROP POLICY IF EXISTS "Only admins can manage classes" ON classes;

DROP POLICY IF EXISTS "Service role bypass - sessions" ON sessions;
DROP POLICY IF EXISTS "Only admins can manage sessions" ON sessions;

DROP POLICY IF EXISTS "Service role bypass - terms" ON terms;
DROP POLICY IF EXISTS "Only admins can manage terms" ON terms;

DROP POLICY IF EXISTS "Service role bypass - subjects" ON subjects;
DROP POLICY IF EXISTS "Only admins can manage subjects" ON subjects;

DROP POLICY IF EXISTS "Service role bypass - teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can insert/delete teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can delete teachers" ON teachers;

DROP POLICY IF EXISTS "Service role bypass - subject_assignments" ON subject_assignments;
DROP POLICY IF EXISTS "Only admins can manage subject_assignments" ON subject_assignments;

DROP POLICY IF EXISTS "Service role bypass - admissions" ON admissions;
DROP POLICY IF EXISTS "Only admins can manage admissions" ON admissions;

DROP POLICY IF EXISTS "Service role bypass - events" ON events;
DROP POLICY IF EXISTS "Only admins can manage events" ON events;

DROP POLICY IF EXISTS "Service role bypass - news" ON news;
DROP POLICY IF EXISTS "Only admins can manage news" ON news;

DROP POLICY IF EXISTS "Service role bypass - testimonials" ON testimonials;
DROP POLICY IF EXISTS "Only admins can manage testimonials" ON testimonials;

DROP POLICY IF EXISTS "Service role bypass - notifications" ON notifications;
DROP POLICY IF EXISTS "Only admins can manage notifications" ON notifications;

DROP POLICY IF EXISTS "Service role bypass - school_settings" ON school_settings;
DROP POLICY IF EXISTS "Only admins can manage school_settings" ON school_settings;

DROP POLICY IF EXISTS "Service role bypass - period_slots" ON period_slots;
DROP POLICY IF EXISTS "Only admins can manage period slots" ON period_slots;

-- ============================================================================
-- RECREATE POLICIES WITH SERVICE ROLE BYPASS
-- ============================================================================

-- CLASSES TABLE - Allow service role and admins
CREATE POLICY "classes_bypass_service_and_admin"
  ON classes FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- SESSIONS TABLE - Allow service role and admins
CREATE POLICY "sessions_bypass_service_and_admin"
  ON sessions FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- TERMS TABLE - Allow service role and admins
CREATE POLICY "terms_bypass_service_and_admin"
  ON terms FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- SUBJECTS TABLE - Allow service role and admins
CREATE POLICY "subjects_bypass_service_and_admin"
  ON subjects FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- TEACHERS TABLE - Allow service role and admins
CREATE POLICY "teachers_bypass_service_and_admin_all"
  ON teachers FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- SUBJECT_ASSIGNMENTS TABLE - Allow service role and admins
CREATE POLICY "subject_assignments_bypass_service_and_admin"
  ON subject_assignments FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- ADMISSIONS TABLE - Allow service role and admins
CREATE POLICY "admissions_bypass_service_and_admin"
  ON admissions FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- EVENTS TABLE - Allow service role and admins
CREATE POLICY "events_bypass_service_and_admin"
  ON events FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- NEWS TABLE - Allow service role and admins
CREATE POLICY "news_bypass_service_and_admin"
  ON news FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- TESTIMONIALS TABLE - Allow service role and admins
CREATE POLICY "testimonials_bypass_service_and_admin"
  ON testimonials FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- NOTIFICATIONS TABLE - Allow service role and admins
CREATE POLICY "notifications_bypass_service_and_admin"
  ON notifications FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- SCHOOL_SETTINGS TABLE - Allow service role and admins
CREATE POLICY "school_settings_bypass_service_and_admin"
  ON school_settings FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- PERIOD_SLOTS TABLE - Allow service role and admins
CREATE POLICY "period_slots_bypass_service_and_admin"
  ON period_slots FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role' OR public.is_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_admin());

-- ============================================================================
-- CONFIRMATION
-- ============================================================================
-- Run this to verify admin role exists:
-- SELECT ur.*, au.email 
-- FROM public.user_roles ur
-- JOIN auth.users au ON ur.user_id = au.id
-- WHERE au.email = 'codenova02@gmail.com';
--
-- If you need to view all user roles:
-- SELECT ur.*, au.email FROM public.user_roles ur
-- LEFT JOIN auth.users au ON ur.user_id = au.id;
