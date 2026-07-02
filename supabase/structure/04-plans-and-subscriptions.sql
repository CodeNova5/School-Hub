-- =============================================================================
-- Plans And Subscriptions Structure (SQL)
-- Source: supabase/structure/04-plans-and-subscriptions.md
-- Depends on: 00-core-and-tenancy.sql
-- =============================================================================

-- =============================================================================
-- 1) Plan columns on schools + helper function
-- =============================================================================

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic'
  CHECK (plan IN ('basic', 'pro', 'premium'));

CREATE OR REPLACE FUNCTION get_school_plan(p_school_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT plan FROM schools WHERE id = p_school_id;
$$;

GRANT EXECUTE ON FUNCTION get_school_plan TO authenticated;

-- =============================================================================
-- 2) Plan definition tables
-- =============================================================================

-- 2a) subscription_plans — plan definitions with pricing, Paystack codes, display info
CREATE TABLE IF NOT EXISTS subscription_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key    text NOT NULL UNIQUE CHECK (plan_key IN ('basic', 'pro', 'premium')),
  name        text NOT NULL,
  description text DEFAULT '',
  monthly_price  numeric(10,2) NOT NULL DEFAULT 0,
  yearly_price   numeric(10,2) NOT NULL DEFAULT 0,
  termly_price   numeric(10,2) NOT NULL DEFAULT 0,
  monthly_paystack_plan_code  text,
  yearly_paystack_plan_code   text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  -- Display columns (from 20260629_plan_display_info)
  label_short          text NOT NULL DEFAULT '',
  color_tailwind       text NOT NULL DEFAULT '',
  badge_color_tailwind text NOT NULL DEFAULT '',
  price_hint           text NOT NULL DEFAULT '',
  border_color_tailwind text NOT NULL DEFAULT '',
  icon_bg_tailwind      text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subscription_plans IS 'Defines the available subscription plans and their Paystack integration codes';
COMMENT ON COLUMN subscription_plans.monthly_paystack_plan_code IS 'Paystack plan code for monthly billing (e.g., PLN_xxxx)';
COMMENT ON COLUMN subscription_plans.yearly_paystack_plan_code IS 'Paystack plan code for yearly billing (e.g., PLN_xxxx)';

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active, sort_order);

-- 2b) subscription_plan_features — customizable feature-to-plan mapping
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

-- 2c) plan_change_log — audit trail for every plan change
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
CREATE INDEX IF NOT EXISTS idx_plan_change_school ON plan_change_log (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_change_created ON plan_change_log (created_at DESC);

-- =============================================================================
-- 3) School subscriptions
-- =============================================================================

-- 3a) school_subscriptions — tracks each school's active subscription
CREATE TABLE IF NOT EXISTS school_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id       uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly', 'yearly', 'termly')),
  paystack_subscription_code text,
  paystack_customer_code    text,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'past_due', 'cancelled', 'expired', 'trialing')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  -- Termly billing / stored auth columns (from 20260701_termly_billing_subscriptions)
  auth_code        text,
  customer_email   text,
  customer_code    text,
  next_billing_date timestamptz,
  grace_period_ends_at timestamptz,
  current_term_id  uuid REFERENCES terms(id) ON DELETE SET NULL,
  cancelled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id)
);

COMMENT ON TABLE school_subscriptions IS 'Tracks the active subscription for each school';
COMMENT ON COLUMN school_subscriptions.auth_code IS 'Stored Paystack authorization_code for recurring termly charges (AUTH_xxxxx)';
COMMENT ON COLUMN school_subscriptions.customer_email IS 'Email used for Paystack customer creation';
COMMENT ON COLUMN school_subscriptions.customer_code IS 'Paystack customer code (CUS_xxxxx)';

CREATE INDEX IF NOT EXISTS idx_school_subs_school ON school_subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_school_subs_status ON school_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_school_subs_paystack ON school_subscriptions(paystack_subscription_code);
CREATE INDEX IF NOT EXISTS idx_school_subs_next_billing ON school_subscriptions(next_billing_date)
  WHERE status = 'active' AND next_billing_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_school_subs_grace_period ON school_subscriptions(grace_period_ends_at)
  WHERE status = 'past_due';

-- 3b) school_subscription_transactions — payment transaction records
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

-- =============================================================================
-- 4) Feature & route management tables
-- =============================================================================

