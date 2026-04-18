-- ============================================================================
-- TEACHER ATTENDANCE TABLE
-- ============================================================================
-- This migration creates the teacher_attendance table to track teacher attendance
-- separately from student attendance.
-- ============================================================================

-- CREATE TEACHER_ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school ON teacher_attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON teacher_attendance(date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school_date ON teacher_attendance(school_id, date);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Admins can manage teacher attendance for their school
CREATE POLICY "Admins can manage teacher attendance" ON teacher_attendance
  FOR ALL
  TO authenticated
  USING (
    is_super_admin() 
    OR (is_admin() AND school_id = get_my_school_id())
  )
  WITH CHECK (
    is_super_admin() 
    OR (is_admin() AND school_id = get_my_school_id())
  );

-- Teachers can read their own attendance
CREATE POLICY "Teachers can read their own attendance" ON teacher_attendance
  FOR SELECT
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

-- School users can read teacher attendance
CREATE POLICY "School users can read teacher attendance" ON teacher_attendance
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
  );

-- Publish this as a notification topic
-- (optional, for real-time updates)
ALTER TABLE teacher_attendance REPLICA IDENTITY FULL;
