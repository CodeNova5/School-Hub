-- Ensure students can always read their enrolled subject classes and related records
-- This migration is idempotent and safe to run after previous timetable/student RLS migrations.

BEGIN;

-- -------------------- SUBJECT_CLASSES --------------------
-- Keep admin/teacher access policies intact; only normalize student read policy.
DROP POLICY IF EXISTS "Students can read subject classes" ON subject_classes;
DROP POLICY IF EXISTS "Students can read subject classes for their class" ON subject_classes;
DROP POLICY IF EXISTS "Students can read subject classes for their school" ON subject_classes;

CREATE POLICY "Students can read subject classes for their school"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT s.school_id
      FROM students s
      WHERE s.user_id = auth.uid()
    )
  );

-- -------------------- STUDENT_SUBJECTS --------------------
-- Some environments only have school/parent visibility from older multitenancy policy.
-- Add explicit self-visibility for students.
DROP POLICY IF EXISTS "Students can read their own subject enrollments" ON student_subjects;

CREATE POLICY "Students can read their own subject enrollments"
  ON student_subjects FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id
      FROM students s
      WHERE s.user_id = auth.uid()
    )
  );

-- -------------------- SUBJECTS --------------------
DROP POLICY IF EXISTS "Students can read subjects" ON subjects;
DROP POLICY IF EXISTS "Students can read subjects for their school" ON subjects;

CREATE POLICY "Students can read subjects for their school"
  ON subjects FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT s.school_id
      FROM students s
      WHERE s.user_id = auth.uid()
    )
  );

-- -------------------- TEACHERS --------------------
DROP POLICY IF EXISTS "Students can read teachers" ON teachers;
DROP POLICY IF EXISTS "Students can read teachers for their school" ON teachers;

CREATE POLICY "Students can read teachers for their school"
  ON teachers FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT s.school_id
      FROM students s
      WHERE s.user_id = auth.uid()
    )
  );

COMMIT;