-- 4a) subscription_features — all feature metadata (replaces FEATURE_META)
CREATE TABLE IF NOT EXISTS subscription_features (
  feature_key   text PRIMARY KEY,
  label         text NOT NULL,
  label_short   text NOT NULL,
  description   text DEFAULT '',
  icon          text NOT NULL DEFAULT '📦',
  category      text NOT NULL CHECK (category IN ('engagement', 'premium')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subscription_features IS 'All feature metadata — super admin can create/edit features here';

-- 4b) subscription_feature_routes — URL-to-feature mappings for middleware enforcement
CREATE TABLE IF NOT EXISTS subscription_feature_routes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key   text REFERENCES subscription_features(feature_key) ON DELETE CASCADE,
  path_pattern  text NOT NULL,
  portal        text,  -- 'admin', 'teacher', 'student', 'parent', or NULL for cross-portal
  is_api        boolean NOT NULL DEFAULT false,
  is_excluded   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path_pattern, COALESCE(portal, ''), is_api)
);

COMMENT ON TABLE subscription_feature_routes IS 'Maps URL paths to features for middleware enforcement';
CREATE INDEX IF NOT EXISTS idx_feature_routes_api ON subscription_feature_routes(is_api);
CREATE INDEX IF NOT EXISTS idx_feature_routes_excluded ON subscription_feature_routes(is_excluded);

-- =============================================================================
-- 5) School plan grants — manual grants for cash/direct payment scenarios
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
  CONSTRAINT school_plan_grants_dates_check CHECK (start_date <= end_date)
);

COMMENT ON TABLE school_plan_grants IS 'Records manual plan grants by super admins (cash/direct payment scenarios)';
CREATE INDEX IF NOT EXISTS idx_school_plan_grants_school ON school_plan_grants(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_school_plan_grants_expires ON school_plan_grants(expires_at)
  WHERE is_active = true;

-- =============================================================================
-- 6) Seed default plans and features
-- =============================================================================

INSERT INTO subscription_plans (plan_key, name, description, monthly_price, yearly_price, termly_price, is_active, sort_order,
  label_short, color_tailwind, badge_color_tailwind, price_hint, border_color_tailwind, icon_bg_tailwind)
VALUES
  ('basic', 'Basic', 'Core school management — everything a school needs to operate', 0, 0, 0, true, 1,
   'Basic', 'text-green-600', 'bg-green-100 text-green-800', 'Free / Low cost',
   'border-green-200 dark:border-green-800', 'bg-green-100 dark:bg-green-900/30'),
  ('pro', 'Pro', 'Growth & engagement features for medium-to-large schools', 29900, 299000, 99700, true, 2,
   'Pro', 'text-blue-600', 'bg-blue-100 text-blue-800', 'Mid tier',
   'border-blue-200 dark:border-blue-800', 'bg-blue-100 dark:bg-blue-900/30'),
  ('premium', 'Premium', 'Full competitive advantage with all premium features', 69900, 699000, 233000, true, 3,
   'Premium', 'text-purple-600', 'bg-purple-100 text-purple-800', 'Top tier',
   'border-purple-200 dark:border-purple-800', 'bg-purple-100 dark:bg-purple-900/30')
ON CONFLICT (plan_key) DO NOTHING;

-- Seed default feature mappings
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

  -- Premium also gets all Pro features
  INSERT INTO subscription_plan_features (plan_id, feature_key, is_enabled)
  SELECT v_premium_id, feature_key, true
  FROM subscription_plan_features
  WHERE plan_id = v_pro_id
  ON CONFLICT (plan_id, feature_key) DO NOTHING;
END $$;

