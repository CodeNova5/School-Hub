-- =============================================================================
-- School Plan Grants — Manual plan assignment for cash/direct payment scenarios
--
-- When an admin pays cash or transfers directly for a feature, the super admin
-- can manually grant a school access to Pro or Premium for a specific duration:
--   • Term   — covers a single academic term
--   • Session— covers an entire academic session (all terms + breaks)
--   • Custom — arbitrary date range
--
-- Each grant updates the school's plan and subscription record so the existing
-- feature-gating infrastructure (check_school_feature_access) works transparently.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. school_plan_grants — audit trail for manual grants
-- =============================================================================
CREATE TABLE IF NOT EXISTS school_plan_grants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_key          text NOT NULL CHECK (plan_key IN ('pro', 'premium')),
  grant_type        text NOT NULL CHECK (grant_type IN ('term', 'session', 'custom')),
  term_id           uuid REFERENCES terms(id) ON DELETE SET NULL,
  session_id        uuid REFERENCES sessions(id) ON DELETE SET NULL,
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  include_holidays  boolean NOT NULL DEFAULT true,
  notes             text DEFAULT '',
  granted_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_by_name   text NOT NULL DEFAULT 'Super Admin',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,

  -- Ensure start < end
  CONSTRAINT school_plan_grants_dates_check CHECK (start_date <= end_date)
);

COMMENT ON TABLE school_plan_grants IS 'Records manual plan grants by super admins (cash/direct payment scenarios)';
COMMENT ON COLUMN school_plan_grants.grant_type IS 'term = single term, session = full academic year, custom = arbitrary range';
COMMENT ON COLUMN school_plan_grants.include_holidays IS 'Whether the grant covers holiday breaks between terms within the period';
COMMENT ON COLUMN school_plan_grants.expires_at IS 'Timestamp when the grant period ends (end_date + 1 day at 23:59:59)';

