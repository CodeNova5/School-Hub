/*
  # School Management System Database Schema

  ## Overview
  Complete database schema for a school management system supporting admin, teacher, and student workflows.

  ## New Tables

  ### 1. sessions
  - `id` (uuid, primary key)
  - `name` (text) - e.g., "2024/2025"
  - `start_date` (date)
  - `end_date` (date)
  - `is_current` (boolean) - only one active session at a time
  - `created_at` (timestamptz)

  ### 2. terms
  - `id` (uuid, primary key)
  - `session_id` (uuid, foreign key)
  - `name` (text) - e.g., "First Term", "Second Term"
  - `start_date` (date)
  - `end_date` (date)
  - `is_current` (boolean)
  - `created_at` (timestamptz)

  ### 3. classes
  - `id` (uuid, primary key)
  - `name` (text) - e.g., "Grade 1A", "JSS 3"
  - `level` (text) - e.g., "Primary", "Junior Secondary"
  - `capacity` (integer)
  - `session_id` (uuid, foreign key)
  - `created_at` (timestamptz)

  ### 4. subjects
  - `id` (uuid, primary key)
  - `name` (text) - e.g., "Mathematics", "English"
  - `code` (text) - e.g., "MATH101"
  - `description` (text)
  - `created_at` (timestamptz)

  ### 5. teachers
  - `id` (uuid, primary key, links to auth.users)
  - `staff_id` (text, unique)
  - `first_name` (text)
  - `last_name` (text)
  - `email` (text, unique)
  - `phone` (text)
  - `address` (text)
  - `qualification` (text)
  - `specialization` (text)
  - `date_of_birth` (date)
  - `hire_date` (date)
  - `photo_url` (text)
  - `bio` (text)
  - `status` (text) - "active", "on_leave", "inactive"
  - `created_at` (timestamptz)

  ### 6. class_teachers
  - `id` (uuid, primary key)
  - `class_id` (uuid, foreign key)
  - `teacher_id` (uuid, foreign key)
  - `session_id` (uuid, foreign key)
  - `created_at` (timestamptz)

  ### 7. subject_assignments
  - `id` (uuid, primary key)
  - `subject_id` (uuid, foreign key)
  - `teacher_id` (uuid, foreign key)
  - `class_id` (uuid, foreign key)
  - `session_id` (uuid, foreign key)
  - `created_at` (timestamptz)

  ### 8. students
  - `id` (uuid, primary key)
  - `student_id` (text, unique)
  - `first_name` (text)
  - `last_name` (text)
  - `email` (text)
  - `phone` (text)
  - `date_of_birth` (date)
  - `gender` (text)
  - `address` (text)
  - `class_id` (uuid, foreign key)
  - `parent_name` (text)
  - `parent_email` (text)
  - `parent_phone` (text)
  - `admission_date` (date)
  - `photo_url` (text)
  - `status` (text) - "active", "graduated", "withdrawn"
  - `created_at` (timestamptz)

  ### 9. admissions
  - `id` (uuid, primary key)
  - `application_number` (text, unique)
  - `first_name` (text)
  - `last_name` (text)
  - `email` (text)
  - `phone` (text)
  - `date_of_birth` (date)
  - `gender` (text)
  - `address` (text)
  - `parent_name` (text)
  - `parent_email` (text)
  - `parent_phone` (text)
  - `desired_class` (text)
  - `previous_school` (text)
  - `status` (text) - "pending", "accepted", "rejected", "exam_scheduled"
  - `exam_date` (timestamptz)
  - `exam_location` (text)
  - `notes` (text)
  - `submitted_at` (timestamptz)
  - `reviewed_at` (timestamptz)

  ### 10. events
  - `id` (uuid, primary key)
  - `title` (text)
  - `description` (text)
  - `event_type` (text) - "exam", "holiday", "meeting", "sports", "cultural"
  - `start_date` (timestamptz)
  - `end_date` (timestamptz)
  - `location` (text)
  - `is_all_day` (boolean)
  - `created_at` (timestamptz)

  ### 11. assignments
  - `id` (uuid, primary key)
  - `title` (text)
  - `description` (text)
  - `subject_id` (uuid, foreign key)
  - `class_id` (uuid, foreign key)
  - `teacher_id` (uuid, foreign key)
  - `due_date` (timestamptz)
  - `total_marks` (integer)
  - `created_at` (timestamptz)

  ### 12. submissions
  - `id` (uuid, primary key)
  - `assignment_id` (uuid, foreign key)
  - `student_id` (uuid, foreign key)
  - `submitted_at` (timestamptz)
  - `content` (text)
  - `file_url` (text)
  - `marks_obtained` (integer)
  - `feedback` (text)
  - `status` (text) - "pending", "graded"

  ### 13. attendance
  - `id` (uuid, primary key)
  - `student_id` (uuid, foreign key)
  - `class_id` (uuid, foreign key)
  - `date` (date)
  - `status` (text) - "present", "absent", "late", "excused"
  - `marked_by` (uuid, foreign key to teachers)
  - `notes` (text)
  - `created_at` (timestamptz)

  ### 14. news
  - `id` (uuid, primary key)
  - `title` (text)
  - `content` (text)
  - `excerpt` (text)
  - `image_url` (text)
  - `category` (text) - "achievement", "event", "announcement"
  - `published` (boolean)
  - `published_at` (timestamptz)
  - `created_at` (timestamptz)

  ### 15. testimonials
  - `id` (uuid, primary key)
  - `name` (text)
  - `role` (text) - "student", "parent", "alumni"
  - `content` (text)
  - `photo_url` (text)
  - `year` (text)
  - `published` (boolean)
  - `created_at` (timestamptz)

  ### 16. notifications
  - `id` (uuid, primary key)
  - `recipient_id` (uuid) - can be teacher, student, or parent
  - `recipient_type` (text) - "teacher", "student", "parent", "all"
  - `title` (text)
  - `message` (text)
  - `type` (text) - "info", "warning", "success", "error"
  - `read` (boolean)
  - `created_at` (timestamptz)

  ### 17. school_settings
  - `id` (uuid, primary key)
  - `key` (text, unique)
  - `value` (text)
  - `description` (text)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated admin and teacher access
  - Public read access for homepage content (news, testimonials)
*/

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Terms table
CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view terms"
  ON terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage terms"
  ON terms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text NOT NULL,  -- e.g.: Primary 1, JSS 2
  level_of_education text CHECK (
    level_of_education IN (
      'Pre-Primary Education',
      'Primary Education',
      'Junior Secondary Education',
      'Senior Secondary Education'
    )
  ),
  suffix text DEFAULT '',  -- e.g.: A, B, C
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, suffix)
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view classes"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage classes"
  ON classes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view classes"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage classes"
  ON classes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage subjects"
  ON subjects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text DEFAULT '',
  address text DEFAULT '',
  qualification text DEFAULT '',
  specialization text DEFAULT '',
  date_of_birth date,
  hire_date date DEFAULT CURRENT_DATE,
  photo_url text DEFAULT '',
  bio text DEFAULT '',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teachers"
  ON teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage teachers"
  ON teachers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Class teachers assignment