-- Seed feature metadata
INSERT INTO subscription_features (feature_key, label, label_short, description, icon, category) VALUES
  -- Pro features
  ('finance',           'Finance & Fee Management',       'Finance',          'Fee templates, billing, receipts, Paystack integration',            '💰', 'engagement'),
  ('payroll',           'Teacher Payroll',                'Payroll',          'Salary configuration, payment processing, subaccount setup',          '💵', 'engagement'),
  ('notifications',     'Push Notifications',             'Notifications',    'Send and manage push notifications to users',                         '🔔', 'engagement'),
  ('calendar',          'School Calendar',                'Calendar',         'School events, holidays, and exam schedules',                         '📅', 'engagement'),
  ('families',          'Family Management',              'Families',         'Group students into families for consolidated management',             '👪', 'engagement'),
  ('assignments',      'Assignments',                    'Assignments',      'Create, distribute, and grade assignments',                           '📝', 'engagement'),
  ('subject_analytics','Subject Classes & Analytics',    'Subject Analytics','Per-subject analytics, performance tracking, allocations',            '📊', 'engagement'),
  ('parents_guardians','Parents & Guardians',            'Parents',          'Parent account management and student linking',                        '👨‍👩‍👧‍👦', 'engagement'),
  ('student_id_cards', 'Student ID Card Generator',      'Student ID Cards','Generate and print student identification cards',                      '🪪', 'engagement'),
  ('teacher_id_cards', 'Teacher ID Card Generator',      'Teacher ID Cards','Generate and print teacher identification cards',                      '🪪', 'engagement'),
  -- Premium features
  ('ai_assistant',     'AI Assistant',                   'AI Assistant',     'AI-powered data query assistant for admin, teachers, students, parents','🤖', 'premium'),
  ('website_builder',  'School Website Builder',         'Website Builder',  'Drag-and-drop school website builder with custom subdomain',           '🌐', 'premium'),
  ('jamb_cbt',         'JAMB CBT Practice',              'JAMB CBT',         'JAMB exam simulation and practice platform for students',              '🎯', 'premium'),
  ('question_bank',    'Question Bank',                  'Question Bank',    'Create, organize, and reuse assessment questions',                     '📚', 'premium'),
  ('live_classes',     'Live Classes (Zoom)',            'Live Classes',     'Zoom-integrated live virtual classes',                                '📡', 'premium'),
  ('lesson_notes',     'AI Lesson Notes',                'Lesson Notes',     'AI-generated lesson notes for teachers',                              '📖', 'premium'),
  ('admissions',       'Online Admissions',              'Admissions',       'Online application management with approve/reject workflow',           '📋', 'premium'),
  ('alumni',           'Alumni Management',              'Alumni',           'Alumni profiles, directory, and community features',                  '🎓', 'premium'),
  ('audit_trail',      'Audit Trail',                    'Audit Trail',      'Track all admin actions with detailed audit logs',                    '📜', 'premium')
ON CONFLICT (feature_key) DO NOTHING;

