-- =============================================================================
-- Plan Management — Backfill, Change Logging & Audit
--
-- 1. Backfills NULL / invalid plan values to 'basic'
-- 2. Creates a plan_change_log table to track every plan change
-- 3. Creates an atomic change_school_plan() function that updates the plan
--    AND logs the change in a single transaction
-- 4. Provides RPC helpers for querying change history
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Backfill — ensure every existing school has a valid plan
-- =============================================================================
UPDATE schools
SET plan = 'basic'
WHERE plan IS NULL OR plan NOT IN ('basic', 'pro', 'premium');

-- =============================================================================
-- 2. Plan change log table
-- =============================================================================
CREATE TABLE IF NOT EXISTS plan_change_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  old_plan       text NOT NULL CHECK (old_plan IN ('basic', 'pro', 'premium')),
  new_plan       text NOT NULL CHECK (new_plan IN ('basic', 'pro', 'premium')),
  changed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text,
  reason         text DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE plan_change_log IS 'Audit trail for school subscription plan changes';

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_plan_change_school
  ON plan_change_log (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_change_created
  ON plan_change_log (created_at DESC);

-- =============================================================================
-- 3. Atomic plan change function
--    Updates a school's plan AND logs the change in a single transaction.
--    Called by the super admin PATCH API so the audit log correctly captures
--    the authenticated user (avoids auth.uid() being null with service_role).
-- =============================================================================
CREATE OR REPLACE FUNCTION change_school_plan(
  p_school_id uuid,
  p_new_plan  text,
  p_changed_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_plan       text;
  v_changed_by_name text;
  v_school         schools;
  v_result         jsonb;
BEGIN
  -- Validate plan value
  IF p_new_plan NOT IN ('basic', 'pro', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan: %. Must be basic, pro, or premium.', p_new_plan;
  END IF;

  -- Lock the row and get current values
  SELECT plan INTO v_old_plan
  FROM schools
  WHERE id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found: %', p_school_id;
  END IF;

  -- Update the plan
  UPDATE schools
  SET plan = p_new_plan, updated_at = now()
  WHERE id = p_school_id
  RETURNING * INTO v_school;

  -- Log the change if the plan actually changed
  IF v_old_plan IS DISTINCT FROM p_new_plan THEN
    -- Resolve the changer's display name
    SELECT name INTO v_changed_by_name
    FROM admins
    WHERE user_id = p_changed_by AND is_active = true
    LIMIT 1;

    IF v_changed_by_name IS NULL THEN
      v_changed_by_name := 'Super Admin';
    END IF;

    INSERT INTO plan_change_log (school_id, old_plan, new_plan, changed_by, changed_by_name, reason)
    VALUES (p_school_id, COALESCE(v_old_plan, 'basic'), p_new_plan, p_changed_by, v_changed_by_name, 'Changed via super admin');
  END IF;

  -- Return the updated school as JSON
  v_result := jsonb_build_object(
    'id', v_school.id,
    'name', v_school.name,
    'subdomain', v_school.subdomain,
    'address', v_school.address,
    'phone', v_school.phone,
    'email', v_school.email,
    'logo_url', v_school.logo_url,
    'plan', v_school.plan,
    'is_active', v_school.is_active,
    'created_at', v_school.created_at,
    'updated_at', v_school.updated_at
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION change_school_plan TO authenticated;

-- =============================================================================
-- 4. RPC: Get plan change history for a school
-- =============================================================================
CREATE OR REPLACE FUNCTION get_school_plan_changes(p_school_id uuid)
RETURNS TABLE (
  id              uuid,
  old_plan        text,
  new_plan        text,
  changed_by_name text,
  reason          text,
  created_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id,
    old_plan,
    new_plan,
    changed_by_name,
    reason,
    created_at
  FROM plan_change_log
  WHERE school_id = p_school_id
  ORDER BY created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_school_plan_changes TO authenticated;

-- =============================================================================
-- 5. Row-Level Security
-- =============================================================================
ALTER TABLE plan_change_log ENABLE ROW LEVEL SECURITY;

-- Super admins can read all plan changes
DROP POLICY IF EXISTS "Super admins can read all plan changes" ON plan_change_log;
CREATE POLICY "Super admins can read all plan changes"
  ON plan_change_log FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- School admins can read plan changes for their own school
DROP POLICY IF EXISTS "School admins can read their plan changes" ON plan_change_log;
CREATE POLICY "School admins can read their plan changes"
  ON plan_change_log FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

-- =============================================================================
-- 6. Verify integrity
-- =============================================================================
-- Schools without a plan should no longer exist after the backfill
-- (the NOT NULL DEFAULT 'basic' in the original migration handles new rows)

COMMIT;
