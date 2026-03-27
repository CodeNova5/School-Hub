// ── Multi-tenancy ────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent';

export interface School {
  id: string;
  name: string;
  subdomain?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Core types ────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  school_id?: string;
}

export interface Term {
  id: string;
  session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  school_id?: string;
}

// ── School Configuration Types ────────────────────────────────────────────

export interface EducationLevel {
  id: string;
  school_id: string;
  name: string;
  code?: string;
  description?: string;
  order_sequence: number;
  is_active: boolean;
  created_at: string;
}

export interface ClassLevel {
  id: string;
  school_id: string;
  education_level_id: string;
  name: string;
  code?: string;
  order_sequence: number;
  is_active: boolean;
  created_at: string;
  education_level?: EducationLevel; // Denormalized for convenience
}

export interface Stream {
  id: string;
  school_id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  school_id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Religion {
  id: string;
  school_id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface EducationLevelSubjectPreset {
  id: string;
  school_id: string;
  education_level_id: string;
  name: string;
  is_optional: boolean;
  department_id?: string | null;
  religion_id?: string | null;
  order_sequence: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResultSchoolSettings {
  id: string;
  school_id: string;
  pass_percentage: number;
  is_configured: boolean;
  configured_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResultComponentTemplate {
  id: string;
  school_id: string;
  component_key: string;
  component_name: string;
  max_score: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResultGradeScale {
  id: string;
  school_id: string;
  grade_label: string;
  min_percentage: number;
  remark?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ── Classes ────────────────────────────────────────────────────────────────

export interface Class {
  id: string;
  school_id: string;
  name: string;
  class_level_id: string;
  stream_id?: string;
  department_id?: string;
  room_number?: string;
  class_teacher_id?: string;
  session_id?: string;
  academic_year?: string;
  created_at: string;
  updated_at: string;
  // Denormalized fields for UI display
  class_level?: ClassLevel;
  stream?: Stream;
  department?: Department;
  teacherName?: string;
  studentCount?: number;
  subjectCount?: number;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  subject_code?: string;
  education_level_id?: string | null;
  department_id?: string | null;
  religion_id?: string | null;
  is_optional: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Denormalized fields for UI display
  education_level?: EducationLevel;
  department?: Department;
  religion?: Religion;
  teacherName?: string;
}

export interface SubjectClassAssignment {
  id: string;
  school_id: string;
  subject_id: string;
  class_id: string;
  teacher_id?: string | null;
  subject_code?: string | null;
  department_id?: string | null;
  religion_id?: string | null;
  is_optional: boolean;
  prerequisite_subject_id?: string | null;
  prerequisite_min_score?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subject?: Subject;
  department?: Department;
  religion?: Religion;
  teacher?: Teacher | null;
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
  school_id?: string;
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
  school_id?: string;
  user_id?: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  gender: 'male' | 'female' | 'others' | '';
  address: string;
  class_id?: string;
  department_id?: string | null;
  religion_id?: string | null;
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

export interface ClassHistory {
  id: string;
  student_id: string;
  class_id: string;
  session_id: string;
  student_name: string;
  student_number: string;
  class_name: string;
  education_level: string;
  department?: string;
  terms_completed: number;
  average_score: number;
  cumulative_grade: string;
  position?: number;
  total_students?: number;
  promoted: boolean;
  promotion_status: 'promoted' | 'graduated' | 'repeated' | 'pending' | 'withdrawn';
  promoted_to_class_id?: string;
  promotion_notes?: string;
  recorded_at: string;
  promoted_at?: string;
  created_at: string;
}

export interface PromotionSettings {
  id: string;
  session_id: string;
  minimum_pass_percentage: number;
  require_all_terms: boolean;
  auto_promote: boolean;
  created_at: string;
  updated_at: string;
}

export type FinanceFeeCategory = 'tuition' | 'uniform' | 'exam' | 'bus' | 'custom';
export type FinanceFeeFrequency = 'per_term' | 'per_session' | 'one_time';
export type FinanceBillStatus = 'pending' | 'partial' | 'paid' | 'waived' | 'overdue' | 'cancelled';
export type FinanceTransactionStatus = 'pending' | 'success' | 'failed' | 'abandoned' | 'reversed';
export type FinancePaymentMethod = 'paystack' | 'bank_transfer' | 'cash' | 'card' | 'manual';

export interface FinanceSettings {
  id: string;
  school_id: string;
  paystack_subaccount_code?: string | null;
  enable_paystack_checkout: boolean;
  default_currency: string;
  invoice_prefix: string;
  receipt_prefix: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceFeeTemplate {
  id: string;
  school_id: string;
  name: string;
  category: FinanceFeeCategory;
  frequency: FinanceFeeFrequency;
  amount: number;
  description: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceFeeTemplateClassAmount {
  id: string;
  school_id: string;
  fee_template_id: string;
  class_id: string;
  class_amount: number;
  created_at: string;
}

export interface FinanceStudentBill {
  id: string;
  school_id: string;
  student_id: string;
  class_id?: string | null;
  session_id?: string | null;
  term_id?: string | null;
  billing_cycle: FinanceFeeFrequency;
  due_date?: string | null;
  status: FinanceBillStatus;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceBillItem {
  id: string;
  school_id: string;
  bill_id: string;
  fee_template_id?: string | null;
  title: string;
  frequency: FinanceFeeFrequency;
  original_amount: number;
  amount: number;
  override_type: 'none' | 'discount' | 'waiver' | 'custom';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  school_id: string;
  bill_id: string;
  student_id: string;
  reference: string;
  provider: 'paystack' | 'manual';
  payment_method: FinancePaymentMethod;
  status: FinanceTransactionStatus;
  amount: number;
  paid_at?: string | null;
  provider_reference?: string | null;
  idempotency_key?: string | null;
  metadata: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceReceipt {
  id: string;
  school_id: string;
  bill_id: string;
  transaction_id: string;
  student_id: string;
  receipt_number: string;
  invoice_number?: string | null;
  issued_at: string;
  payload: Record<string, unknown>;
  created_at: string;
}
