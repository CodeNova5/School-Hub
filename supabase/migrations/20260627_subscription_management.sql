-- =============================================================================
-- Subscription Management — Plan configuration, Paystack integration, school subs
--
-- 1. subscription_plans — stores plan definitions with Paystack plan codes
-- 2. subscription_plan_features — customizable feature-to-plan mapping
-- 3. school_subscriptions — tracks each school's active subscription
-- 4. Seed the default plans (Basic, Pro, Premium)
-- 5. RPC functions for managing plans & features
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. subscription_plans — plan definitions with pricing
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key    text NOT NULL UNIQUE CHECK (plan_key IN ('basic', 'pro', 'premium')),
  name        text NOT NULL,
  description text DEFAULT '',
  monthly_price  numeric(10,2) NOT NULL DEFAULT 0,
  yearly_price   numeric(10,2) NOT NULL DEFAULT 0,
  monthly_paystack_plan_code  text,
  yearly_paystack_plan_code   text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subscription_plans IS 'Defines the available subscription plans and their Paystack integration codes';
COMMENT ON COLUMN subscription_plans.monthly_paystack_plan_code IS 'Paystack plan code for monthly billing (e.g., PLN_xxxx)';
COMMENT ON COLUMN subscription_plans.yearly_paystack_plan_code IS 'Paystack plan code for yearly billing (e.g., PLN_xxxx)';

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active, sort_order);

-- =============================================================================
-- 2. subscription_plan_features — customizable feature-to-plan mapping
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscription_plan_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

COMMENT ON TABLE subscription_plan_features IS 'Maps features to plans — super admin can enable/disable per plan';

CREATE INDEX IF NOT EXISTS idx_sub_plan_features_plan ON subscription_plan_features(plan_id);

-- =============================================================================
-- 3. school_subscriptions — tracks each school's active subscription
-- =============================================================================
CREATE TABLE IF NOT EXISTS school_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id       uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  paystack_subscription_code text,
  paystack_customer_code    text,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'past_due', 'cancelled', 'expired', 'trialing')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id)
);

COMMENT ON TABLE school_subscriptions IS 'Tracks the active subscription for each school';
COMMENT ON COLUMN school_subscriptions.paystack_subscription_code IS 'Paystack subscription code for managing the recurring payment';
COMMENT ON COLUMN school_subscriptions.paystack_customer_code IS 'Paystack customer code for the school';

CREATE INDEX IF NOT EXISTS idx_school_subs_school ON school_subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_school_subs_status ON school_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_school_subs_paystack ON school_subscriptions(paystack_subscription_code);

-- =============================================================================
-- 4. Seed default plans
-- =============================================================================
INSERT INTO subscription_plans (plan_key, name, description, monthly_price, yearly_price, is_active, sort_order)
VALUES
  ('basic', 'Basic', 'Core school management — everything a school needs to operate', 0, 0, true, 1),
  ('pro', 'Pro', 'Growth & engagement features for medium-to-large schools', 29900, 299000, true, 2),
  ('premium', 'Premium', 'Full competitive advantage with all premium features', 69900, 699000, true, 3)
ON CONFLICT (plan_key) DO NOTHING;

-- Seed default feature mappings (mirrors the existing FEATURE_PLAN_MAP from TypeScript)
DO $$
DECLARE
  v_pro_id     uuid;
  v_premium_id uuid;
BEGIN
  SELECT id INTO v_pro_id     FROM subscription_plans WHERE plan_key = 'pro';
  SELECT id INTO v_premium_id FROM subscription_plans WHERE plan_key = 'premium';

  -- Pro features
  INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled) VALUES
    (v_pro_id, 'finance', true),
    (v_pro_id, 'payroll', true),
    (v_pro_id, 'notifications', true),
    (v_pro_id, 'calendar', true),
    (v_pro_id, 'families', true),
    (v_pro_id, 'assignments', true),
    (v_pro_id, 'subject_analytics', true),
    (v_pro_id, 'parents_guardians', true),
    (v_pro_id, 'student_id_cards', true),
    (v_pro_id, 'teacher_id_cards', true)
  ON CONFLICT (plan_id, feature_key) DO NOTHING;

  -- Premium features
  INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled) VALUES
    (v_premium_id, 'ai_assistant', true),
    (v_premium_id, 'website_builder', true),
    (v_premium_id, 'jamb_cbt', true),
    (v_premium_id, 'question_bank', true),
    (v_premium_id, 'live_classes', true),
    (v_premium_id, 'lesson_notes', true),
    (v_premium_id, 'admissions', true),
    (v_premium_id, 'alumni', true),
    (v_premium_id, 'audit_trail', true)
  ON CONFLICT (plan_id, feature_key) DO NOTHING;

  -- Also enable ALL pro features for premium (premium includes everything)
  INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled)
  SELECT v_premium_id, feature_key, true
  FROM subscription_plan_features
  WHERE plan_id = v_pro_id
  ON CONFLICT (plan_id, feature_key) DO NOTHING;
END $$;