-- Seed feature routes
INSERT INTO subscription_feature_routes (feature_key, path_pattern, portal, is_api, is_excluded) VALUES
  -- Page routes
  ('finance',           '/admin/finance',               'admin',    false, false),
  ('payroll',           '/admin/payroll',               'admin',    false, false),
  ('notifications',     '/admin/notifications',         'admin',    false, false),
  ('calendar',          '/admin/calendar',              'admin',    false, false),
  ('families',          '/admin/families',              'admin',    false, false),
  ('parents_guardians', '/admin/parents',               'admin',    false, false),
  ('student_id_cards',  '/admin/students/id-cards',    'admin',    false, false),
  ('teacher_id_cards',  '/admin/teachers/id-cards',    'admin',    false, false),
  ('assignments',       '/teacher/assignments',         'teacher',  false, false),
  ('payroll',           '/teacher/payroll',              'teacher',  false, false),
  ('assignments',       '/student/assignments',         'student',  false, false),
  ('subject_analytics', '/admin/subject-classes',       'admin',    false, false),
  ('subject_analytics', '/admin/subjects',              'admin',    false, false),
  ('ai_assistant',      '/admin/ai-assistant',          'admin',    false, false),
  ('website_builder',   '/admin/website-builder',       'admin',    false, false),
  ('jamb_cbt',          '/admin/jamb',                  'admin',    false, false),
  ('question_bank',     '/admin/question-bank',         'admin',    false, false),
  ('admissions',        '/admin/admissions',            'admin',    false, false),
  ('alumni',            '/admin/alumni',                'admin',    false, false),
  ('audit_trail',       '/admin/audit-logs',            'admin',    false, false),
  ('ai_assistant',      '/teacher/ai-assistant',        'teacher',  false, false),
  ('lesson_notes',      '/teacher/lesson-notes',        'teacher',  false, false),
  ('question_bank',     '/teacher/question-bank',       'teacher',  false, false),
  ('live_classes',      '/teacher/live-classes',        'teacher',  false, false),
  ('ai_assistant',      '/student/ai-assistant',        'student',  false, false),
  ('jamb_cbt',          '/student/jamb',                'student',  false, false),
  ('live_classes',      '/student/live-classes',        'student',  false, false),
  ('ai_assistant',      '/parent/ai-assistant',         'parent',   false, false),
  -- API routes that require plan check
  ('finance',           '/api/admin/finance',               'admin',    true, false),
  ('payroll',           '/api/admin/payroll',               'admin',    true, false),
  ('notifications',     '/api/admin/notifications',         'admin',    true, false),
  ('notifications',     '/api/admin/send-notification',     'admin',    true, false),
  ('families',          '/api/admin/families',              'admin',    true, false),
  ('parents_guardians', '/api/admin/parents',               'admin',    true, false),
  ('parents_guardians', '/api/admin/guardians',             'admin',    true, false),
  ('notifications',     '/api/admin/emails',                'admin',    true, false),
  ('notifications',     '/api/admin/send-email',            'admin',    true, false),
  ('payroll',           '/api/teacher/payroll',             'teacher',  true, false),
  ('finance',           '/api/student/finance',             'student',  true, false),
  ('assignments',       '/api/student/upload-assignment',   'student',  true, false),
  ('finance',           '/api/parent/finance',              'parent',   true, false),
  ('finance',           '/api/finance/paystack/initialize', NULL,       true, false),
  ('finance',           '/api/finance/paystack/verify',     NULL,       true, false),
  ('notifications',     '/api/notifications',               NULL,       true, false),
  ('alumni',            '/api/admin/alumni',                'admin',    true, false),
  ('audit_trail',       '/api/admin/audit-logs',            'admin',    true, false),
  ('jamb_cbt',          '/api/admin/jamb-access',           'admin',    true, false),
  ('question_bank',     '/api/admin/question-bank',         'admin',    true, false),
  ('website_builder',   '/api/admin/website',               'admin',    true, false),
  ('lesson_notes',      '/api/teacher/lesson-notes',        'teacher',  true, false),
  ('live_classes',      '/api/teacher/live-sessions',       'teacher',  true, false),
  ('question_bank',     '/api/teacher/question-bank',       'teacher',  true, false),
  ('jamb_cbt',          '/api/student/jamb',                'student',  true, false),
  ('live_classes',      '/api/student/live-sessions',       'student',  true, false),
  ('admissions',        '/api/admissions',                  NULL,       true, false),
  ('ai_assistant',      '/api/ai-assistant',                NULL,       true, false),
  ('alumni',            '/api/alumni',                      NULL,       true, false),
  -- Excluded routes (bypass plan enforcement)
  (NULL, '/api/finance/paystack/webhook',      NULL,   true, true),
  (NULL, '/api/super-admin',                   NULL,   true, true),
  (NULL, '/api/admin/activate',                NULL,   true, true),
  (NULL, '/api/admin/reset-password',          NULL,   true, true),
  (NULL, '/api/teacher/activate',              NULL,   true, true),
  (NULL, '/api/teacher/reset-password',        NULL,   true, true),
  (NULL, '/api/teacher/validate-reset-token',  NULL,   true, true),
  (NULL, '/api/student/activate',              NULL,   true, true),
  (NULL, '/api/student/reset-password',        NULL,   true, true),
  (NULL, '/api/student/validate-reset-token',  NULL,   true, true),
  (NULL, '/api/parent/activate',               NULL,   true, true),
  (NULL, '/api/parent/reset-password',         NULL,   true, true),
  (NULL, '/api/parent/validate-reset-token',   NULL,   true, true),
  (NULL, '/api/parent/validate-activation',    NULL,   true, true),
  (NULL, '/api/school',                        NULL,   true, true),
  (NULL, '/api/upload',                        NULL,   true, true)
ON CONFLICT (path_pattern, COALESCE(portal, ''), is_api) DO NOTHING;

-- =============================================================================
-- 7) Core RPCs: Plan management
-- =============================================================================

-- 7a) Atomic plan change with audit log
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
  IF p_new_plan NOT IN ('basic', 'pro', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan: %. Must be basic, pro, or premium.', p_new_plan;
  END IF;

  SELECT plan INTO v_old_plan
  FROM schools
  WHERE id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found: %', p_school_id;
  END IF;

  UPDATE schools
  SET plan = p_new_plan, updated_at = now()
  WHERE id = p_school_id
  RETURNING * INTO v_school;

  IF v_old_plan IS DISTINCT FROM p_new_plan THEN
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

-- 7b) Get plan change history
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
  SELECT id, old_plan, new_plan, changed_by_name, reason, created_at
  FROM plan_change_log
  WHERE school_id = p_school_id
  ORDER BY created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_school_plan_changes TO authenticated;

-- =============================================================================
-- 8) RPCs: Subscription management
-- =============================================================================

