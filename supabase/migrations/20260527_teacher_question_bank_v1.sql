BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'teacher_question_visibility'
  ) THEN
    CREATE TYPE teacher_question_visibility AS ENUM ('private', 'public_school');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'teacher_question_type'
  ) THEN
    CREATE TYPE teacher_question_type AS ENUM ('objective', 'theory');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'teacher_question_difficulty'
  ) THEN
    CREATE TYPE teacher_question_difficulty AS ENUM ('easy', 'medium', 'hard');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'teacher_question_generation_status'
  ) THEN
    CREATE TYPE teacher_question_generation_status AS ENUM ('success', 'failed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS teacher_question_topic_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by_teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_class_id uuid NOT NULL REFERENCES subject_classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_question_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by_teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_class_id uuid NOT NULL REFERENCES subject_classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  visibility teacher_question_visibility NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES teacher_question_banks(id) ON DELETE CASCADE,
  subject_class_id uuid NOT NULL REFERENCES subject_classes(id) ON DELETE CASCADE,
  topic_set_id uuid REFERENCES teacher_question_topic_sets(id) ON DELETE SET NULL,
  created_by_teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  source_question_id uuid REFERENCES teacher_questions(id) ON DELETE SET NULL,
  question_type teacher_question_type NOT NULL,
  difficulty teacher_question_difficulty NOT NULL,
  visibility teacher_question_visibility NOT NULL DEFAULT 'private',
  topic text NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  explanation text,
  marks integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_question_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_class_id uuid NOT NULL REFERENCES subject_classes(id) ON DELETE CASCADE,
  bank_id uuid REFERENCES teacher_question_banks(id) ON DELETE SET NULL,
  topic_set_id uuid REFERENCES teacher_question_topic_sets(id) ON DELETE SET NULL,
  question_type teacher_question_type NOT NULL,
  difficulty teacher_question_difficulty NOT NULL,
  requested_count integer NOT NULL,
  generated_count integer NOT NULL DEFAULT 0,
  model text,
  prompt_version text NOT NULL DEFAULT 'v1',
  status teacher_question_generation_status NOT NULL,
  error_message text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_q_topic_sets_owner
  ON teacher_question_topic_sets (school_id, created_by_teacher_id, subject_class_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_q_banks_owner
  ON teacher_question_banks (school_id, created_by_teacher_id, subject_class_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_q_banks_visibility
  ON teacher_question_banks (school_id, visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_questions_bank
  ON teacher_questions (school_id, bank_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_questions_discovery
  ON teacher_questions (school_id, subject_class_id, difficulty, question_type, visibility);

CREATE INDEX IF NOT EXISTS idx_teacher_questions_source
  ON teacher_questions (source_question_id);

CREATE INDEX IF NOT EXISTS idx_teacher_question_generation_logs
  ON teacher_question_generation_logs (school_id, teacher_id, created_at DESC);

ALTER TABLE teacher_question_topic_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_question_generation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can read own topic sets" ON teacher_question_topic_sets;
DROP POLICY IF EXISTS "Teachers can manage own topic sets" ON teacher_question_topic_sets;

CREATE POLICY "Teachers can read own topic sets"
  ON teacher_question_topic_sets FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  );

CREATE POLICY "Teachers can manage own topic sets"
  ON teacher_question_topic_sets FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "Teachers can read own and shared banks" ON teacher_question_banks;
DROP POLICY IF EXISTS "Teachers can manage own banks" ON teacher_question_banks;

CREATE POLICY "Teachers can read own and shared banks"
  ON teacher_question_banks FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (
      created_by_teacher_id IN (
        SELECT id
        FROM teachers
        WHERE user_id = auth.uid()
          AND school_id = get_my_school_id()
      )
      OR visibility = 'public_school'
    )
  );

CREATE POLICY "Teachers can manage own banks"
  ON teacher_question_banks FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "Teachers can read own and shared questions" ON teacher_questions;
DROP POLICY IF EXISTS "Teachers can manage own questions" ON teacher_questions;

CREATE POLICY "Teachers can read own and shared questions"
  ON teacher_questions FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (
      created_by_teacher_id IN (
        SELECT id
        FROM teachers
        WHERE user_id = auth.uid()
          AND school_id = get_my_school_id()
      )
      OR visibility = 'public_school'
    )
  );

CREATE POLICY "Teachers can manage own questions"
  ON teacher_questions FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "Teachers can read own generation logs" ON teacher_question_generation_logs;
DROP POLICY IF EXISTS "Teachers can manage own generation logs" ON teacher_question_generation_logs;

CREATE POLICY "Teachers can read own generation logs"
  ON teacher_question_generation_logs FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  );

CREATE POLICY "Teachers can manage own generation logs"
  ON teacher_question_generation_logs FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  );

COMMENT ON TABLE teacher_question_topic_sets IS 'Reusable topic lists created by teachers per subject-class assignment';
COMMENT ON TABLE teacher_question_banks IS 'Teacher question banks that can be private or school-shared';
COMMENT ON TABLE teacher_questions IS 'Questions generated or authored by teachers and stored in question banks';
COMMENT ON TABLE teacher_question_generation_logs IS 'Audit trail for AI topic/question generation attempts';

COMMIT;
