-- ============================================================================
-- FIX: user_roles RECURSIVE RLS POLICY CAUSING STACK OVERFLOW
-- ============================================================================
-- The problem: user_roles RLS policies query user_roles table, causing recursion
-- Solution: Use SECURITY DEFINER functions to bypass RLS when checking roles
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- ============================================================================
-- CRITICAL: Update helper functions to use STABLE (not volatile)
-- This prevents re-evaluation and improves performance
-- ============================================================================

-- Enhanced has_role function with direct table access (bypasses RLS)
CREATE OR REPLACE FUNCTION has_role(check_role text)
RETURNS boolean AS $$
DECLARE
  role_exists boolean;
BEGIN
  -- Direct query without RLS (SECURITY DEFINER bypasses RLS)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = check_role
  ) INTO role_exists;
  
  RETURN COALESCE(role_exists, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update is_admin with STABLE
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- NEW NON-RECURSIVE RLS POLICIES FOR user_roles
-- ============================================================================

-- Policy 1: Users can view their own roles
-- Uses direct user_id check (no recursion)
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Service role (backend) can manage all roles
-- This allows your API routes to manage roles without RLS interference
CREATE POLICY "Service role can manage all roles"
  ON user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 3: Authenticated users can check if someone is an admin
-- Read-only for checking admin status (used by frontend)
CREATE POLICY "Authenticated users can check admin roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (role = 'admin');

-- ============================================================================
-- ADMIN ROLE MANAGEMENT VIA STORED PROCEDURE
-- ============================================================================
-- Since we can't use recursive RLS, admins must use this function to manage roles
-- Usage: SELECT manage_user_role('insert', user_id, 'student', null, student_id, null);

CREATE OR REPLACE FUNCTION manage_user_role(
  action text, -- 'insert', 'update', 'delete'
  target_user_id uuid,
  user_role text DEFAULT NULL,
  teacher_id_val uuid DEFAULT NULL,
  student_id_val uuid DEFAULT NULL,
  managed_class_id_val uuid DEFAULT NULL,
  role_id_to_delete uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  current_user_is_admin boolean;
  result_id uuid;
BEGIN
  -- Check if current user is admin using SECURITY DEFINER bypass
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO current_user_is_admin;
  
  IF NOT current_user_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can manage user roles';
  END IF;
  
  -- Perform the requested action
  CASE action
    WHEN 'insert' THEN
      INSERT INTO user_roles (user_id, role, teacher_id, student_id, managed_class_id)
      VALUES (target_user_id, user_role, teacher_id_val, student_id_val, managed_class_id_val)
      ON CONFLICT DO NOTHING
      RETURNING id INTO result_id;
      
      RETURN json_build_object(
        'success', true,
        'message', 'Role created successfully',
        'role_id', result_id
      );
      
    WHEN 'delete' THEN
      DELETE FROM user_roles
      WHERE id = role_id_to_delete OR (
        user_id = target_user_id AND
        role = user_role AND
        COALESCE(teacher_id::text, '') = COALESCE(teacher_id_val::text, '') AND
        COALESCE(student_id::text, '') = COALESCE(student_id_val::text, '') AND
        COALESCE(managed_class_id::text, '') = COALESCE(managed_class_id_val::text, '')
      );
      
      RETURN json_build_object(
        'success', true,
        'message', 'Role deleted successfully'
      );
      
    ELSE
      RAISE EXCEPTION 'Invalid action: %. Use insert, update, or delete', action;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE ALL OTHER HELPER FUNCTIONS TO USE STABLE
-- ============================================================================

CREATE OR REPLACE FUNCTION is_class_teacher()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('class_teacher');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_subject_teacher()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('subject_teacher');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_teacher()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('class_teacher') OR has_role('subject_teacher');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_student()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('student');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- FIX TIMETABLE_ENTRIES RLS POLICIES
-- ============================================================================
-- The current policies will now work correctly with the updated is_admin() function

DROP POLICY IF EXISTS "Only admins can manage timetable entries" ON timetable_entries;

-- Recreate with the fixed is_admin() function
CREATE POLICY "Only admins can manage timetable entries"
  ON timetable_entries FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION has_role(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_class_teacher() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_subject_teacher() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_teacher() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_student() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_current_teacher_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_current_student_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION manages_class(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION teaches_subject_class(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION manage_user_role(text, uuid, text, uuid, uuid, uuid, uuid) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify the fix:
-- SELECT * FROM user_roles WHERE user_id = auth.uid();
-- SELECT is_admin();

COMMENT ON FUNCTION has_role(text) IS 'Check if current user has a specific role (SECURITY DEFINER bypasses RLS)';
COMMENT ON FUNCTION is_admin() IS 'Check if current user is an admin (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION is_class_teacher() IS 'Check if current user is a class teacher (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION is_subject_teacher() IS 'Check if current user is a subject teacher (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION is_teacher() IS 'Check if current user is any type of teacher (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION is_student() IS 'Check if current user is a student (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION get_current_teacher_id() IS 'Get teacher_id for current user (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION get_current_student_id() IS 'Get student_id for current user (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION manages_class(uuid) IS 'Check if current user manages specific class (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION teaches_subject_class(uuid) IS 'Check if current user teaches specific subject class (STABLE + SECURITY DEFINER)';
COMMENT ON FUNCTION manage_user_role(text, uuid, text, uuid, uuid, uuid, uuid) IS 'Admin function to manage user roles without RLS recursion';