-- 8a) Get all plans with features
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
    p.id, p.plan_key, p.name, p.description,
    p.monthly_price, p.yearly_price, p.termly_price,
    p.monthly_paystack_plan_code, p.yearly_paystack_plan_code,
    p.is_active, p.sort_order,
    p.label_short, p.color_tailwind, p.badge_color_tailwind, p.price_hint,
    p.border_color_tailwind, p.icon_bg_tailwind,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('feature_key', f.feature_key, 'is_enabled', f.is_enabled)
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

-- 8b) Update plan details
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

-- 8c) Toggle feature for a plan
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

-- 8d) Get school subscription
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
    s.id, s.school_id, s.plan_id, s.billing_interval,
    s.status, s.current_period_start, s.current_period_end,
    s.next_billing_date, s.grace_period_ends_at,
    s.auth_code, s.customer_email, s.customer_code,
    s.current_term_id,
    p.plan_key, p.name AS plan_name,
    p.monthly_price, p.yearly_price, p.termly_price
  FROM school_subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.school_id = p_school_id;
$$;

GRANT EXECUTE ON FUNCTION get_school_subscription TO authenticated;

-- 8e) Upsert school subscription
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

-- 8f) Expire subscription (mark as past_due with grace period)
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

-- 8g) Renew subscription after successful payment
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

-- 8h) Check subscription status (for middleware/API)
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
    RETURN jsonb_build_object('status', 'none', 'should_degrade', false, 'message', 'No subscription record found');
  END IF;

  IF v_sub.status = 'past_due' AND v_sub.grace_period_ends_at IS NOT NULL THEN
    IF now() > v_sub.grace_period_ends_at THEN
      v_should_degrade := true;
      v_degrade_reason := 'Grace period ended. Payment required to restore access.';
    ELSE
      v_degrade_reason := 'Payment past due. Grace period until ' || v_sub.grace_period_ends_at::text;
    END IF;
  END IF;

  IF v_sub.status = 'expired' THEN
    v_should_degrade := true;
    v_degrade_reason := 'Subscription has expired. Renew to restore access.';
  END IF;

  IF v_sub.status = 'active' AND v_sub.current_period_end IS NOT NULL AND now() > v_sub.current_period_end THEN
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
-- 9) Feature access + downgrade
-- =============================================================================

-- 9a) Check if a school can access a specific feature
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
    RETURN jsonb_build_object('has_access', false, 'current_plan', 'basic', 'reason', 'Subscription expired', 'subscription_status', 'expired');
  END IF;

  IF v_sub_status = 'past_due' THEN
    IF v_grace_ends IS NOT NULL AND now() > v_grace_ends THEN
      RETURN jsonb_build_object('has_access', false, 'current_plan', 'basic', 'reason', 'Subscription payment past due. Grace period has ended.', 'subscription_status', 'past_due', 'grace_expired', true);
    ELSE
      v_reason := 'Payment past due. Grace period ends ' || COALESCE(v_grace_ends::text, 'soon');
    END IF;
  END IF;

  IF v_plan = 'basic' THEN
    RETURN jsonb_build_object('has_access', false, 'current_plan', 'basic', 'reason', v_reason, 'subscription_status', v_sub_status);
  END IF;

  IF v_plan = 'premium' THEN
    RETURN jsonb_build_object('has_access', true, 'current_plan', 'premium', 'reason', v_reason, 'subscription_status', v_sub_status);
  END IF;

  -- Pro: check subscription_plan_features
  SELECT f.is_enabled INTO v_has_access
  FROM subscription_plan_features f
  JOIN subscription_plans p ON p.id = f.plan_id
  WHERE p.plan_key = v_plan AND f.feature_key = p_feature_key;

  IF NOT FOUND THEN
    v_has_access := p_feature_key IN (
      'finance', 'payroll', 'notifications', 'calendar', 'families',
      'assignments', 'subject_analytics', 'parents_guardians',
      'student_id_cards', 'teacher_id_cards'
    );
  END IF;

  RETURN jsonb_build_object('has_access', v_has_access, 'current_plan', v_plan, 'reason', v_reason, 'subscription_status', v_sub_status);
END;
$$;

GRANT EXECUTE ON FUNCTION check_school_feature_access TO authenticated;

