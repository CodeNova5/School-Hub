-- =============================================================================
-- Feature & Route Management — DB-driven feature metadata and route mapping
--
-- 1. subscription_features — stores ALL feature metadata (replaces FEATURE_META)
-- 2. subscription_feature_routes — stores URL-to-feature mappings (replaces plan-routes.ts)
-- 3. Seed features from existing FEATURE_META
-- 4. Seed routes from existing FEATURE_ROUTES, API_FEATURE_ROUTES, API_EXCLUDED_ROUTES
-- 5. RPC: get_feature_routes() — returns all route mappings for middleware
-- 6. RPC: get_features() — returns all feature metadata
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. subscription_features — all feature metadata
-- =============================================================================
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

-- =============================================================================
-- 2. subscription_feature_routes — URL-to-feature mappings
--    is_excluded = true means this route bypasses plan enforcement entirely
--    (e.g., webhooks, auth endpoints, super admin, uploads)
--    feature_key is NULL for excluded routes since they don't gate a feature.
-- =============================================================================
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
-- 3. Seed features from existing FEATURE_META
-- =============================================================================
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

-- =============================================================================
-- 4. Seed feature routes from existing FEATURE_ROUTES + API_FEATURE_ROUTES + API_EXCLUDED_ROUTES
-- =============================================================================

-- Page routes (FEATURE_ROUTES)
INSERT INTO subscription_feature_routes (feature_key, path_pattern, portal, is_api, is_excluded) VALUES
  -- Pro: Admin
  ('finance',           '/admin/finance',               'admin',    false, false),
  ('payroll',           '/admin/payroll',               'admin',    false, false),
  ('notifications',     '/admin/notifications',         'admin',    false, false),
  ('calendar',          '/admin/calendar',              'admin',    false, false),
  ('families',          '/admin/families',              'admin',    false, false),
  ('parents_guardians', '/admin/parents',               'admin',    false, false),
  ('student_id_cards',  '/admin/students/id-cards',    'admin',    false, false),
  ('teacher_id_cards',  '/admin/teachers/id-cards',    'admin',    false, false),
  -- Pro: Teacher
  ('assignments',       '/teacher/assignments',         'teacher',  false, false),
  ('payroll',           '/teacher/payroll',              'teacher',  false, false),
  -- Pro: Student
  ('assignments',       '/student/assignments',         'student',  false, false),
  -- Pro: Admin (subject analytics)
  ('subject_analytics', '/admin/subject-classes',       'admin',    false, false),
  ('subject_analytics', '/admin/subjects',              'admin',    false, false),
  -- Premium: Admin
  ('ai_assistant',      '/admin/ai-assistant',          'admin',    false, false),
  ('website_builder',   '/admin/website-builder',       'admin',    false, false),
  ('jamb_cbt',          '/admin/jamb',                  'admin',    false, false),
  ('question_bank',     '/admin/question-bank',         'admin',    false, false),
  ('admissions',        '/admin/admissions',            'admin',    false, false),
  ('alumni',            '/admin/alumni',                'admin',    false, false),
  ('audit_trail',       '/admin/audit-logs',            'admin',    false, false),
  -- Premium: Teacher
  ('ai_assistant',      '/teacher/ai-assistant',        'teacher',  false, false),
  ('lesson_notes',      '/teacher/lesson-notes',        'teacher',  false, false),
  ('question_bank',     '/teacher/question-bank',       'teacher',  false, false),
  ('live_classes',      '/teacher/live-classes',        'teacher',  false, false),
  -- Premium: Student
  ('ai_assistant',      '/student/ai-assistant',        'student',  false, false),
  ('jamb_cbt',          '/student/jamb',                'student',  false, false),
  ('live_classes',      '/student/live-classes',        'student',  false, false),
  -- Premium: Parent
  ('ai_assistant',      '/parent/ai-assistant',         'parent',   false, false)
ON CONFLICT (path_pattern, COALESCE(portal, ''), is_api) DO NOTHING;

-- API routes (API_FEATURE_ROUTES) — requires plan check
INSERT INTO subscription_feature_routes (feature_key, path_pattern, portal, is_api, is_excluded) VALUES
  -- Pro features
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
  -- Premium features
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
  ('alumni',            '/api/alumni',                      NULL,       true, false)
ON CONFLICT (path_pattern, COALESCE(portal, ''), is_api) DO NOTHING;

-- Excluded API routes (API_EXCLUDED_ROUTES) — bypass plan enforcement entirely
INSERT INTO subscription_feature_routes (feature_key, path_pattern, portal, is_api, is_excluded) VALUES
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
-- 5. RPC: Get all feature routes for middleware enforcement
--     Returns routes sorted by path_pattern length descending (longest-first)
--     for accurate prefix matching.
-- =============================================================================
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

-- =============================================================================
-- 6. RPC: Get all active features with metadata
-- =============================================================================
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

-- =============================================================================
-- 7. RPC: Upsert a feature (create or update)
-- =============================================================================
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

-- =============================================================================
-- 8. RPC: Delete a feature (cascades to subscription_plan_features and routes)
-- =============================================================================
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

-- =============================================================================
-- 9. RPC: Add a feature route
-- =============================================================================
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

-- =============================================================================
-- 10. RPC: Delete a feature route
-- =============================================================================
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
-- 11. RLS
-- =============================================================================
ALTER TABLE subscription_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_feature_routes ENABLE ROW LEVEL SECURITY;

-- Super admins manage features
DROP POLICY IF EXISTS "Super admins manage features" ON subscription_features;
CREATE POLICY "Super admins manage features"
  ON subscription_features FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- All authenticated can read features
DROP POLICY IF EXISTS "All authenticated read features" ON subscription_features;
CREATE POLICY "All authenticated read features"
  ON subscription_features FOR SELECT
  TO authenticated
  USING (true);

-- Super admins manage routes
DROP POLICY IF EXISTS "Super admins manage routes" ON subscription_feature_routes;
CREATE POLICY "Super admins manage routes"
  ON subscription_feature_routes FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- All authenticated can read routes (needed by middleware)
DROP POLICY IF EXISTS "All authenticated read routes" ON subscription_feature_routes;
CREATE POLICY "All authenticated read routes"
  ON subscription_feature_routes FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