CREATE INDEX IF NOT EXISTS idx_school_plan_grants_school ON school_plan_grants(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_school_plan_grants_expires ON school_plan_grants(expires_at)
  WHERE is_active = true;

-- =============================================================================
-- 2. RPC: Create a manual plan grant
--    • Inserts the grant record
--    • Updates the school's plan
--    • Upserts the school_subscription with the period dates
--    • Logs the plan change
--    All in a single transaction.
-- =============================================================================
CREATE OR REPLACE FUNCTION create_school_plan_grant(
  p_school_id         uuid,
  p_plan_key          text,
  p_grant_type        text,
  p_start_date        date,
  p_end_date          date,
  p_include_holidays  boolean DEFAULT true,
  p_notes             text DEFAULT '',
  p_term_id           uuid DEFAULT NULL,
  p_session_id        uuid DEFAULT NULL,
  p_granted_by        uuid DEFAULT auth.uid(),
  p_granted_by_name   text DEFAULT 'Super Admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_plan      text;
  v_plan_id       uuid;
  v_grant_id      uuid;
  v_expires_at    timestamptz;
  v_subscription  school_subscriptions;
  v_school        schools;
  v_result        jsonb;
BEGIN
  -- Validate plan
  IF p_plan_key NOT IN ('pro', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan key: %. Must be pro or premium.', p_plan_key;
  END IF;

  -- Get the subscription_plans id for this plan
  SELECT id INTO v_plan_id FROM subscription_plans WHERE plan_key = p_plan_key;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan "%" not found in subscription_plans table.', p_plan_key;
  END IF;

  -- Calculate expires_at (end of day on end_date)
  v_expires_at := (p_end_date + interval '1 day' - interval '1 second')::timestamptz;

  -- Lock the school row
  SELECT plan INTO v_old_plan FROM schools WHERE id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found: %', p_school_id;
  END IF;

  -- =========================================================================
  -- 1. Insert the grant record
  -- =========================================================================
  INSERT INTO school_plan_grants (
    school_id, plan_key, grant_type,
    term_id, session_id,
    start_date, end_date, include_holidays,
    notes, granted_by, granted_by_name,
    expires_at
  ) VALUES (
    p_school_id, p_plan_key, p_grant_type,
    p_term_id, p_session_id,
    p_start_date, p_end_date, p_include_holidays,
    p_notes, p_granted_by, p_granted_by_name,
    v_expires_at
  )
  RETURNING id INTO v_grant_id;

  -- =========================================================================
  -- 2. Update school plan
  -- =========================================================================
  UPDATE schools
  SET plan = p_plan_key, updated_at = now()
  WHERE id = p_school_id
  RETURNING * INTO v_school;

  -- =========================================================================
  -- 3. Upsert school_subscription with the granted period
  -- =========================================================================
  INSERT INTO school_subscriptions (
    school_id, plan_id, billing_interval,
    status, current_period_start, current_period_end,
    next_billing_date
  ) VALUES (
    p_school_id, v_plan_id, 'yearly',  -- yearly billing to match period
    'active', p_start_date::timestamptz, v_expires_at,
    v_expires_at
  )
  ON CONFLICT (school_id)
  DO UPDATE SET
    plan_id = v_plan_id,
    billing_interval = 'yearly',
    status = 'active',
    current_period_start = p_start_date::timestamptz,
    current_period_end = v_expires_at,
    next_billing_date = v_expires_at,
    grace_period_ends_at = NULL,
    auth_code = COALESCE(school_subscriptions.auth_code, school_subscriptions.auth_code),
    updated_at = now()
  RETURNING * INTO v_subscription;

  -- =========================================================================
  -- 4. Log the plan change in plan_change_log
  -- =========================================================================
  INSERT INTO plan_change_log (school_id, old_plan, new_plan, changed_by, changed_by_name, reason)
  VALUES (
    p_school_id,
    COALESCE(v_old_plan, 'basic'),
    p_plan_key,
    p_granted_by,
    p_granted_by_name,
    'Manual grant: ' || p_grant_type || ' (' || p_start_date || ' → ' || p_end_date || ')'
  );

  -- =========================================================================
  -- 5. Build result
  -- =========================================================================
  v_result := jsonb_build_object(
    'grant_id', v_grant_id,
    'school_id', v_school.id,
    'school_name', v_school.name,
    'plan', v_school.plan,
    'old_plan', v_old_plan,
    'grant_type', p_grant_type,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'expires_at', v_expires_at,
    'subscription_id', v_subscription.id,
    'subscription_status', v_subscription.status
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION create_school_plan_grant TO authenticated;

-- =============================================================================
-- 3. RPC: List all plan grants (with school name)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_school_plan_grants(
  p_school_id uuid DEFAULT NULL,
  p_active_only boolean DEFAULT false
)
RETURNS TABLE (
  id                uuid,
  school_id         uuid,
  school_name       text,
  plan_key          text,
  grant_type        text,
  start_date        date,
  end_date          date,
  include_holidays  boolean,
  notes             text,
  granted_by_name   text,
  is_active         boolean,
  expires_at        timestamptz,
  created_at        timestamptz,
  term_name         text,
  session_name      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    g.id,
    g.school_id,
    s.name AS school_name,
    g.plan_key,
    g.grant_type,
    g.start_date,
    g.end_date,
    g.include_holidays,
    g.notes,
    g.granted_by_name,
    g.is_active,
    g.expires_at,
    g.created_at,
    t.name AS term_name,
    sess.name AS session_name
  FROM school_plan_grants g
  JOIN schools s ON s.id = g.school_id
  LEFT JOIN terms t ON t.id = g.term_id
  LEFT JOIN sessions sess ON sess.id = g.session_id
  WHERE (p_school_id IS NULL OR g.school_id = p_school_id)
    AND (p_active_only = false OR g.is_active = true)
  ORDER BY g.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_school_plan_grants TO authenticated;

-- =============================================================================
-- 4. RPC: Expire a specific plan grant (mark is_active = false)
-- =============================================================================
CREATE OR REPLACE FUNCTION expire_school_plan_grant(p_grant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id uuid;
  v_plan_key  text;
BEGIN
  SELECT school_id, plan_key INTO v_school_id, v_plan_key
  FROM school_plan_grants
  WHERE id = p_grant_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Mark the grant as inactive
  UPDATE school_plan_grants SET is_active = false WHERE id = p_grant_id;

  -- Check if there are any other active grants for this school
  -- If not, and the school's plan matches the grant's plan, downgrade to basic
  IF NOT EXISTS (
    SELECT 1 FROM school_plan_grants
    WHERE school_id = v_school_id AND is_active = true
  ) THEN
    -- Downgrade to basic since no other grants are active
    PERFORM downgrade_school_to_basic(v_school_id);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_school_plan_grant TO authenticated;

-- =============================================================================
-- 5. RPC: Check and expire grants that have passed their expires_at
-- =============================================================================
CREATE OR REPLACE FUNCTION expire_past_plan_grants()
RETURNS TABLE (
  grant_id     uuid,
  school_id    uuid,
  school_name  text,
  plan_key     text,
  expired_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_grant RECORD;
BEGIN
  FOR v_grant IN
    SELECT g.id, g.school_id, g.plan_key, s.name AS school_name, g.expires_at
    FROM school_plan_grants g
    JOIN schools s ON s.id = g.school_id
    WHERE g.is_active = true AND g.expires_at < now()
  LOOP
    -- Mark grant as inactive
    UPDATE school_plan_grants SET is_active = false WHERE id = v_grant.id;

    -- Check if any other active grant exists for this school
    IF NOT EXISTS (
      SELECT 1 FROM school_plan_grants
      WHERE school_id = v_grant.school_id AND is_active = true
    ) THEN
      PERFORM downgrade_school_to_basic(v_grant.school_id);
    END IF;

    grant_id := v_grant.id;
    school_id := v_grant.school_id;
    school_name := v_grant.school_name;
    plan_key := v_grant.plan_key;
    expired_at := v_grant.expires_at;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_past_plan_grants TO authenticated;

-- =============================================================================
-- 6. RLS
-- =============================================================================
ALTER TABLE school_plan_grants ENABLE ROW LEVEL SECURITY;

-- Super admins can read all grants
DROP POLICY IF EXISTS "Super admins manage plan grants" ON school_plan_grants;
CREATE POLICY "Super admins manage plan grants"
  ON school_plan_grants FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Schools can read their own grants
DROP POLICY IF EXISTS "Schools read own grants" ON school_plan_grants;
CREATE POLICY "Schools read own grants"
  ON school_plan_grants FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

COMMIT;
