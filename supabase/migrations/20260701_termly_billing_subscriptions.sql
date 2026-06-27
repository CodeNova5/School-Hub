-- =============================================================================
-- Termly Billing & Stored Authorization — School Subscription Rework
--
-- Changes:
-- 1. Add termly_price to subscription_plans
-- 2. Add stored auth columns to school_subscriptions (auth_code, customer_email,
--    next_billing_date, grace_period_ends_at, current_term_id)
-- 3. Update billing_interval CHECK to include 'termly'
-- 4. Seed termly prices
-- 5. Update RPCs to support new fields
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Add termly_price to subscription_plans
-- =============================================================================
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS termly_price numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN subscription_plans.termly_price IS 'Price per academic term (3 terms per year). Replaces monthly_price for termly billing.';

-- =============================================================================
-- 2. Seed termly prices (termly = yearly_price / 3, rounded sensibly)
-- =============================================================================
UPDATE subscription_plans SET
  termly_price = CASE plan_key
    WHEN 'basic'   THEN 0
    WHEN 'pro'     THEN 99700   -- 299000 / 3
    WHEN 'premium' THEN 233000  -- 699000 / 3
  END
WHERE termly_price = 0;

-- =============================================================================
-- 3. Alter school_subscriptions for termly billing + stored auth codes
-- =============================================================================

-- First, drop the existing CHECK constraint on billing_interval
ALTER TABLE school_subscriptions
  DROP CONSTRAINT IF EXISTS school_subscriptions_billing_interval_check;

-- Add the updated constraint including 'termly'
ALTER TABLE school_subscriptions
  ADD CONSTRAINT school_subscriptions_billing_interval_check
  CHECK (billing_interval IN ('monthly', 'yearly', 'termly'));

-- Add stored authorization columns
ALTER TABLE school_subscriptions
  ADD COLUMN IF NOT EXISTS auth_code        text,
  ADD COLUMN IF NOT EXISTS customer_email   text,
  ADD COLUMN IF NOT EXISTS customer_code    text,
  ADD COLUMN IF NOT EXISTS next_billing_date timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_term_id  uuid REFERENCES terms(id) ON DELETE SET NULL;

COMMENT ON COLUMN school_subscriptions.auth_code IS 'Stored Paystack authorization_code for recurring termly charges (AUTH_xxxxx)';
COMMENT ON COLUMN school_subscriptions.customer_email IS 'Email used for Paystack customer creation';
COMMENT ON COLUMN school_subscriptions.customer_code IS 'Paystack customer code (CUS_xxxxx)';
COMMENT ON COLUMN school_subscriptions.next_billing_date IS 'When the next termly/yearly charge should be attempted';
COMMENT ON COLUMN school_subscriptions.grace_period_ends_at IS 'End of grace period after a failed payment — after this, features are locked';
COMMENT ON COLUMN school_subscriptions.current_term_id IS 'The academic term this subscription is currently covering';

CREATE INDEX IF NOT EXISTS idx_school_subs_next_billing ON school_subscriptions(next_billing_date)
  WHERE status = 'active' AND next_billing_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_subs_grace_period ON school_subscriptions(grace_period_ends_at)
  WHERE status = 'past_due';

-- =============================================================================
-- 4. Update get_subscription_plans RPC to include termly_price
--    (Replaces the version that was updated in 20260629)
-- =============================================================================

DROP FUNCTION IF EXISTS get_subscription_plans();

CREATE OR REPLACE FUNCTION get_subscription_plans()
RETURNS TABLE (
  id              uuid,
  plan_key        text,
  name            text,
  description     text,
  monthly_price   numeric,
  yearly_price    numeric,
  termly_price    numeric,
  monthly_paystack_plan_code text,
  yearly_paystack_plan_code  text,
  is_active       boolean,
  sort_order      integer,
  label_short     text,
  color_tailwind  text,
  badge_color_tailwind text,
  price_hint      text,
  border_color_tailwind text,
  icon_bg_tailwind      text,
  features        jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.plan_key,
    p.name,
    p.description,
    p.monthly_price,
    p.yearly_price,
    p.termly_price,
    p.monthly_paystack_plan_code,
    p.yearly_paystack_plan_code,
    p.is_active,
    p.sort_order,
    p.label_short,
    p.color_tailwind,
    p.badge_color_tailwind,
    p.price_hint,
    p.border_color_tailwind,
    p.icon_bg_tailwind,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'feature_key', f.feature_key,
          'is_enabled', f.is_enabled
        )
        ORDER BY f.feature_key
      ) FILTER (WHERE f.id IS NOT NULL),
      '[]'::jsonb
    ) AS features
  FROM subscription_plans p
  LEFT JOIN subscription_plan_features f ON f.plan_id = p.id
  GROUP BY p.id, p.plan_key, p.name, p.description,
           p.monthly_price, p.yearly_price, p.termly_price,
           p.monthly_paystack_plan_code, p.yearly_paystack_plan_code,
           p.is_active, p.sort_order,
           p.label_short, p.color_tailwind, p.badge_color_tailwind, p.price_hint,
           p.border_color_tailwind, p.icon_bg_tailwind
  ORDER BY p.sort_order;
