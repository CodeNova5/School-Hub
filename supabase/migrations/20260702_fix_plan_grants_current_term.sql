-- =============================================================================
-- Fix create_school_plan_grant — set billing_interval + current_term_id
--
-- Problem:
--   The original function always set billing_interval = 'yearly' even when
--   grant_type = 'term'. It also never set current_term_id, so the admin
--   subscription page couldn't determine which terms were covered/paid.
--
-- Fix:
--   • grant_type = 'term'  → billing_interval = 'termly', set current_term_id
--   • grant_type = 'session' → billing_interval = 'yearly'
--   • grant_type = 'custom' → billing_interval = 'yearly'
-- =============================================================================

BEGIN;

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
  v_old_plan         text;
  v_plan_id          uuid;
  v_grant_id         uuid;
  v_expires_at       timestamptz;
  v_billing_interval text;
  v_subscription     school_subscriptions;
  v_school           schools;
  v_result           jsonb;
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

  -- Determine billing interval based on grant type
  v_billing_interval := CASE p_grant_type
    WHEN 'term'    THEN 'termly'
    WHEN 'session' THEN 'yearly'
    WHEN 'custom'  THEN 'yearly'
    ELSE 'yearly'
  END;

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
  --    Sets current_term_id when grant_type = 'term' so the admin overview
  --    can correctly identify which terms are covered/paid.
  -- =========================================================================
  INSERT INTO school_subscriptions (
    school_id, plan_id, billing_interval,
    status, current_period_start, current_period_end,
    next_billing_date, current_term_id
  ) VALUES (
    p_school_id, v_plan_id, v_billing_interval,
    'active', p_start_date::timestamptz, v_expires_at,
    v_expires_at,
    CASE WHEN p_grant_type = 'term' THEN p_term_id ELSE NULL END
  )
  ON CONFLICT (school_id)
  DO UPDATE SET
    plan_id = v_plan_id,
    billing_interval = CASE
      -- Only update billing_interval for grant types; keep existing otherwise
      WHEN p_grant_type IN ('term', 'session', 'custom') THEN v_billing_interval
      ELSE school_subscriptions.billing_interval
    END,
    status = 'active',
    current_period_start = p_start_date::timestamptz,
    current_period_end = v_expires_at,
    next_billing_date = v_expires_at,
    current_term_id = CASE
      WHEN p_grant_type = 'term' THEN p_term_id
      ELSE school_subscriptions.current_term_id
    END,
    grace_period_ends_at = NULL,
    auth_code = school_subscriptions.auth_code,
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
    'subscription_status', v_subscription.status,
    'billing_interval', v_billing_interval
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION create_school_plan_grant TO authenticated;

COMMIT;
