-- =============================================================================
-- Platform And Public Pages Structure (SQL)
-- Source: supabase/structure/02-platform-and-public-pages.md
-- Depends on: 00-core-and-tenancy.sql, 01-academics-and-assessment.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Notification and communication modules
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  link text,
  target text NOT NULL,
  target_value text,
  target_name text,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  total_recipients integer DEFAULT 0,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_school_id ON notification_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_target ON notification_logs(target);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_by ON notification_logs(sent_by);

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  target text NOT NULL CHECK (target IN ('all', 'role', 'user', 'class')),
  target_value text,
  target_name text,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  total_recipients integer DEFAULT 0,
  sent_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_logs_school_id ON email_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_school_created ON email_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON email_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_email_logs_target ON email_logs(target);

CREATE OR REPLACE VIEW email_logs_today AS
SELECT *
FROM email_logs
WHERE DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE;

-- notification_tokens table may already exist from core setup; align optional fields.
CREATE TABLE IF NOT EXISTS notification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  role text DEFAULT 'user',
  device_type text DEFAULT 'unknown',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  last_registered_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

ALTER TABLE notification_tokens ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE notification_tokens ADD COLUMN IF NOT EXISTS last_registered_at timestamptz DEFAULT timezone('utc'::text, now());
ALTER TABLE notification_tokens ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE notification_tokens ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_notification_tokens_user_id ON notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_token ON notification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_is_active ON notification_tokens(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS notification_tokens_token_key ON notification_tokens(token);

-- -----------------------------------------------------------------------------
-- 2) AI assistant chat and execution helpers
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text,
  is_pinned boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_school ON ai_chat_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_created ON ai_chat_sessions(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ai_chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  query_plan jsonb,
  error boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user ON ai_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created ON ai_chat_messages(created_at);

CREATE OR REPLACE FUNCTION get_or_create_chat_session(
  p_user_id uuid,
  p_school_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  SELECT id INTO v_session_id
  FROM ai_chat_sessions
  WHERE user_id = p_user_id
    AND school_id = p_school_id
    AND deleted_at IS NULL
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO ai_chat_sessions (user_id, school_id, title)
    VALUES (p_user_id, p_school_id, 'Chat Session - ' || now()::text)
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION save_chat_message(
  p_session_id uuid,
  p_user_id uuid,
  p_school_id uuid,
  p_role text,
  p_content text,
  p_query_plan jsonb DEFAULT NULL,
  p_error boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
BEGIN
  INSERT INTO ai_chat_messages (
    session_id,
    user_id,
    school_id,
    role,
    content,
    query_plan,
    error
  )
  VALUES (
    p_session_id,
    p_user_id,
    p_school_id,
    p_role,
    p_content,
    p_query_plan,
    p_error
  )
  RETURNING id INTO v_message_id;

  UPDATE ai_chat_sessions
  SET updated_at = now()
  WHERE id = p_session_id;

  RETURN v_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION execute_ai_query(
  query_text text,
  query_params anyarray DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  query_result record;
  results jsonb[] := '{}';
BEGIN
  IF query_text !~* '^\s*SELECT' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF query_text ~* '(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE|GRANT|REVOKE|EXEC|EXECUTE)' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  IF query_text !~* 'school_id' THEN
    RAISE EXCEPTION 'Query must include school_id filter';
  END IF;

  FOR query_result IN
    EXECUTE query_text USING query_params
  LOOP
    results := array_append(results, row_to_json(query_result)::jsonb);
  END LOOP;

  result := jsonb_build_object(
    'success', true,
    'data', results,
    'count', array_length(results, 1)
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION execute_ai_query TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) Live sessions and teacher attendance
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_class_id uuid REFERENCES subject_classes(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Live Class',
  zoom_join_url_original text NOT NULL,
  meeting_id text NOT NULL,
  meeting_password_encrypted text,
  scheduled_for timestamptz,
  scheduled_end_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS subject_class_id uuid REFERENCES subject_classes(id) ON DELETE SET NULL;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_live_sessions_school ON live_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_class ON live_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_teacher ON live_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_subject_class ON live_sessions(subject_class_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_school_status ON live_sessions(school_id, status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_school_scheduled_for ON live_sessions(school_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_live_sessions_school_window ON live_sessions(school_id, scheduled_for, scheduled_end_at, status);

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school ON teacher_attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON teacher_attendance(date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school_date ON teacher_attendance(school_id, date);

-- -----------------------------------------------------------------------------
-- 4) Website builder and public content
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS website_site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  site_title text NOT NULL DEFAULT 'School Website',
  site_tagline text DEFAULT '',
  logo_url text DEFAULT '',
  hero_background_url text DEFAULT '',
  primary_color text DEFAULT '#1e3a8a',
  secondary_color text DEFAULT '#059669',
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',
  contact_address text DEFAULT '',
  is_website_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  seo_title text DEFAULT '',
  seo_description text DEFAULT '',
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, slug)
);

CREATE TABLE IF NOT EXISTS website_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES website_pages(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  section_label text NOT NULL,
  is_visible boolean DEFAULT true,
  order_sequence integer NOT NULL DEFAULT 1 CHECK (order_sequence > 0),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(page_id, section_key)
);

ALTER TABLE website_sections
  DROP CONSTRAINT IF EXISTS website_sections_section_key_check;

ALTER TABLE website_sections
  ADD CONSTRAINT website_sections_section_key_check
  CHECK (
    section_key IN (
      'home',
      'about',
      'programs',
      'facilities',
      'faculty',
      'news',
      'testimonials',
      'gallery',
      'admissions',
      'contact',
      'achievements_hero',
      'achievements_timeline',
      'hall_of_fame',
      'achievements_awards',
      'achievements_cta',
      'academics_hero',
      'academics_class_levels',
      'academics_curriculum',
      'academics_gallery'
    )
  );

CREATE TABLE IF NOT EXISTS website_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  page_id uuid REFERENCES website_pages(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  github_path text NOT NULL,
  public_url text NOT NULL,
  mime_type text,
  file_size bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS website_alumni_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  profile_slug text NOT NULL,
  full_name text NOT NULL,
  occupation text NOT NULL,
  story text NOT NULL,
  image_url text NOT NULL,
  linkedin_url text DEFAULT '',
  x_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  website_url text DEFAULT '',
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, profile_slug)
);

CREATE TABLE IF NOT EXISTS website_alumni_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  occupation text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  story text NOT NULL,
  image_url text NOT NULL,
  linkedin_url text DEFAULT '',
  x_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  website_url text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes text DEFAULT '',
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_profile_id uuid REFERENCES website_alumni_profiles(id) ON DELETE SET NULL,
  ip_address text DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_pages_school_status ON website_pages(school_id, status);
CREATE INDEX IF NOT EXISTS idx_website_sections_page_order ON website_sections(page_id, order_sequence);
CREATE INDEX IF NOT EXISTS idx_website_media_school ON website_media(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_alumni_profiles_school_created ON website_alumni_profiles(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_alumni_profiles_school_slug ON website_alumni_profiles(school_id, profile_slug);
CREATE INDEX IF NOT EXISTS idx_website_alumni_applications_school_status_submitted ON website_alumni_applications(school_id, status, submitted_at DESC);

-- -----------------------------------------------------------------------------
-- 5) Admissions extensions + public academics read support
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS admissions
  ADD COLUMN IF NOT EXISTS religion text DEFAULT '';

ALTER TABLE IF EXISTS admissions
  ADD COLUMN IF NOT EXISTS file_url text DEFAULT '';

ALTER TABLE IF EXISTS admissions
  ADD COLUMN IF NOT EXISTS ip_address text DEFAULT '';

COMMENT ON COLUMN admissions.religion IS 'Religion selection for schools with religion mode enabled';
COMMENT ON COLUMN admissions.file_url IS 'URL to uploaded student documents/certificates';
COMMENT ON COLUMN admissions.ip_address IS 'Client IP captured at submission time for basic fraud/rate-limit analysis';

-- -----------------------------------------------------------------------------
-- 6) Shared timestamp trigger helper for this module
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_platform_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Updated-at triggers
DROP TRIGGER IF EXISTS trigger_update_notification_logs_timestamp ON notification_logs;
CREATE TRIGGER trigger_update_notification_logs_timestamp
  BEFORE UPDATE ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_email_logs_timestamp ON email_logs;
CREATE TRIGGER trigger_update_email_logs_timestamp
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_notification_tokens_timestamp ON notification_tokens;
CREATE TRIGGER trigger_update_notification_tokens_timestamp
  BEFORE UPDATE ON notification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_ai_chat_sessions_timestamp ON ai_chat_sessions;
CREATE TRIGGER trigger_update_ai_chat_sessions_timestamp
  BEFORE UPDATE ON ai_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_live_sessions_timestamp ON live_sessions;
CREATE TRIGGER trigger_update_live_sessions_timestamp
  BEFORE UPDATE ON live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_teacher_attendance_timestamp ON teacher_attendance;
CREATE TRIGGER trigger_update_teacher_attendance_timestamp
  BEFORE UPDATE ON teacher_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_site_settings_timestamp ON website_site_settings;
CREATE TRIGGER trigger_update_website_site_settings_timestamp
  BEFORE UPDATE ON website_site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_pages_timestamp ON website_pages;
CREATE TRIGGER trigger_update_website_pages_timestamp
  BEFORE UPDATE ON website_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_sections_timestamp ON website_sections;
CREATE TRIGGER trigger_update_website_sections_timestamp
  BEFORE UPDATE ON website_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_media_timestamp ON website_media;
CREATE TRIGGER trigger_update_website_media_timestamp
  BEFORE UPDATE ON website_media
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_alumni_profiles_timestamp ON website_alumni_profiles;
CREATE TRIGGER trigger_update_website_alumni_profiles_timestamp
  BEFORE UPDATE ON website_alumni_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_alumni_applications_timestamp ON website_alumni_applications;
CREATE TRIGGER trigger_update_website_alumni_applications_timestamp
  BEFORE UPDATE ON website_alumni_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_timestamp();

-- -----------------------------------------------------------------------------
-- 7) Seed website pages (idempotent)
-- -----------------------------------------------------------------------------

INSERT INTO website_pages (school_id, title, slug, status)
SELECT s.id, 'Home', 'home', 'draft'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1
  FROM website_pages wp
  WHERE wp.school_id = s.id
    AND wp.slug = 'home'
)
ON CONFLICT DO NOTHING;

INSERT INTO website_pages (school_id, title, slug, status)
SELECT s.id, 'Hall of Fame', 'hall-of-fame', 'draft'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1
  FROM website_pages wp
  WHERE wp.school_id = s.id
    AND wp.slug = 'hall-of-fame'
)
ON CONFLICT DO NOTHING;

INSERT INTO website_pages (school_id, title, slug, status)
SELECT s.id, 'Academics', 'academics', 'draft'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1
  FROM website_pages wp
  WHERE wp.school_id = s.id
    AND wp.slug = 'academics'
)
ON CONFLICT DO NOTHING;

INSERT INTO website_site_settings (school_id, site_title, site_tagline)
SELECT s.id, s.name, 'Excellence in education'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1
  FROM website_site_settings ws
  WHERE ws.school_id = s.id
)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8) RLS policies
-- -----------------------------------------------------------------------------

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_alumni_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_alumni_applications ENABLE ROW LEVEL SECURITY;