CREATE TABLE IF NOT EXISTS class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  UNIQUE(class_id) -- only one teacher per class
);

ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view class teachers"
  ON class_teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage class teachers"
  ON class_teachers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Subject assignments
CREATE TABLE IF NOT EXISTS subject_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subject_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subject assignments"
  ON subject_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage subject assignments"
  ON subject_assignments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Students table
-- Students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  date_of_birth date,
  gender text DEFAULT '',
  address text DEFAULT '',
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  department text CHECK (department IN ('Science', 'Arts', 'Commercial')),
  parent_name text DEFAULT '',
  parent_email text DEFAULT '',
  parent_phone text DEFAULT '',
  admission_date date DEFAULT CURRENT_DATE,
  photo_url text DEFAULT '',
  status text DEFAULT 'active',

  -- New fields to match MongoDB model
  attendance jsonb DEFAULT '[]',          -- Array of {date, status}
  average_attendance numeric DEFAULT 0,   -- Average attendance %
  results jsonb DEFAULT '[]',             -- Array of {subject, welcomeTest, midTerm, vetting, exam, total, grade}

  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view students"
  ON students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage students"
  ON students FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admissions table
CREATE TABLE IF NOT EXISTS admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  date_of_birth date,
  gender text DEFAULT '',
  address text DEFAULT '',
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text NOT NULL,
  desired_class text NOT NULL,
  previous_school text DEFAULT '',
  status text DEFAULT 'pending',
  exam_date timestamptz,
  exam_location text DEFAULT '',
  notes text DEFAULT '',
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit admission applications"
  ON admissions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view admissions"
  ON admissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage admissions"
  ON admissions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  event_type text DEFAULT 'meeting',
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  location text DEFAULT '',
  is_all_day boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage events"
  ON events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  due_date timestamptz NOT NULL,
  total_marks integer DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can manage their assignments"
  ON assignments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  submitted_at timestamptz DEFAULT now(),
  content text DEFAULT '',
  file_url text DEFAULT '',
  marks_obtained integer,
  feedback text DEFAULT '',
  status text DEFAULT 'pending'
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can manage submissions"
  ON submissions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text DEFAULT 'present',
  marked_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can manage attendance"
  ON attendance FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- News table
CREATE TABLE IF NOT EXISTS news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  excerpt text DEFAULT '',
  image_url text DEFAULT '',
  category text DEFAULT 'announcement',
  published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published news"
  ON news FOR SELECT
  TO anon
  USING (published = true);

CREATE POLICY "Authenticated users can view all news"
  ON news FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage news"
  ON news FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text DEFAULT 'alumni',
  content text NOT NULL,
  photo_url text DEFAULT '',
  year text DEFAULT '',
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published testimonials"
  ON testimonials FOR SELECT
  TO anon
  USING (published = true);

CREATE POLICY "Authenticated users can view all testimonials"
  ON testimonials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage testimonials"
  ON testimonials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid,
  recipient_type text DEFAULT 'all',
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- School settings table
CREATE TABLE IF NOT EXISTS school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view school settings"
  ON school_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage school settings"
  ON school_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_terms_session ON terms(session_id);
CREATE INDEX IF NOT EXISTS idx_classes_session ON classes(session_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);