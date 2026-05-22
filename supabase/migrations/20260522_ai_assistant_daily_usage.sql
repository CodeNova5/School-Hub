-- ============================================================================
-- AI ASSISTANT DAILY TOKEN USAGE
-- ============================================================================
-- Tracks per-user, per-day token usage and enforces daily role-based quotas.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_assistant_daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  school_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'admin')),
  usage_date date NOT NULL,
  tokens_used integer NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  quota_limit integer NOT NULL CHECK (quota_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_daily_usage_user_date
  ON ai_assistant_daily_usage (user_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_daily_usage_school_date
  ON ai_assistant_daily_usage (school_id, usage_date DESC);

ALTER TABLE ai_assistant_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
  ON ai_assistant_daily_usage
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own AI usage"
  ON ai_assistant_daily_usage
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own AI usage"
  ON ai_assistant_daily_usage
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION get_ai_assistant_usage_summary(
  p_user_id uuid,
  p_school_id uuid,
  p_role text,
  p_usage_date date DEFAULT ((timezone('utc', now()))::date)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ai_assistant_daily_usage%ROWTYPE;
  v_quota_limit integer;
BEGIN
  v_quota_limit := CASE p_role
    WHEN 'student' THEN 5000
    WHEN 'teacher' THEN 20000
    WHEN 'parent' THEN 5000
    WHEN 'admin' THEN 50000
    ELSE 5000
  END;

  SELECT *
  INTO v_row
  FROM ai_assistant_daily_usage
  WHERE user_id = p_user_id
    AND school_id = p_school_id
    AND usage_date = p_usage_date
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'usageDate', to_char(p_usage_date, 'YYYY-MM-DD'),
      'tokensUsed', 0,
      'quotaLimit', v_quota_limit,
      'remainingTokens', v_quota_limit,
      'resetAt', ((p_usage_date + 1)::timestamp AT TIME ZONE 'utc')::timestamptz,
      'role', p_role,
      'schoolId', p_school_id,
      'userId', p_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'usageDate', to_char(v_row.usage_date, 'YYYY-MM-DD'),
    'tokensUsed', v_row.tokens_used,
    'quotaLimit', v_row.quota_limit,
    'remainingTokens', GREATEST(v_row.quota_limit - v_row.tokens_used, 0),
    'resetAt', ((v_row.usage_date + 1)::timestamp AT TIME ZONE 'utc')::timestamptz,
    'role', v_row.role,
    'schoolId', v_row.school_id,
    'userId', v_row.user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION record_ai_assistant_usage(
  p_user_id uuid,
  p_school_id uuid,
  p_role text,
  p_tokens_delta integer,
  p_quota_limit integer,
  p_usage_date date DEFAULT ((timezone('utc', now()))::date)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ai_assistant_daily_usage%ROWTYPE;
  v_total integer;
BEGIN
  SELECT *
  INTO v_row
  FROM ai_assistant_daily_usage
  WHERE user_id = p_user_id
    AND school_id = p_school_id
    AND usage_date = p_usage_date
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO ai_assistant_daily_usage (
      user_id,
      school_id,
      role,
      usage_date,
      tokens_used,
      quota_limit
    ) VALUES (
      p_user_id,
      p_school_id,
      p_role,
      p_usage_date,
      0,
      p_quota_limit
    )
    RETURNING * INTO v_row;
  END IF;

  v_total := v_row.tokens_used + GREATEST(p_tokens_delta, 0);

  IF v_total > p_quota_limit THEN
    RAISE EXCEPTION 'AI assistant daily quota exceeded' USING ERRCODE = 'P0001';
  END IF;

  UPDATE ai_assistant_daily_usage
  SET tokens_used = v_total,
      quota_limit = p_quota_limit,
      updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'usageDate', to_char(v_row.usage_date, 'YYYY-MM-DD'),
    'tokensUsed', v_row.tokens_used,
    'quotaLimit', v_row.quota_limit,
    'remainingTokens', GREATEST(v_row.quota_limit - v_row.tokens_used, 0),
    'resetAt', ((v_row.usage_date + 1)::timestamp AT TIME ZONE 'utc')::timestamptz,
    'role', v_row.role,
    'schoolId', v_row.school_id,
    'userId', v_row.user_id
  );
END;
$$;