-- =============================================================================
-- 5. RPC: Get all plans with their features
-- =============================================================================
CREATE OR REPLACE FUNCTION get_subscription_plans()
RETURNS TABLE (
  id              uuid,
  plan_key        text,
  name            text,
  description     text,
  monthly_price   numeric,
  yearly_price    numeric,
  monthly_paystack_plan_code text,
  yearly_paystack_plan_code  text,
  is_active       boolean,
  sort_order      integer,
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
    p.monthly_paystack_plan_code,
    p.yearly_paystack_plan_code,
    p.is_active,
    p.sort_order,
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
           p.monthly_price, p.yearly_price,
           p.monthly_paystack_plan_code, p.yearly_paystack_plan_code,
           p.is_active, p.sort_order
  ORDER BY p.sort_order;
$$;

GRANT EXECUTE ON FUNCTION get_subscription_plans TO authenticated;

-- =============================================================================
-- 6. RPC: Update plan details (name, description, prices)
-- =============================================================================
CREATE OR REPLACE FUNCTION update_subscription_plan(
  p_plan_id       uuid,
  p_name          text DEFAULT NULL,
  p_description   text DEFAULT NULL,
  p_monthly_price numeric DEFAULT NULL,
  p_yearly_price  numeric DEFAULT NULL,
  p_is_active     boolean DEFAULT NULL,
  p_monthly_paystack_plan_code text DEFAULT NULL,
  p_yearly_paystack_plan_code  text DEFAULT NULL
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
    is_active   = COALESCE(p_is_active, is_active),
    monthly_paystack_plan_code = COALESCE(p_monthly_paystack_plan_code, monthly_paystack_plan_code),
    yearly_paystack_plan_code  = COALESCE(p_yearly_paystack_plan_code, yearly_paystack_plan_code),
    updated_at  = now()
  WHERE id = p_plan_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_subscription_plan TO authenticated;

-- =============================================================================
-- 7. RPC: Toggle a feature on/off for a plan
-- =============================================================================
CREATE OR REPLACE FUNCTION toggle_plan_feature(
  p_plan_id     uuid,
  p_feature_key text,
  p_is_enabled  boolean
)
RETURNS subscription_plan_features
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result subscription_plan_features;
BEGIN
  INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled)
  VALUES (p_plan_id, p_feature_key, p_is_enabled)
  ON CONFLICT (plan_id, feature_key)
  DO UPDATE SET is_enabled = p_is_enabled
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_plan_feature TO authenticated;

-- =============================================================================
-- 8. RPC: Get school subscription info
-- =============================================================================
CREATE OR REPLACE FUNCTION get_school_subscription(p_school_id uuid)
RETURNS TABLE (
  id                    uuid,
  school_id             uuid,
  plan_id               uuid,
  billing_interval      text,
  status                text,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  plan_key              text,
  plan_name             text,
  monthly_price         numeric,
  yearly_price          numeric
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
    p.plan_key,
    p.name AS plan_name,
    p.monthly_price,
    p.yearly_price
  FROM school_subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.school_id = p_school_id;
$$;

GRANT EXECUTE ON FUNCTION get_school_subscription TO authenticated;

-- =============================================================================
-- 9. RPC: Create or update a school subscription record
-- =============================================================================
CREATE OR REPLACE FUNCTION upsert_school_subscription(
  p_school_id               uuid,
  p_plan_id                 uuid,
  p_billing_interval        text,
  p_paystack_subscription_code text DEFAULT NULL,
  p_paystack_customer_code  text DEFAULT NULL,
  p_status                  text DEFAULT 'active',
  p_current_period_start    timestamptz DEFAULT NULL,
  p_current_period_end      timestamptz DEFAULT NULL
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
    status, current_period_start, current_period_end
  ) VALUES (
    p_school_id, p_plan_id, p_billing_interval,
    p_paystack_subscription_code, p_paystack_customer_code,
    p_status, p_current_period_start, p_current_period_end
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
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_school_subscription TO authenticated;

-- =============================================================================
-- 10. RPC: Check if a school can access a specific feature
--     Returns JSON with has_access (bool) and current_plan (text)
--     Uses subscription_plan_features (DB-driven) with fallback to hardcoded list
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
BEGIN
  -- Get the school's plan from the schools table
  SELECT plan INTO v_plan FROM schools WHERE id = p_school_id;
  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('has_access', false, 'current_plan', 'basic');
  END IF;

  -- Basic plan has no paid features
  IF v_plan = 'basic' THEN
    RETURN jsonb_build_object('has_access', false, 'current_plan', 'basic');
  END IF;

  -- Premium has everything
  IF v_plan = 'premium' THEN
    RETURN jsonb_build_object('has_access', true, 'current_plan', 'premium');
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

  RETURN jsonb_build_object('has_access', v_has_access, 'current_plan', 'pro');
END;
$$;

GRANT EXECUTE ON FUNCTION check_school_feature_access TO authenticated;

-- =============================================================================
-- 11. RLS
-- =============================================================================
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_subscriptions ENABLE ROW LEVEL SECURITY;

-- Super admins can manage subscription plans
DROP POLICY IF EXISTS "Super admins manage subscription plans" ON subscription_plans;
CREATE POLICY "Super admins manage subscription plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- All authenticated users can read plans (for subscription page)
DROP POLICY IF EXISTS "All authenticated read subscription plans" ON subscription_plans;
CREATE POLICY "All authenticated read subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- Super admins manage plan features
DROP POLICY IF EXISTS "Super admins manage plan features" ON subscription_plan_features;
CREATE POLICY "Super admins manage plan features"
  ON subscription_plan_features FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- All authenticated can read plan features
DROP POLICY IF EXISTS "All authenticated read plan features" ON subscription_plan_features;
CREATE POLICY "All authenticated read plan features"
  ON subscription_plan_features FOR SELECT
  TO authenticated
  USING (true);

-- Schools can read their own subscription; super admins can read all
DROP POLICY IF EXISTS "School subscription read" ON school_subscriptions;
CREATE POLICY "School subscription read"
  ON school_subscriptions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

-- Super admins can manage all subscriptions; school admins can update their own
DROP POLICY IF EXISTS "Super admins manage subscriptions" ON school_subscriptions;
CREATE POLICY "Super admins manage subscriptions"
  ON school_subscriptions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

COMMIT;
