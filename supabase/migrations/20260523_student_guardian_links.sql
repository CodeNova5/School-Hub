-- Student / guardian relationship model
-- Adds a link table so a student can be connected to multiple guardians.

CREATE TABLE IF NOT EXISTS student_guardian_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'Guardian',
  is_primary_contact boolean NOT NULL DEFAULT false,
  has_legal_custody boolean NOT NULL DEFAULT false,
  can_pickup boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, guardian_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_guardian_links_primary_contact
  ON student_guardian_links(student_id)
  WHERE is_primary_contact;

CREATE INDEX IF NOT EXISTS idx_student_guardian_links_school_id
  ON student_guardian_links(school_id);

CREATE INDEX IF NOT EXISTS idx_student_guardian_links_student_id
  ON student_guardian_links(student_id);

CREATE INDEX IF NOT EXISTS idx_student_guardian_links_guardian_id
  ON student_guardian_links(guardian_id);