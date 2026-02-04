-- ============================================================================
-- CLASSES PAGE - MINIMAL RLS POLICIES
-- ============================================================================
-- This migration creates minimal RLS policies for the classes management page
-- Allows admins to directly query via Supabase client (no admin-read API needed)
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP OLD POLICIES
-- ============================================================================

-- Classes table
DROP POLICY IF EXISTS "Authenticated users can read classes" ON classes;
DROP POLICY IF EXISTS "Admins can manage classes" ON classes;

-- Teachers table (only drop admin-related, keep parent/student policies)
DROP POLICY IF EXISTS "Authenticated users can read teachers" ON teachers;
DROP POLICY IF EXISTS "Admins can manage teachers" ON teachers;

-- Students table (only drop admin-related, keep parent policies)
DROP POLICY IF EXISTS "Authenticated users can read students" ON students;
DROP POLICY IF EXISTS "Admins can manage students" ON students;

-- Subject_classes table
DROP POLICY IF EXISTS "Authenticated users can read subject_classes" ON subject_classes;
DROP POLICY IF EXISTS "Admins can manage subject_classes" ON subject_classes;

-- ============================================================================
-- STEP 2: CREATE NEW MINIMAL POLICIES
-- ============================================================================

-- CLASSES: Admins have full access
CREATE POLICY "Admins can read classes"
  ON classes FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert classes"
  ON classes FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update classes"
  ON classes FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete classes"
  ON classes FOR DELETE
  TO authenticated
  USING (is_admin());

-- TEACHERS: Admins can read (for class teacher assignment)
CREATE POLICY "Admins can read teachers"
  ON teachers FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage teachers"
  ON teachers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- STUDENTS: Admins can read (for counting students in class)
CREATE POLICY "Admins can read students"
  ON students FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage students"
  ON students FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- SUBJECT_CLASSES: Admins can read (for counting subjects per class)
CREATE POLICY "Admins can read subject_classes"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage subject_classes"
  ON subject_classes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- VERIFICATION QUERIES (run these to test)
-- ============================================================================

-- Test as admin user:
-- SELECT * FROM classes ORDER BY level;
-- SELECT * FROM teachers WHERE status = 'active' ORDER BY first_name;
-- SELECT id FROM students WHERE class_id = '<some-class-id>';
-- SELECT id FROM subject_classes WHERE class_id = '<some-class-id>';

-- ============================================================================
-- NOTES
-- ============================================================================
-- ✅ Admins can now query classes, teachers, students, subject_classes directly
-- ✅ No need for /api/admin-read or /api/admin-operation for this page
-- ✅ RLS handles all security via is_admin() function
-- ✅ Parent policies remain unchanged and functional
-- 🔒 Non-admin users still cannot access these tables