-- 9b) Force downgrade a school to Basic
CREATE OR REPLACE FUNCTION downgrade_school_to_basic(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_basic_plan_id uuid;
BEGIN
  SELECT id INTO v_basic_plan_id FROM subscription_plans WHERE plan_key = 'basic';

  UPDATE school_subscriptions
  SET status = 'expired', plan_id = v_basic_plan_id, updated_at = now()
  WHERE school_id = p_school_id AND status IN ('past_due', 'expired');

  UPDATE schools SET plan = 'basic', updated_at = now() WHERE id = p_school_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION downgrade_school_to_basic TO authenticated;

-- =============================================================================
-- 10) Feature & route management RPCs
-- =============================================================================

-- 10a) Get all feature routes for middleware
CREATE OR REPLACE FUNCTION get_feature_routes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'path_pattern', r.path_pattern,
      'feature_key', r.feature_key,
      'portal', r.portal,
      'is_api', r.is_api,
      'is_excluded', r.is_excluded
    )
    ORDER BY length(r.path_pattern) DESC
  ), '[]'::jsonb)
  FROM subscription_feature_routes r;
$$;

GRANT EXECUTE ON FUNCTION get_feature_routes TO authenticated;

-- 10b) Get all active features with metadata
CREATE OR REPLACE FUNCTION get_features()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'feature_key', f.feature_key,
      'label', f.label,
      'label_short', f.label_short,
      'description', f.description,
      'icon', f.icon,
      'category', f.category
    )
    ORDER BY f.category, f.feature_key
  ), '[]'::jsonb)
  FROM subscription_features f
  WHERE f.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_features TO authenticated;

-- 10c) Upsert a feature
CREATE OR REPLACE FUNCTION upsert_feature(
  p_feature_key text,
  p_label       text DEFAULT NULL,
  p_label_short text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_icon        text DEFAULT NULL,
  p_category    text DEFAULT NULL,
  p_is_active   boolean DEFAULT NULL
)
RETURNS subscription_features
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result subscription_features;
BEGIN
  INSERT INTO subscription_features (feature_key, label, label_short, description, icon, category, is_active)
  VALUES (
    p_feature_key,
    COALESCE(p_label, p_feature_key),
    COALESCE(p_label_short, p_feature_key),
    COALESCE(p_description, ''),
    COALESCE(p_icon, '📦'),
    COALESCE(p_category, 'engagement'),
    COALESCE(p_is_active, true)
  )
  ON CONFLICT (feature_key)
  DO UPDATE SET
    label       = COALESCE(p_label, subscription_features.label),
    label_short = COALESCE(p_label_short, subscription_features.label_short),
    description = COALESCE(p_description, subscription_features.description),
    icon        = COALESCE(p_icon, subscription_features.icon),
    category    = COALESCE(p_category, subscription_features.category),
    is_active   = COALESCE(p_is_active, subscription_features.is_active),
    updated_at  = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_feature TO authenticated;

-- 10d) Delete a feature
CREATE OR REPLACE FUNCTION delete_feature(p_feature_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM subscription_features WHERE feature_key = p_feature_key;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_feature TO authenticated;

-- 10e) Add a feature route
CREATE OR REPLACE FUNCTION add_feature_route(
  p_feature_key text,
  p_path_pattern text,
  p_portal      text DEFAULT NULL,
  p_is_api      boolean DEFAULT false,
  p_is_excluded boolean DEFAULT false
)
RETURNS subscription_feature_routes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result subscription_feature_routes;
BEGIN
  INSERT INTO subscription_feature_routes (feature_key, path_pattern, portal, is_api, is_excluded)
  VALUES (p_feature_key, p_path_pattern, p_portal, p_is_api, p_is_excluded)
  ON CONFLICT (path_pattern, COALESCE(portal, ''), is_api)
  DO UPDATE SET
    feature_key = COALESCE(p_feature_key, subscription_feature_routes.feature_key),
    portal      = COALESCE(p_portal, subscription_feature_routes.portal),
    is_excluded = COALESCE(p_is_excluded, subscription_feature_routes.is_excluded)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION add_feature_route TO authenticated;

-- 10f) Delete a feature route
CREATE OR REPLACE FUNCTION delete_feature_route(p_route_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM subscription_feature_routes WHERE id = p_route_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_feature_route TO authenticated;

-- =============================================================================
-- 11) School plan grants RPCs
-- =============================================================================