-- Notification logs: writes constrained to service role/admin paths.
DROP POLICY IF EXISTS "Service role can manage all logs" ON notification_logs;
CREATE POLICY "Service role can manage all logs"
  ON notification_logs FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can manage all logs" ON notification_logs;
CREATE POLICY "Admins can manage all logs"
  ON notification_logs FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Students can view their notifications" ON notification_logs;
CREATE POLICY "Students can view their notifications"
  ON notification_logs FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (SELECT 1 FROM students s WHERE s.user_id = auth.uid())
    AND (
      target = 'all'
      OR (target = 'role' AND target_value = 'student')
      OR (target = 'user' AND target_value = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Teachers can view their notifications" ON notification_logs;
CREATE POLICY "Teachers can view their notifications"
  ON notification_logs FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = auth.uid())
    AND (
      target = 'all'
      OR (target = 'role' AND target_value = 'teacher')
      OR (target = 'user' AND target_value = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Parents can view their notifications" ON notification_logs;
CREATE POLICY "Parents can view their notifications"
  ON notification_logs FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (SELECT 1 FROM parents p WHERE p.user_id = auth.uid())
    AND (
      target = 'all'
      OR (target = 'role' AND target_value = 'parent')
      OR (target = 'user' AND target_value = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can view their own notification tokens" ON notification_tokens;
CREATE POLICY "Users can view their own notification tokens"
  ON notification_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notification tokens" ON notification_tokens;
CREATE POLICY "Users can insert their own notification tokens"
  ON notification_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification tokens" ON notification_tokens;
CREATE POLICY "Users can update their own notification tokens"
  ON notification_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notification tokens" ON notification_tokens;
CREATE POLICY "Users can delete their own notification tokens"
  ON notification_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage their school email logs" ON email_logs;
CREATE POLICY "Admins can manage their school email logs"
  ON email_logs FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Users can view their own chat sessions" ON ai_chat_sessions;
CREATE POLICY "Users can view their own chat sessions"
  ON ai_chat_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create chat sessions" ON ai_chat_sessions;
CREATE POLICY "Users can create chat sessions"
  ON ai_chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own chat sessions" ON ai_chat_sessions;
CREATE POLICY "Users can update their own chat sessions"
  ON ai_chat_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON ai_chat_sessions;
CREATE POLICY "Users can delete their own chat sessions"
  ON ai_chat_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view messages in their sessions" ON ai_chat_messages;
CREATE POLICY "Users can view messages in their sessions"
  ON ai_chat_messages FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR session_id IN (SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert messages in their sessions" ON ai_chat_messages;
CREATE POLICY "Users can insert messages in their sessions"
  ON ai_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND session_id IN (SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage live sessions" ON live_sessions;
CREATE POLICY "Admins can manage live sessions"
  ON live_sessions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Teachers can manage own subject live sessions" ON live_sessions;
CREATE POLICY "Teachers can manage own subject live sessions"
  ON live_sessions FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM teachers t
      WHERE t.user_id = auth.uid()
        AND t.school_id = live_sessions.school_id
        AND (
          t.id = live_sessions.teacher_id
          OR EXISTS (
            SELECT 1
            FROM subject_classes sc
            WHERE sc.id = live_sessions.subject_class_id
              AND sc.school_id = live_sessions.school_id
              AND sc.teacher_id = t.id
          )
          OR EXISTS (
            SELECT 1
            FROM classes c
            WHERE c.id = live_sessions.class_id
              AND c.school_id = live_sessions.school_id
              AND c.class_teacher_id = t.id
          )
        )
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM teachers t
      WHERE t.user_id = auth.uid()
        AND t.school_id = live_sessions.school_id
        AND t.id = live_sessions.teacher_id
    )
  );

DROP POLICY IF EXISTS "Students can read own class live sessions" ON live_sessions;
CREATE POLICY "Students can read own class live sessions"
  ON live_sessions FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM students s
      WHERE s.user_id = auth.uid()
        AND s.school_id = live_sessions.school_id
        AND s.class_id = live_sessions.class_id
    )
  );

DROP POLICY IF EXISTS "Admins can manage teacher attendance" ON teacher_attendance;
CREATE POLICY "Admins can manage teacher attendance"
  ON teacher_attendance FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Teachers can read their own attendance" ON teacher_attendance;
CREATE POLICY "Teachers can read their own attendance"
  ON teacher_attendance FOR SELECT
  TO authenticated
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "School users can read teacher attendance" ON teacher_attendance;
CREATE POLICY "School users can read teacher attendance"
  ON teacher_attendance FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "School users can read website settings" ON website_site_settings;
CREATE POLICY "School users can read website settings"
  ON website_site_settings FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage website settings" ON website_site_settings;
CREATE POLICY "Admins can manage website settings"
  ON website_site_settings FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Anon can read enabled website settings" ON website_site_settings;
CREATE POLICY "Anon can read enabled website settings"
  ON website_site_settings FOR SELECT
  TO anon
  USING (is_website_enabled = true);

DROP POLICY IF EXISTS "School users can read website pages" ON website_pages;
CREATE POLICY "School users can read website pages"
  ON website_pages FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage website pages" ON website_pages;
CREATE POLICY "Admins can manage website pages"
  ON website_pages FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Anon can read published website pages" ON website_pages;
CREATE POLICY "Anon can read published website pages"
  ON website_pages FOR SELECT
  TO anon
  USING (status = 'published');

DROP POLICY IF EXISTS "School users can read website sections" ON website_sections;
CREATE POLICY "School users can read website sections"
  ON website_sections FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage website sections" ON website_sections;
CREATE POLICY "Admins can manage website sections"
  ON website_sections FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Anon can read website sections for published pages" ON website_sections;
CREATE POLICY "Anon can read website sections for published pages"
  ON website_sections FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM website_pages wp
      WHERE wp.id = website_sections.page_id
        AND wp.status = 'published'
    )
  );

DROP POLICY IF EXISTS "School users can read website media" ON website_media;
CREATE POLICY "School users can read website media"
  ON website_media FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage website media" ON website_media;
CREATE POLICY "Admins can manage website media"
  ON website_media FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Public can read website media by school" ON website_media;
CREATE POLICY "Public can read website media by school"
  ON website_media FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "School users can read website alumni profiles" ON website_alumni_profiles;
CREATE POLICY "School users can read website alumni profiles"
  ON website_alumni_profiles FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage website alumni profiles" ON website_alumni_profiles;
CREATE POLICY "Admins can manage website alumni profiles"
  ON website_alumni_profiles FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Anon can read visible website alumni profiles" ON website_alumni_profiles;
CREATE POLICY "Anon can read visible website alumni profiles"
  ON website_alumni_profiles FOR SELECT
  TO anon
  USING (is_visible = true);

DROP POLICY IF EXISTS "School users can read website alumni applications" ON website_alumni_applications;
CREATE POLICY "School users can read website alumni applications"
  ON website_alumni_applications FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage website alumni applications" ON website_alumni_applications;
CREATE POLICY "Admins can manage website alumni applications"
  ON website_alumni_applications FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "Anon can create website alumni applications" ON website_alumni_applications;
CREATE POLICY "Anon can create website alumni applications"
  ON website_alumni_applications FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');

-- Admissions policies are only applied if admissions table exists.
DO $$
BEGIN
  IF to_regclass('public.admissions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE admissions ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Public can create admissions for their school" ON admissions';
    EXECUTE ''
      || 'CREATE POLICY "Public can create admissions for their school" '
      || 'ON admissions FOR INSERT '
      || 'TO anon, authenticated '
      || 'WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "School users can read admissions" ON admissions';
    EXECUTE ''
      || 'CREATE POLICY "School users can read admissions" '
      || 'ON admissions FOR SELECT '
      || 'TO authenticated '
      || 'USING (is_super_admin() OR school_id = get_my_school_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage admissions" ON admissions';
    EXECUTE ''
      || 'CREATE POLICY "Admins can manage admissions" '
      || 'ON admissions FOR UPDATE '
      || 'TO authenticated '
      || 'USING (is_super_admin() OR school_id = get_my_school_id()) '
      || 'WITH CHECK (is_super_admin() OR school_id = get_my_school_id())';
  END IF;
END;
$$;

-- Public academics showcase access
DROP POLICY IF EXISTS "Public can read active subjects by school" ON subjects;
CREATE POLICY "Public can read active subjects by school"
  ON subjects FOR SELECT
  TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can read active education levels" ON school_education_levels;
CREATE POLICY "Public can read active education levels"
  ON school_education_levels FOR SELECT
  TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can read class levels for active education levels" ON school_class_levels;
CREATE POLICY "Public can read class levels for active education levels"
  ON school_class_levels FOR SELECT
  TO anon
  USING (is_active = true);
