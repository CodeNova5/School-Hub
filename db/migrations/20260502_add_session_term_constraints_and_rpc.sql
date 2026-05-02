-- Migration: Add GIST extension, prevent overlapping sessions/terms, add RPC to create session + terms atomically

-- Enable btree_gist for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping sessions per school using daterange exclusion
ALTER TABLE IF EXISTS sessions
  ADD CONSTRAINT IF NOT EXISTS sessions_no_overlap
  EXCLUDE USING GIST (school_id WITH =, daterange(start_date, end_date, '[]') WITH &&);

-- Prevent overlapping terms within the same session
ALTER TABLE IF EXISTS terms
  ADD CONSTRAINT IF NOT EXISTS terms_no_overlap
  EXCLUDE USING GIST (session_id WITH =, daterange(start_date, end_date, '[]') WITH &&);

-- RPC to create session with terms atomically
CREATE OR REPLACE FUNCTION create_session_with_terms(
  p_school uuid,
  p_name text,
  p_start date,
  p_end date,
  p_terms jsonb
) RETURNS TABLE(session_id uuid) LANGUAGE plpgsql AS $$
DECLARE
  v_session_id uuid;
  r jsonb;
BEGIN
  -- Validate session dates
  IF p_start >= p_end THEN
    RAISE EXCEPTION 'invalid_session_dates' USING MESSAGE = 'Session start must be before end';
  END IF;

  -- Check session overlap (atomic)
  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE school_id = p_school
      AND daterange(start_date, end_date, '[]') && daterange(p_start, p_end, '[]')
  ) THEN
    RAISE EXCEPTION 'session_overlap';
  END IF;

  INSERT INTO sessions (school_id, name, start_date, end_date, is_current)
  VALUES (p_school, p_name, p_start, p_end, false)
  RETURNING id INTO v_session_id;

  -- Insert terms (validate each)
  FOR r IN SELECT * FROM jsonb_array_elements(p_terms)
  LOOP
    IF (r->>'start')::date >= (r->>'end')::date THEN
      RAISE EXCEPTION 'term_invalid_dates';
    END IF;

    -- Check overlapping with other terms in the session (should be prevented by exclusion but we provide clear error)
    IF EXISTS (
      SELECT 1 FROM terms
      WHERE session_id = v_session_id
        AND daterange(start_date, end_date, '[]') && daterange((r->>'start')::date, (r->>'end')::date, '[]')
    ) THEN
      RAISE EXCEPTION 'term_overlap';
    END IF;

    INSERT INTO terms (school_id, session_id, name, start_date, end_date, is_current)
    VALUES (p_school, v_session_id, r->>'name', (r->>'start')::date, (r->>'end')::date, false);
  END LOOP;

  RETURN QUERY SELECT v_session_id;
END; $$;