-- 11a) Create a manual plan grant (with term vs session billing logic)
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
  IF p_plan_key NOT IN ('pro', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan key: %. Must be pro or premium.', p_plan_key;
  END IF;

  SELECT id INTO v_plan_id FROM subscription_plans WHERE plan_key = p_plan_key;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan "%" not found in subscription_plans table.', p_plan_key;
  END IF;

  v_billing_interval := CASE p_grant_type
    WHEN 'term'    THEN 'termly'
    WHEN 'session' THEN 'yearly'
    WHEN 'custom'  THEN 'yearly'
    ELSE 'yearly'
  END;

  v_expires_at := (p_end_date + interval '1 day' - interval '1 second')::timestamptz;

  SELECT plan INTO v_old_plan FROM schools WHERE id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found: %', p_school_id;
  END IF;

  -- Insert grant record
  INSERT INTO school_plan_grants (school_id, plan_key, grant_type, term_id, session_id,
    start_date, end_date, include_holidays, notes, granted_by, granted_by_name, expires_at)
  VALUES (p_school_id, p_plan_key, p_grant_type, p_term_id, p_session_id,
    p_start_date, p_end_date, p_include_holidays, p_notes, p_granted_by, p_granted_by_name, v_expires_at)
  RETURNING id INTO v_grant_id;

  -- Update school plan
  UPDATE schools SET plan = p_plan_key, updated_at = now() WHERE id = p_school_id
  RETURNING * INTO v_school;

  -- Upsert school_subscription
  INSERT INTO school_subscriptions (school_id, plan_id, billing_interval,
    status, current_period_start, current_period_end, next_billing_date, current_term_id)
  VALUES (p_school_id, v_plan_id, v_billing_interval,
    'active', p_start_date::timestamptz, v_expires_at, v_expires_at,
    CASE WHEN p_grant_type = 'term' THEN p_term_id ELSE NULL END)
  ON CONFLICT (school_id)
  DO UPDATE SET
    plan_id = v_plan_id,
    billing_interval = CASE WHEN p_grant_type IN ('term', 'session', 'custom') THEN v_billing_interval ELSE school_subscriptions.billing_interval END,
    status = 'active',
    current_period_start = p_start_date::timestamptz,
    current_period_end = v_expires_at,
    next_billing_date = v_expires_at,
    current_term_id = CASE WHEN p_grant_type = 'term' THEN p_term_id ELSE school_subscriptions.current_term_id END,
    grace_period_ends_at = NULL,
    auth_code = school_subscriptions.auth_code,
    updated_at = now()
  RETURNING * INTO v_subscription;

  -- Log plan change
  INSERT INTO plan_change_log (school_id, old_plan, new_plan, changed_by, changed_by_name, reason)
  VALUES (p_school_id, COALESCE(v_old_plan, 'basic'), p_plan_key, p_granted_by, p_granted_by_name,
    'Manual grant: ' || p_grant_type || ' (' || p_start_date || ' → ' || p_end_date || ')');

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

-- 11b) List all plan grants
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
    g.id, g.school_id, s.name AS school_name, g.plan_key, g.grant_type,
    g.start_date, g.end_date, g.include_holidays, g.notes, g.granted_by_name,
    g.is_active, g.expires_at, g.created_at,
    t.name AS term_name, sess.name AS session_name
  FROM school_plan_grants g
  JOIN schools s ON s.id = g.school_id
  LEFT JOIN terms t ON t.id = g.term_id
  LEFT JOIN sessions sess ON sess.id = g.session_id
  WHERE (p_school_id IS NULL OR g.school_id = p_school_id)
    AND (p_active_only = false OR g.is_active = true)
  ORDER BY g.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_school_plan_grants TO authenticated;

-- 11c) Expire a specific plan grant
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
  FROM school_plan_grants WHERE id = p_grant_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE school_plan_grants SET is_active = false WHERE id = p_grant_id;

  IF NOT EXISTS (SELECT 1 FROM school_plan_grants WHERE school_id = v_school_id AND is_active = true) THEN
    PERFORM downgrade_school_to_basic(v_school_id);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_school_plan_grant TO authenticated;

-- 11d) Batch-expire past grants
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
    UPDATE school_plan_grants SET is_active = false WHERE id = v_grant.id;

    IF NOT EXISTS (SELECT 1 FROM school_plan_grants WHERE school_id = v_grant.school_id AND is_active = true) THEN
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
-- 12) Cron helper RPCs
-- =============================================================================

-- 12a) Find schools with expired grace periods
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
  SELECT s.id, s.name, s.email, sub.grace_period_ends_at
  FROM school_subscriptions sub
  JOIN schools s ON s.id = sub.school_id
  WHERE sub.status = 'past_due'
    AND sub.grace_period_ends_at IS NOT NULL
    AND sub.grace_period_ends_at < now();
