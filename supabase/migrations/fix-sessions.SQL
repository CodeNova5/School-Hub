-- 1) required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2) Sessions: use tsrange because start_date/end_date are timestamp without time zone
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_no_overlap;
ALTER TABLE sessions DROP COLUMN IF EXISTS period;
ALTER TABLE sessions
  ADD COLUMN period tsrange
    GENERATED ALWAYS AS (tsrange(start_date, end_date, '[]')) STORED;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_no_overlap EXCLUDE USING GIST (
    school_id WITH =,
    period WITH &&
  );

-- 3) Terms: use daterange because start_date/end_date are date
ALTER TABLE terms DROP CONSTRAINT IF EXISTS terms_no_overlap;
ALTER TABLE terms DROP COLUMN IF EXISTS period;
ALTER TABLE terms
  ADD COLUMN period daterange
    GENERATED ALWAYS AS (daterange(start_date, end_date, '[]')) STORED;

ALTER TABLE terms
  ADD CONSTRAINT terms_no_overlap EXCLUDE USING GIST (
    session_id WITH =,
    period WITH &&
  );

-- 4) Updated RPC to create session + terms (keeps same error tokens your frontend expects)
CREATE OR REPLACE FUNCTION create_session_with_terms(
  p_school uuid,
  p_name text,
  p_start date,
  p_end date,
  p_terms jsonb
) RETURNS void
  LANGUAGE plpgsql
AS $$
DECLARE
  new_session_id uuid;
  t jsonb;
  t_name text;
  t_start date;
  t_end date;
BEGIN
  IF p_start >= p_end THEN
    RAISE EXCEPTION 'term_invalid_dates: session start must be before end';
  END IF;

  -- check overlapping sessions using tsrange (sessions use timestamp)
  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE school_id = p_school
      AND tsrange(start_date, end_date, '[]') && tsrange(p_start::timestamp, p_end::timestamp, '[]')
  ) THEN
    RAISE EXCEPTION 'session_overlap: overlaps existing session';
  END IF;

  INSERT INTO sessions (school_id, name, start_date, end_date, is_current)
    VALUES (p_school, p_name, p_start::timestamp, p_end::timestamp, false)
    RETURNING id INTO new_session_id;

  FOR t IN SELECT * FROM jsonb_array_elements(p_terms)
  LOOP
    t_name := t ->> 'name';
    t_start := (t ->> 'start')::date;
    t_end   := (t ->> 'end')::date;

    IF t_start IS NULL OR t_end IS NULL OR t_start >= t_end THEN
      RAISE EXCEPTION 'term_invalid_dates: invalid dates for term %', coalesce(t_name, '[unknown]');
    END IF;

    IF t_start < p_start OR t_end > p_end THEN
      RAISE EXCEPTION 'term_invalid_dates: term % outside session range', coalesce(t_name, '[unknown]');
    END IF;

    BEGIN
      INSERT INTO terms (school_id, session_id, name, start_date, end_date, is_current)
        VALUES (p_school, new_session_id, t_name, t_start, t_end, false);
    EXCEPTION WHEN others THEN
      IF SQLERRM ILIKE '%terms_no_overlap%' OR SQLERRM ILIKE '%overlap%' THEN
        RAISE EXCEPTION 'term_overlap: %', SQLERRM;
      ELSE
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;