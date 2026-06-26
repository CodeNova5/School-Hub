-- =============================================================================
-- Plan Display Info — customizable labels, colors, badge styles per plan
-- Previously hardcoded in PLAN_INFO constant, now DB-driven so super admin
-- can customize plan display from the subscription management UI.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Add display columns to subscription_plans
-- =============================================================================
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS label_short          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS color_tailwind       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS badge_color_tailwind text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_hint           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS border_color_tailwind text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS icon_bg_tailwind      text NOT NULL DEFAULT '';

COMMENT ON COLUMN subscription_plans.label_short IS 'Short display name (e.g., "Pro") used in badges and compact UI';
COMMENT ON COLUMN subscription_plans.color_tailwind IS 'Tailwind text color class (e.g., "text-blue-600")';
COMMENT ON COLUMN subscription_plans.badge_color_tailwind IS 'Tailwind badge class (e.g., "bg-blue-100 text-blue-800")';
COMMENT ON COLUMN subscription_plans.price_hint IS 'Short price hint (e.g., "Mid tier")';
COMMENT ON COLUMN subscription_plans.border_color_tailwind IS 'Tailwind card border class (e.g., "border-blue-200 dark:border-blue-800")';
COMMENT ON COLUMN subscription_plans.icon_bg_tailwind IS 'Tailwind icon background class (e.g., "bg-blue-100 dark:bg-blue-900/30")';

-- =============================================================================
-- 2. Seed the display values from the current hardcoded constants
-- =============================================================================
UPDATE subscription_plans SET
  label_short          = CASE plan_key
                             WHEN 'basic'   THEN 'Basic'
                             WHEN 'pro'     THEN 'Pro'
                             WHEN 'premium' THEN 'Premium'
                           END,
  color_tailwind       = CASE plan_key
                             WHEN 'basic'   THEN 'text-green-600'
                             WHEN 'pro'     THEN 'text-blue-600'
                             WHEN 'premium' THEN 'text-purple-600'
                           END,
  badge_color_tailwind = CASE plan_key
                             WHEN 'basic'   THEN 'bg-green-100 text-green-800'
                             WHEN 'pro'     THEN 'bg-blue-100 text-blue-800'
                             WHEN 'premium' THEN 'bg-purple-100 text-purple-800'
                           END,
  price_hint           = CASE plan_key
                             WHEN 'basic'   THEN 'Free / Low cost'
                             WHEN 'pro'     THEN 'Mid tier'
                             WHEN 'premium' THEN 'Top tier'
                           END,
  border_color_tailwind = CASE plan_key
                              WHEN 'basic'   THEN 'border-green-200 dark:border-green-800'
                              WHEN 'pro'     THEN 'border-blue-200 dark:border-blue-800'
                              WHEN 'premium' THEN 'border-purple-200 dark:border-purple-800'
                            END,
  icon_bg_tailwind      = CASE plan_key
                              WHEN 'basic'   THEN 'bg-green-100 dark:bg-green-900/30'
                              WHEN 'pro'     THEN 'bg-blue-100 dark:bg-blue-900/30'
                              WHEN 'premium' THEN 'bg-purple-100 dark:bg-purple-900/30'
                            END;

-- =============================================================================
-- 3. Replace get_subscription_plans RPC to include display columns
-- =============================================================================

-- FIX: Explicitly drop the old function signature first
DROP FUNCTION IF EXISTS get_subscription_plans();

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
           p.monthly_price, p.yearly_price,
           p.monthly_paystack_plan_code, p.yearly_paystack_plan_code,
           p.is_active, p.sort_order,
           p.label_short, p.color_tailwind, p.badge_color_tailwind, p.price_hint,
           p.border_color_tailwind, p.icon_bg_tailwind
  ORDER BY p.sort_order;
$$;

GRANT EXECUTE ON FUNCTION get_subscription_plans TO authenticated;

-- =============================================================================
-- 4. Replace update_subscription_plan RPC to include display columns
-- =============================================================================

-- FIX: Drop the function with its old signature to avoid potential argument mismatch issues
DROP FUNCTION IF EXISTS update_subscription_plan(uuid, text, text, numeric, numeric, boolean, text, text);
DROP FUNCTION IF EXISTS update_subscription_plan(uuid, text, text, numeric, numeric, boolean, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION update_subscription_plan(
  p_plan_id       uuid,
  p_name          text DEFAULT NULL,
  p_description   text DEFAULT NULL,
  p_monthly_price numeric DEFAULT NULL,
  p_yearly_price  numeric DEFAULT NULL,
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

COMMIT;