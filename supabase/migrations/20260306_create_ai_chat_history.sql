-- ============================================================================
-- AI ASSISTANT CHAT HISTORY TABLE
-- ============================================================================
-- Stores chat messages for each user to maintain conversation history
-- ============================================================================

-- Create chat_sessions table to group conversations
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  school_id uuid NOT NULL,
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_school ON ai_chat_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_created ON ai_chat_sessions(created_at DESC);

-- Create chat_messages table to store individual messages
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ai_chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  school_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  query_plan jsonb, -- Stores query information for assistant responses
  error boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user ON ai_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created ON ai_chat_messages(created_at);

-- Enable Row Level Security
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_chat_sessions
CREATE POLICY "Users can view their own chat sessions"
  ON ai_chat_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create chat sessions"
  ON ai_chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chat sessions"
  ON ai_chat_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own chat sessions"
  ON ai_chat_sessions FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for ai_chat_messages
CREATE POLICY "Users can view messages in their sessions"
  ON ai_chat_messages FOR SELECT
  USING (
    user_id = auth.uid() OR
    session_id IN (
      SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their sessions"
  ON ai_chat_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    session_id IN (
      SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Function to get or create default chat session for user
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
  -- Try to find the most recent active session
  SELECT id INTO v_session_id
  FROM ai_chat_sessions
  WHERE user_id = p_user_id
    AND school_id = p_school_id
    AND deleted_at IS NULL
  ORDER BY updated_at DESC
  LIMIT 1;

  -- If no session exists, create one
  IF v_session_id IS NULL THEN
    INSERT INTO ai_chat_sessions (user_id, school_id, title)
    VALUES (p_user_id, p_school_id, 'Chat Session - ' || now()::text)
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$;

-- Function to save a chat message
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

  -- Update session's updated_at timestamp
  UPDATE ai_chat_sessions
  SET updated_at = now()
  WHERE id = p_session_id;

  RETURN v_message_id;
END;
$$;
