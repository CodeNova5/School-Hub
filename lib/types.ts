export interface Session {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  level: string;
  education_level: 'Pre-Primary' | 'Primary' | 'JSS' | 'SSS';
  capacity: number;
  room_number?: string;
  class_teacher_id?: string;
  academic_year?: string;
  department?: 'Science' | 'Arts' | 'Commercial';
  stream?: string;
  session_id?: string;
  created_at: string;
  teacherName?: string;
  studentCount?: number;
  subjectCount?: number;
}

export interface Subject {
  id: string;
  name: string;
  education_level: 'Pre-Primary' | 'Primary' | 'JSS' | 'SSS';
  department?: 'Science' | 'Arts' | 'Commercial';
  religion?: 'Christian' | 'Muslim';
  student_count?: number;
  is_optional: boolean;
  teacher_id?: string;
  created_at: string;
  teacherName?: string;
}

export interface Teacher {
  id: string;
  user_id?: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  qualification: string;
  specialization: string;
  date_of_birth?: string;
  hire_date: string;
  photo_url: string;
  bio: string;
  status: 'active' | 'on_leave' | 'inactive';
  created_at: string;
}

export interface AttendanceEntry {
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

export interface Result {
  subject_name: string;
  welcome_test: number;
  mid_term_test: number;
  vetting: number;
  exam: number;
  total: number;
  grade: string;
  session_id: string;
  term_id: string;
  class_position?: number | null;
  total_students?: number | null;
  class_average?: number | null;
}

export interface Student {
  id: string;
  auth_id?: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  gender: string;
  address: string;
  class_id?: string;
  department?: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  admission_date: string;
  photo_url?: string;
  status: 'active' | 'graduated' | 'withdrawn' | 'suspended';
  attendance: AttendanceEntry[];
  average_attendance: number;
  results: Result[];
  created_at: string;
}

export interface Session {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  name: string;
  session_id: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Admission {
  id: string;
  application_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  gender: string;
  address: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  desired_class: string;
  previous_school: string;
  status: 'pending' | 'accepted' | 'rejected' | 'exam_scheduled';
  exam_date?: string;
  exam_location: string;
  notes: string;
  submitted_at: string;
  reviewed_at?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  event_type: 'exam' | 'holiday' | 'meeting' | 'sports' | 'cultural';
  start_date: string;
  end_date: string;
  location: string;
  is_all_day: boolean;
  created_at: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  teacher_id: string;
  due_date: string;
  total_marks: number;
  created_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  content: string;
  file_url: string;
  marks_obtained?: number;
  feedback: string;
  status: 'pending' | 'graded';
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  marked_by?: string;
  notes: string;
  created_at: string;
}

export interface News {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  image_url: string;
  category: 'achievement' | 'event' | 'announcement';
  published: boolean;
  published_at?: string;
  created_at: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: 'student' | 'parent' | 'alumni';
  content: string;
  photo_url: string;
  year: string;
  published: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id?: string;
  recipient_type: 'teacher' | 'student' | 'parent' | 'all';
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  created_at: string;
}
