-- =============================================================================
-- Admin Roles & Permissions (Migration 06)
-- Enables school admins to delegate features to sub-admins with scoped access
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add is_primary_admin column to admins table
--    The first admin who registers a school is the primary admin.
--    Primary admins bypass all permission checks (they own the school).
-- ---------------------------------------------------------------------------
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_primary_admin boolean NOT NULL DEFAULT false;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_admins_primary ON admins(school_id, is_primary_admin)
  WHERE is_primary_admin = true;
CREATE INDEX IF NOT EXISTS idx_admins_active ON admins(school_id, is_active)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 2. admin_roles — reusable role templates (e.g. "Stock Manager", "Finance Officer")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

-- ---------------------------------------------------------------------------
-- 3. admin_role_assignments — links admins to their roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, role_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admin_roles_school_id ON admin_roles(school_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_assignments_school_id ON admin_role_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_assignments_admin_id ON admin_role_assignments(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_assignments_role_id ON admin_role_assignments(role_id);

-- ---------------------------------------------------------------------------
-- Triggers for updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_admin_roles_updated_at ON admin_roles;
CREATE TRIGGER set_admin_roles_updated_at BEFORE UPDATE ON admin_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- ---------------------------------------------------------------------------
-- 4. RPC Functions
-- ---------------------------------------------------------------------------

-- Returns true if the current user is a primary (full-access) admin for their school
CREATE OR REPLACE FUNCTION is_primary_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE user_id = auth.uid()
      AND is_active = true
      AND is_primary_admin = true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Returns all permissions for a given admin (union of all their assigned roles)
CREATE OR REPLACE FUNCTION get_admin_permissions(p_admin_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result text[];
BEGIN
  -- First check if the admin is a primary admin — if so, they have all permissions
  IF EXISTS (SELECT 1 FROM admins WHERE id = p_admin_id AND is_primary_admin = true) THEN
    RETURN ARRAY['*']; -- Wildcard = all permissions
  END IF;

  -- Otherwise, aggregate permissions from all assigned roles
  SELECT array_agg(DISTINCT p ORDER BY p) INTO result
  FROM (
    SELECT jsonb_array_elements_text(r.permissions) AS p
    FROM admin_role_assignments a
    JOIN admin_roles r ON r.id = a.role_id AND r.is_active = true
    WHERE a.admin_id = p_admin_id
  ) sub;

  RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$;

-- Check if an admin has a specific permission (by admin record id)
CREATE OR REPLACE FUNCTION check_admin_permission(
  p_admin_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  perms text[];
  ns text;
BEGIN
  perms := get_admin_permissions(p_admin_id);

  -- Wildcard (*) means all permissions
  IF perms @> ARRAY['*'] THEN
    RETURN true;
  END IF;

  -- Direct match
  IF perms @> ARRAY[p_permission] THEN
    RETURN true;
  END IF;

  -- Write implies read: if admin has "namespace:write", allow "namespace:read"
  IF perms @> ARRAY[replace(p_permission, ':read', ':write')] THEN
    RETURN true;
  END IF;

  -- Namespace wildcard: if admin has "inventory:*", allow "inventory:read" and "inventory:write"
  ns := substring(p_permission from '^(.+):');
  IF ns IS NOT NULL THEN
    IF perms @> ARRAY[ns || ':*'] THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- Check if the CURRENT authenticated user has a specific permission
CREATE OR REPLACE FUNCTION check_my_admin_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM admins WHERE user_id = auth.uid() AND is_active = true;
  IF admin_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN check_admin_permission(admin_id, p_permission);
END;
$$;

-- Get all permissions for the current authenticated admin
CREATE OR REPLACE FUNCTION get_my_admin_permissions()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM admins WHERE user_id = auth.uid() AND is_active = true;
  IF admin_id IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  RETURN get_admin_permissions(admin_id);
END;
$$;

-- Get all admin role assignments for a school (with role details)
CREATE OR REPLACE FUNCTION get_school_admin_assignments(p_school_id uuid)
RETURNS TABLE (
  assignment_id uuid,
  admin_id uuid,
  admin_name text,
  admin_email text,
  is_primary_admin boolean,
  is_active boolean,
  role_id uuid,
  role_name varchar(100),
  role_description text,
  role_permissions jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    a.id AS assignment_id,
    a.admin_id,
    adm.name AS admin_name,
    adm.email AS admin_email,
    adm.is_primary_admin,
    adm.is_active,
    r.id AS role_id,
    r.name AS role_name,
    r.description AS role_description,
    r.permissions AS role_permissions,
    a.created_at
  FROM admin_role_assignments a
  JOIN admins adm ON adm.id = a.admin_id
  JOIN admin_roles r ON r.id = a.role_id AND r.is_active = true
  WHERE a.school_id = p_school_id
  ORDER BY adm.name, r.name;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS Policies
-- ---------------------------------------------------------------------------
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_role_assignments ENABLE ROW LEVEL SECURITY;

-- Admin roles: school can read their own roles
DROP POLICY IF EXISTS "Admin roles school read" ON admin_roles;
CREATE POLICY "Admin roles school read"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

-- Admin roles: primary admins and super admins can manage roles
DROP POLICY IF EXISTS "Admin roles primary admin manage" ON admin_roles;
CREATE POLICY "Admin roles primary admin manage"
  ON admin_roles FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_primary_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_primary_admin() AND school_id = get_my_school_id()));

-- Role assignments: school can read their own assignments
DROP POLICY IF EXISTS "Role assignments school read" ON admin_role_assignments;
CREATE POLICY "Role assignments school read"
  ON admin_role_assignments FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

-- Role assignments: primary admins and super admins can manage assignments
DROP POLICY IF EXISTS "Role assignments primary admin manage" ON admin_role_assignments;
CREATE POLICY "Role assignments primary admin manage"
  ON admin_role_assignments FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_primary_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_primary_admin() AND school_id = get_my_school_id()));
