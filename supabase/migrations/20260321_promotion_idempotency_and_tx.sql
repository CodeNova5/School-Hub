-- ============================================================================
-- PROMOTION IDEMPOTENCY + TRANSACTIONAL PROCESSING
-- ============================================================================
-- Adds:
-- 1. Session-level processing lock fields for in-flight promotion runs
-- 2. Lock acquire/release helper functions
-- 3. Transactional per-student promotion processor
-- ============================================================================

ALTER TABLE promotion_settings
ADD COLUMN IF NOT EXISTS processing_lock_id text,
ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_promotion_settings_processing_lock
ON promotion_settings(session_id, processing_lock_id, processing_started_at);

CREATE OR REPLACE FUNCTION acquire_promotion_processing_lock(
  p_session_id uuid,
  p_lock_id text,
  p_lock_ttl_seconds int DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO promotion_settings (session_id)
  VALUES (p_session_id)
  ON CONFLICT (session_id) DO NOTHING;

  UPDATE promotion_settings
  SET
    processing_lock_id = p_lock_id,
    processing_started_at = now(),
    updated_at = now()
  WHERE session_id = p_session_id
    AND last_processed_at IS NULL
    AND (
      processing_lock_id IS NULL
      OR processing_started_at IS NULL
      OR processing_started_at < now() - make_interval(secs => p_lock_ttl_seconds)
      OR processing_lock_id = p_lock_id
    );

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION release_promotion_processing_lock(
  p_session_id uuid,
  p_lock_id text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE promotion_settings
  SET
    processing_lock_id = NULL,
    processing_started_at = NULL,
    updated_at = now()
  WHERE session_id = p_session_id
    AND processing_lock_id = p_lock_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION process_student_promotion_tx(
  p_session_id uuid,
  p_student_id uuid,
  p_student_name text,
  p_student_number text,
  p_current_class_id uuid,
  p_current_class_name text,
  p_education_level text,
  p_department text,
  p_terms_completed int,
  p_cumulative_average numeric,
  p_cumulative_grade text,
  p_position int,
  p_total_students int,
  p_action text,
  p_next_class_id uuid,
  p_notes text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_department_id uuid;
  v_student_religion_id uuid;
BEGIN
  IF p_action NOT IN ('promote', 'graduate', 'repeat') THEN
    RAISE EXCEPTION 'Invalid promotion action: %', p_action;
  END IF;

  IF p_action = 'promote' AND p_next_class_id IS NULL THEN
    RAISE EXCEPTION 'next_class_id is required for promote action';
  END IF;

  INSERT INTO class_history (
    student_id,
    class_id,
    session_id,
    student_name,
    student_number,
    class_name,
    education_level,
    department,
    terms_completed,
    average_score,
    cumulative_grade,
    position,
    total_students,
    promoted,
    promotion_status,
    promoted_to_class_id,
    promotion_notes,
    promoted_at
  )
  VALUES (
    p_student_id,
    p_current_class_id,
    p_session_id,
    p_student_name,
    p_student_number,
    p_current_class_name,
    p_education_level,
    p_department,
    COALESCE(p_terms_completed, 0),
    COALESCE(p_cumulative_average, 0),
    p_cumulative_grade,
    p_position,
    p_total_students,
    p_action IN ('promote', 'graduate'),
    CASE
      WHEN p_action = 'graduate' THEN 'graduated'
      WHEN p_action = 'promote' THEN 'promoted'
      ELSE 'repeated'
    END,
    p_next_class_id,
    p_notes,
    now()
  )
  ON CONFLICT (student_id, class_id, session_id)
  DO UPDATE SET
    student_name = EXCLUDED.student_name,
    student_number = EXCLUDED.student_number,
    class_name = EXCLUDED.class_name,
    education_level = EXCLUDED.education_level,
    department = EXCLUDED.department,
    terms_completed = EXCLUDED.terms_completed,
    average_score = EXCLUDED.average_score,
    cumulative_grade = EXCLUDED.cumulative_grade,
    position = EXCLUDED.position,
    total_students = EXCLUDED.total_students,
    promoted = EXCLUDED.promoted,
    promotion_status = EXCLUDED.promotion_status,
    promoted_to_class_id = EXCLUDED.promoted_to_class_id,
    promotion_notes = EXCLUDED.promotion_notes,
    promoted_at = EXCLUDED.promoted_at;

  IF p_action = 'promote' THEN
    UPDATE students
    SET
      class_id = p_next_class_id,
      status = 'active',
      updated_at = now()
    WHERE id = p_student_id;

    SELECT department_id, religion_id
    INTO v_student_department_id, v_student_religion_id
    FROM students
    WHERE id = p_student_id;

    DELETE FROM student_subjects WHERE student_id = p_student_id;
    DELETE FROM student_optional_subjects WHERE student_id = p_student_id;

    INSERT INTO student_subjects (student_id, subject_class_id)
    SELECT p_student_id, sc.id
    FROM subject_classes sc
    WHERE sc.class_id = p_next_class_id
      AND COALESCE(sc.is_optional, false) = false
      AND (sc.department_id IS NULL OR sc.department_id = v_student_department_id)
      AND (sc.religion_id IS NULL OR sc.religion_id = v_student_religion_id)
    ON CONFLICT (student_id, subject_class_id) DO NOTHING;

    RETURN 'promoted';
  END IF;

  IF p_action = 'graduate' THEN
    UPDATE students
    SET
      status = 'graduated',
      class_id = p_current_class_id,
      updated_at = now()
    WHERE id = p_student_id;

    RETURN 'graduated';
  END IF;

  RETURN 'repeated';
END;
$$;