$$;

GRANT EXECUTE ON FUNCTION get_subscription_plans TO authenticated;

-- =============================================================================
-- 5. Replace update_subscription_plan to include termly_price
-- =============================================================================

DROP FUNCTION IF EXISTS update_subscription_plan(uuid, text, text, numeric, numeric, boolean, text, text, text, text, text, text, text, text);

DROP FUNCTION IF EXISTS update_subscription_plan(
  p_plan_id uuid,
  p_name text,
  p_description text,
  p_monthly_price numeric,
  p_yearly_price numeric,
  p_is_active boolean,
  p_monthly_paystack_plan_code text,
  p_yearly_paystack_plan_code text,
  p_label_short text,
  p_color_tailwind text,
  p_badge_color_tailwind text,
  p_price_hint text,
  p_border_color_tailwind text,
  p_icon_bg_tailwind text
);

CREATE OR REPLACE FUNCTION update_subscription_plan(
  p_plan_id       uuid,
  p_name          text DEFAULT NULL,
  p_description   text DEFAULT NULL,
  p_monthly_price numeric DEFAULT NULL,
  p_yearly_price  numeric DEFAULT NULL,
  p_termly_price  numeric DEFAULT NULL,
  p_is_active     boolean DEFAULT NULL,
  p_monthly_paystack_plan_code text DEFAULT NULL,
  p_yearly_paystack_plan_code  text DEFAULT NULL,
  p_label_short          text DEFAULT NULL,
  p_color_tailwind       text DEFAULT NULL,
  p_badge_color_tailwind text DEFAULT NULL,
  p_price_hint           text DEFAULT NULL,
  p_border_color_tailwind text DEFAULT NULL,
  p_icon_bg_tailwind      text DEFAULT NULL
)
RETURNS subscription_plans
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result subscription_plans;
BEGIN
  UPDATE subscription_plans
  SET
    name        = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    monthly_price = COALESCE(p_monthly_price, monthly_price),
    yearly_price  = COALESCE(p_yearly_price, yearly_price),
    termly_price  = COALESCE(p_termly_price, termly_price),
    is_active   = COALESCE(p_is_active, is_active),
    monthly_paystack_plan_code = COALESCE(p_monthly_paystack_plan_code, monthly_paystack_plan_code),
    yearly_paystack_plan_code  = COALESCE(p_yearly_paystack_plan_code, yearly_paystack_plan_code),
    label_short          = COALESCE(p_label_short, label_short),
    color_tailwind       = COALESCE(p_color_tailwind, color_tailwind),
    badge_color_tailwind = COALESCE(p_badge_color_tailwind, badge_color_tailwind),
    price_hint           = COALESCE(p_price_hint, price_hint),
    border_color_tailwind = COALESCE(p_border_color_tailwind, border_color_tailwind),
    icon_bg_tailwind      = COALESCE(p_icon_bg_tailwind, icon_bg_tailwind),
    updated_at  = now()
  WHERE id = p_plan_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_subscription_plan TO authenticated;

-- =============================================================================
-- 6. Replace get_school_subscription to include new fields
-- =============================================================================

DROP FUNCTION IF EXISTS get_school_subscription(uuid);