$$;

GRANT EXECUTE ON FUNCTION get_expired_grace_period_schools TO authenticated;

-- 12b) Find schools due for billing
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
    s.id, s.name, s.email,
    sub.plan_id, p.plan_key, sub.billing_interval,
    sub.auth_code, sub.customer_email, sub.customer_code,
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
-- 13) Triggers for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_plan_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION set_plan_updated_at();

DROP TRIGGER IF EXISTS set_school_subscriptions_updated_at ON school_subscriptions;
CREATE TRIGGER set_school_subscriptions_updated_at
  BEFORE UPDATE ON school_subscriptions FOR EACH ROW EXECUTE FUNCTION set_plan_updated_at();

DROP TRIGGER IF EXISTS set_sub_tx_updated_at ON school_subscription_transactions;
CREATE TRIGGER set_sub_tx_updated_at
  BEFORE UPDATE ON school_subscription_transactions FOR EACH ROW EXECUTE FUNCTION set_plan_updated_at();

DROP TRIGGER IF EXISTS set_subscription_features_updated_at ON subscription_features;
CREATE TRIGGER set_subscription_features_updated_at
  BEFORE UPDATE ON subscription_features FOR EACH ROW EXECUTE FUNCTION set_plan_updated_at();

-- =============================================================================
-- 14) RLS policies
-- =============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_plan_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_feature_routes ENABLE ROW LEVEL SECURITY;

-- subscription_plans
DROP POLICY IF EXISTS "Super admins manage subscription plans" ON subscription_plans;
CREATE POLICY "Super admins manage subscription plans"
  ON subscription_plans FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "All authenticated read subscription plans" ON subscription_plans;
CREATE POLICY "All authenticated read subscription plans"
  ON subscription_plans FOR SELECT TO authenticated
  USING (true);

-- subscription_plan_features
DROP POLICY IF EXISTS "Super admins manage plan features" ON subscription_plan_features;
CREATE POLICY "Super admins manage plan features"
  ON subscription_plan_features FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "All authenticated read plan features" ON subscription_plan_features;
CREATE POLICY "All authenticated read plan features"
  ON subscription_plan_features FOR SELECT TO authenticated
  USING (true);

-- school_subscriptions
DROP POLICY IF EXISTS "School subscription read" ON school_subscriptions;
CREATE POLICY "School subscription read"
  ON school_subscriptions FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Super admins manage subscriptions" ON school_subscriptions;
CREATE POLICY "Super admins manage subscriptions"
  ON school_subscriptions FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- school_subscription_transactions
DROP POLICY IF EXISTS "School subscription transactions read own" ON school_subscription_transactions;
CREATE POLICY "School subscription transactions read own"
  ON school_subscription_transactions FOR SELECT TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "School subscription transactions super admin manage" ON school_subscription_transactions;
CREATE POLICY "School subscription transactions super admin manage"
  ON school_subscription_transactions FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- plan_change_log
DROP POLICY IF EXISTS "Super admins can read all plan changes" ON plan_change_log;
CREATE POLICY "Super admins can read all plan changes"
  ON plan_change_log FOR SELECT TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS "School admins can read their plan changes" ON plan_change_log;
CREATE POLICY "School admins can read their plan changes"
  ON plan_change_log FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

-- school_plan_grants
DROP POLICY IF EXISTS "Super admins manage plan grants" ON school_plan_grants;
CREATE POLICY "Super admins manage plan grants"
  ON school_plan_grants FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Schools read own grants" ON school_plan_grants;
CREATE POLICY "Schools read own grants"
  ON school_plan_grants FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

-- subscription_features
DROP POLICY IF EXISTS "Super admins manage features" ON subscription_features;
CREATE POLICY "Super admins manage features"
  ON subscription_features FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "All authenticated read features" ON subscription_features;
CREATE POLICY "All authenticated read features"
  ON subscription_features FOR SELECT TO authenticated
  USING (true);

-- subscription_feature_routes
DROP POLICY IF EXISTS "Super admins manage routes" ON subscription_feature_routes;
CREATE POLICY "Super admins manage routes"
  ON subscription_feature_routes FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "All authenticated read routes" ON subscription_feature_routes;
CREATE POLICY "All authenticated read routes"
  ON subscription_feature_routes FOR SELECT TO authenticated
  USING (true);