CREATE OR REPLACE FUNCTION get_school_subscription(p_school_id uuid)
RETURNS TABLE (
  id                    uuid,
  school_id             uuid,
  plan_id               uuid,
  billing_interval      text,
  status                text,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  next_billing_date     timestamptz,
  grace_period_ends_at  timestamptz,
  auth_code             text,
  customer_email        text,
  customer_code         text,
  current_term_id       uuid,
  plan_key              text,
  plan_name             text,
  monthly_price         numeric,
  yearly_price          numeric,
  termly_price          numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    s.id,
    s.school_id,
    s.plan_id,
    s.billing_interval,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.next_billing_date,
    s.grace_period_ends_at,
    s.auth_code,
    s.customer_email,
    s.customer_code,
    s.current_term_id,
    p.plan_key,
    p.name AS plan_name,
    p.monthly_price,
    p.yearly_price,
    p.termly_price
  FROM school_subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.school_id = p_school_id;
$$;

GRANT EXECUTE ON FUNCTION get_school_subscription TO authenticated;

-- =============================================================================
-- 7. Replace upsert_school_subscription to include new fields
-- =============================================================================

DROP FUNCTION IF EXISTS upsert_school_subscription(uuid, uuid, text, text, text, text, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION upsert_school_subscription(
  p_school_id               uuid,
  p_plan_id                 uuid,
  p_billing_interval        text,
  p_paystack_subscription_code text DEFAULT NULL,
  p_paystack_customer_code  text DEFAULT NULL,
  p_status                  text DEFAULT 'active',
  p_current_period_start    timestamptz DEFAULT NULL,
  p_current_period_end      timestamptz DEFAULT NULL,
  p_auth_code               text DEFAULT NULL,
  p_customer_email          text DEFAULT NULL,
  p_next_billing_date       timestamptz DEFAULT NULL,
  p_grace_period_ends_at    timestamptz DEFAULT NULL,
  p_current_term_id         uuid DEFAULT NULL
)
RETURNS school_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result school_subscriptions;
BEGIN
  INSERT INTO school_subscriptions (
    school_id, plan_id, billing_interval,
    paystack_subscription_code, paystack_customer_code,
    status, current_period_start, current_period_end,
    auth_code, customer_email, customer_code,
    next_billing_date, grace_period_ends_at, current_term_id
  ) VALUES (
    p_school_id, p_plan_id, p_billing_interval,
    p_paystack_subscription_code, p_paystack_customer_code,
    p_status, p_current_period_start, p_current_period_end,
    p_auth_code, p_customer_email, p_paystack_customer_code,
    p_next_billing_date, p_grace_period_ends_at, p_current_term_id
  )
  ON CONFLICT (school_id)
  DO UPDATE SET
    plan_id = p_plan_id,
    billing_interval = p_billing_interval,
    paystack_subscription_code = COALESCE(p_paystack_subscription_code, school_subscriptions.paystack_subscription_code),
    paystack_customer_code = COALESCE(p_paystack_customer_code, school_subscriptions.paystack_customer_code),
    status = p_status,
    current_period_start = COALESCE(p_current_period_start, school_subscriptions.current_period_start),
    current_period_end = COALESCE(p_current_period_end, school_subscriptions.current_period_end),
    auth_code = COALESCE(p_auth_code, school_subscriptions.auth_code),
    customer_email = COALESCE(p_customer_email, school_subscriptions.customer_email),
    customer_code = COALESCE(p_paystack_customer_code, school_subscriptions.customer_code),
    next_billing_date = COALESCE(p_next_billing_date, school_subscriptions.next_billing_date),
    grace_period_ends_at = COALESCE(p_grace_period_ends_at, school_subscriptions.grace_period_ends_at),
    current_term_id = COALESCE(p_current_term_id, school_subscriptions.current_term_id),
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_school_subscription TO authenticated;

-- =============================================================================
-- 8. New RPC: End current subscription period and start grace period
-- =============================================================================
CREATE OR REPLACE FUNCTION expire_school_subscription(
  p_school_id uuid,
  p_grace_days integer DEFAULT 7
)
RETURNS school_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result school_subscriptions;
BEGIN
  UPDATE school_subscriptions
  SET
    status = 'past_due',
    current_period_end = now(),
    grace_period_ends_at = now() + (p_grace_days || ' days')::interval,
    updated_at = now()
  WHERE school_id = p_school_id
    AND status = 'active'
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_school_subscription TO authenticated;

-- =============================================================================
-- 9. New RPC: Renew subscription (after successful payment via stored auth)
-- =============================================================================
CREATE OR REPLACE FUNCTION renew_school_subscription(
  p_school_id        uuid,
  p_plan_id          uuid DEFAULT NULL,
  p_billing_interval text DEFAULT NULL,
  p_next_billing_date timestamptz DEFAULT NULL,
  p_current_term_id  uuid DEFAULT NULL,
  p_auth_code        text DEFAULT NULL
)
RETURNS school_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result school_subscriptions;
  v_term_id uuid;
BEGIN
  v_term_id := COALESCE(p_current_term_id, (
    SELECT id FROM terms
    WHERE school_id = p_school_id AND is_current = true
    LIMIT 1
  ));

  UPDATE school_subscriptions
  SET
    status = 'active',
    current_period_start = now(),
    current_period_end = p_next_billing_date,
    next_billing_date = p_next_billing_date,
    grace_period_ends_at = NULL,
    current_term_id = v_term_id,
    auth_code = COALESCE(p_auth_code, school_subscriptions.auth_code),
    plan_id = COALESCE(p_plan_id, school_subscriptions.plan_id),
    billing_interval = COALESCE(p_billing_interval, school_subscriptions.billing_interval),
    updated_at = now()
  WHERE school_id = p_school_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION renew_school_subscription TO authenticated;

-- =============================================================================
-- 10. New RPC: Check if a school is past_due and should be degraded
-- =============================================================================
CREATE OR REPLACE FUNCTION check_school_subscription_status(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_sub school_subscriptions;
  v_should_degrade boolean := false;
  v_degrade_reason text := '';
BEGIN
  SELECT * INTO v_sub FROM school_subscriptions WHERE school_id = p_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'none',
      'should_degrade', false,
      'message', 'No subscription record found'
    );
  END IF;

  -- Check if grace period has expired
  IF v_sub.status = 'past_due' AND v_sub.grace_period_ends_at IS NOT NULL THEN
    IF now() > v_sub.grace_period_ends_at THEN
      v_should_degrade := true;
      v_degrade_reason := 'Grace period ended. Payment required to restore access.';
    ELSE
      v_degrade_reason := 'Payment past due. Grace period until ' || v_sub.grace_period_ends_at::text;
    END IF;
  END IF;

  -- Check if subscription has expired
  IF v_sub.status = 'expired' THEN
    v_should_degrade := true;
    v_degrade_reason := 'Subscription has expired. Renew to restore access.';
  END IF;

  -- Check if period has ended (for fixed-period subscriptions without renewal)
  IF v_sub.status = 'active'
     AND v_sub.current_period_end IS NOT NULL
     AND now() > v_sub.current_period_end THEN
    v_should_degrade := true;
    v_degrade_reason := 'Billing period has ended. Renewal payment required.';
  END IF;

  RETURN jsonb_build_object(
    'status', v_sub.status,
    'should_degrade', v_should_degrade,
    'degrade_reason', v_degrade_reason,
    'plan_id', v_sub.plan_id,
    'billing_interval', v_sub.billing_interval,
    'next_billing_date', v_sub.next_billing_date,
    'grace_period_ends_at', v_sub.grace_period_ends_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_school_subscription_status TO authenticated;

-- =============================================================================
-- 11. Update the check_school_feature_access function to account for
--     grace period and degraded status
-- =============================================================================

CREATE OR REPLACE FUNCTION check_school_feature_access(
  p_school_id   uuid,
  p_feature_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       text;
  v_has_access boolean;
  v_sub_status text;
  v_grace_ends timestamptz;
  v_reason     text := '';
BEGIN
  -- Get the school's plan and subscription status
  SELECT s.plan, sub.status, sub.grace_period_ends_at
  INTO v_plan, v_sub_status, v_grace_ends
  FROM schools s
  LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
  WHERE s.id = p_school_id;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('has_access', false, 'current_plan', 'basic', 'reason', 'School not found');
  END IF;

  -- Check subscription status for degraded access
  IF v_sub_status = 'expired' THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'current_plan', 'basic',
      'reason', 'Subscription expired',
      'subscription_status', 'expired'
    );
  END IF;

  -- During grace period: allow access but flag as past_due
  IF v_sub_status = 'past_due' THEN
    IF v_grace_ends IS NOT NULL AND now() > v_grace_ends THEN
      -- Grace period expired — degrade to Basic
      RETURN jsonb_build_object(
        'has_access', false,
        'current_plan', 'basic',
        'reason', 'Subscription payment past due. Grace period has ended.',
        'subscription_status', 'past_due',
        'grace_expired', true
      );
    ELSE
      -- Still within grace period — allow access
      v_reason := 'Payment past due. Grace period ends ' || COALESCE(v_grace_ends::text, 'soon');
    END IF;
  END IF;

  -- Basic plan has no paid features
  IF v_plan = 'basic' THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'current_plan', 'basic',
      'reason', v_reason,
      'subscription_status', v_sub_status
    );
  END IF;

  -- Premium has everything
  IF v_plan = 'premium' THEN
    RETURN jsonb_build_object(
      'has_access', true,
      'current_plan', 'premium',
      'reason', v_reason,
      'subscription_status', v_sub_status
    );
  END IF;

  -- Pro: check subscription_plan_features (DB config set by super admin)
  SELECT f.is_enabled INTO v_has_access
  FROM subscription_plan_features f
  JOIN subscription_plans p ON p.id = f.plan_id
  WHERE p.plan_key = v_plan AND f.feature_key = p_feature_key;

  IF NOT FOUND THEN
    -- Fallback: Pro has pro features (backward compat before DB config is set)
    v_has_access := p_feature_key IN (
      'finance', 'payroll', 'notifications', 'calendar', 'families',
      'assignments', 'subject_analytics', 'parents_guardians',
      'student_id_cards', 'teacher_id_cards'
    );
  END IF;

  RETURN jsonb_build_object(
    'has_access', v_has_access,
    'current_plan', v_plan,
    'reason', v_reason,
    'subscription_status', v_sub_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_school_feature_access TO authenticated;

-- =============================================================================
-- 12. New RPC: Force downgrade a school to Basic (e.g., after grace period expiry)
-- =============================================================================
CREATE OR REPLACE FUNCTION downgrade_school_to_basic(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_basic_plan_id uuid;
BEGIN
  -- Get the basic plan ID
  SELECT id INTO v_basic_plan_id FROM subscription_plans WHERE plan_key = 'basic';

  -- Update subscription
  UPDATE school_subscriptions
  SET
    status = 'expired',
    plan_id = v_basic_plan_id,
    updated_at = now()
  WHERE school_id = p_school_id AND status IN ('past_due', 'expired');

  -- Update school plan to Basic
  UPDATE schools SET plan = 'basic', updated_at = now() WHERE id = p_school_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION downgrade_school_to_basic TO authenticated;

-- =============================================================================
-- 13. New RPC: Find schools with expired grace periods (for cron job)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_expired_grace_period_schools()
RETURNS TABLE (
  school_id uuid,
  school_name text,
  school_email text,
  grace_ended_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    s.id,
    s.name,
    s.email,
    sub.grace_period_ends_at
  FROM school_subscriptions sub
  JOIN schools s ON s.id = sub.school_id
  WHERE sub.status = 'past_due'
    AND sub.grace_period_ends_at IS NOT NULL
    AND sub.grace_period_ends_at < now();
$$;

GRANT EXECUTE ON FUNCTION get_expired_grace_period_schools TO authenticated;

-- =============================================================================
-- 14. New RPC: Find schools due for billing (for cron job)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_schools_due_for_billing()
RETURNS TABLE (
  school_id         uuid,
  school_name       text,
  school_email      text,
  plan_id           uuid,
  plan_key          text,
  billing_interval  text,
  auth_code         text,
  customer_email    text,
  customer_code     text,
  amount            numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    s.id,
    s.name,
    s.email,
    sub.plan_id,
    p.plan_key,
    sub.billing_interval,
    sub.auth_code,
    sub.customer_email,
    sub.customer_code,
    CASE sub.billing_interval
      WHEN 'termly' THEN p.termly_price
      WHEN 'yearly' THEN p.yearly_price
      ELSE p.monthly_price
    END AS amount
  FROM school_subscriptions sub
  JOIN schools s ON s.id = sub.school_id
  JOIN subscription_plans p ON p.id = sub.plan_id
  WHERE sub.status = 'active'
    AND sub.auth_code IS NOT NULL
    AND sub.next_billing_date IS NOT NULL
    AND sub.next_billing_date <= now();
$$;

GRANT EXECUTE ON FUNCTION get_schools_due_for_billing TO authenticated;

-- =============================================================================
-- 15. Create school_subscription_transactions table for tracking subscription payments
-- =============================================================================
CREATE TABLE IF NOT EXISTS school_subscription_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  billing_interval text NOT NULL CHECK (billing_interval IN ('termly', 'yearly')),
  reference       text NOT NULL UNIQUE,
  amount          numeric(10,2) NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
  auth_code       text,
  paid_at         timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE school_subscription_transactions IS 'Tracks subscription payment transactions for school plan purchases';

CREATE INDEX IF NOT EXISTS idx_sub_tx_school ON school_subscription_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_sub_tx_reference ON school_subscription_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_sub_tx_status ON school_subscription_transactions(status);

DROP TRIGGER IF EXISTS set_sub_tx_updated_at ON school_subscription_transactions;
CREATE TRIGGER set_sub_tx_updated_at BEFORE UPDATE ON school_subscription_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE school_subscription_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School subscription transactions read own" ON school_subscription_transactions;
CREATE POLICY "School subscription transactions read own"
  ON school_subscription_transactions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "School subscription transactions super admin manage" ON school_subscription_transactions;
CREATE POLICY "School subscription transactions super admin manage"
  ON school_subscription_transactions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

COMMIT;
