/**
 * Database Schema Description for AI Assistant
 * This file contains schema metadata used by the AI query planner.
 * It should stay aligned with the live database structure.
 */

export interface ColumnInfo {
  name: string;
  type: string;
  description: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: string;
}

export interface TableInfo {
  name: string;
  description: string;
  columns: ColumnInfo[];
  rlsEnabled: boolean;
}

export const DATABASE_SCHEMA: TableInfo[] = [
  {
    name: 'schools',
    description: 'School tenant records; all data access is scoped by school',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique school identifier', isPrimaryKey: true },
      { name: 'name', type: 'text', description: 'School name' },
      { name: 'subdomain', type: 'text', description: 'School subdomain slug' },
      { name: 'address', type: 'text', description: 'School address' },
      { name: 'phone', type: 'text', description: 'School phone number' },
      { name: 'email', type: 'text', description: 'School email' },
      { name: 'logo_url', type: 'text', description: 'School logo URL' },
      { name: 'is_active', type: 'boolean', description: 'School active flag' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },

  {
    name: 'admins',
    description: 'School admin user profiles and linkage to auth.users',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Admin ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'user_id', type: 'uuid', description: 'Auth user', isForeignKey: true, references: 'auth.users(id)' },
      { name: 'name', type: 'text', description: 'Admin full name' },
      { name: 'email', type: 'text', description: 'Admin email' },
      { name: 'phone', type: 'text', description: 'Admin phone number' },
      { name: 'is_active', type: 'boolean', description: 'Active account flag' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'sessions',
    description: 'Academic sessions per school',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Session ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'name', type: 'text', description: 'Session label (e.g. 2025/2026)' },
      { name: 'start_date', type: 'date', description: 'Session start date' },
      { name: 'end_date', type: 'date', description: 'Session end date' },
      { name: 'is_current', type: 'boolean', description: 'Current session marker' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'terms',
    description: 'Terms under sessions',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Term ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'session_id', type: 'uuid', description: 'Parent session', isForeignKey: true, references: 'sessions(id)' },
      { name: 'name', type: 'text', description: 'Term name' },
      { name: 'start_date', type: 'date', description: 'Term start date' },
      { name: 'end_date', type: 'date', description: 'Term end date' },
      { name: 'is_current', type: 'boolean', description: 'Current term marker' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'teachers',
    description: 'Teacher profiles and account linkage',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Teacher ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'user_id', type: 'uuid', description: 'Auth user', isForeignKey: true, references: 'auth.users(id)' },
      { name: 'staff_id', type: 'text', description: 'Staff identifier' },
      { name: 'first_name', type: 'text', description: 'First name' },
      { name: 'last_name', type: 'text', description: 'Last name' },
      { name: 'email', type: 'text', description: 'Teacher email' },
      { name: 'phone', type: 'text', description: 'Teacher phone number' },
      { name: 'status', type: 'text', description: 'Teacher status' },
      { name: 'is_active', type: 'boolean', description: 'Active account flag' },
      { name: 'hire_date', type: 'date', description: 'Hire date' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'classes',
    description: 'School classes with level/stream/department mapping',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Class ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'name', type: 'text', description: 'Class display name' },
      { name: 'class_level_id', type: 'uuid', description: 'Class level reference', isForeignKey: true, references: 'school_class_levels(id)' },
      { name: 'stream_id', type: 'uuid', description: 'Optional stream reference', isForeignKey: true, references: 'school_streams(id)' },
      { name: 'department_id', type: 'uuid', description: 'Optional department reference', isForeignKey: true, references: 'school_departments(id)' },
      { name: 'class_teacher_id', type: 'uuid', description: 'Class teacher', isForeignKey: true, references: 'teachers(id)' },
      { name: 'session_id', type: 'uuid', description: 'Session reference', isForeignKey: true, references: 'sessions(id)' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'students',
    description: 'Student enrollment and identity data',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Student ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'user_id', type: 'uuid', description: 'Auth user', isForeignKey: true, references: 'auth.users(id)' },
      { name: 'class_id', type: 'uuid', description: 'Current class', isForeignKey: true, references: 'classes(id)' },
      { name: 'department_id', type: 'uuid', description: 'Optional department', isForeignKey: true, references: 'school_departments(id)' },
      { name: 'religion_id', type: 'uuid', description: 'Optional religion', isForeignKey: true, references: 'school_religions(id)' },
      { name: 'student_id', type: 'text', description: 'School student number' },
      { name: 'first_name', type: 'text', description: 'First name' },
      { name: 'last_name', type: 'text', description: 'Last name' },
      { name: 'email', type: 'text', description: 'Student email' },
      { name: 'status', type: 'text', description: 'Student status' },
      { name: 'is_active', type: 'boolean', description: 'Active account flag' },
      { name: 'parent_email', type: 'text', description: 'Parent email for parent-scoped features' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'subjects',
    description: 'Subject master records',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Subject ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'name', type: 'text', description: 'Subject name' },
      { name: 'subject_code', type: 'text', description: 'Subject code' },
      { name: 'education_level_id', type: 'uuid', description: 'Education level reference', isForeignKey: true, references: 'school_education_levels(id)' },
      { name: 'department_id', type: 'uuid', description: 'Optional department reference', isForeignKey: true, references: 'school_departments(id)' },
      { name: 'religion_id', type: 'uuid', description: 'Optional religion reference', isForeignKey: true, references: 'school_religions(id)' },
      { name: 'is_optional', type: 'boolean', description: 'Optional subject flag' },
      { name: 'is_active', type: 'boolean', description: 'Active flag' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'subject_classes',
    description: 'Class-subject-teacher assignments',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Subject class ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'subject_id', type: 'uuid', description: 'Subject reference', isForeignKey: true, references: 'subjects(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class reference', isForeignKey: true, references: 'classes(id)' },
      { name: 'teacher_id', type: 'uuid', description: 'Teacher reference', isForeignKey: true, references: 'teachers(id)' },
      { name: 'department_id', type: 'uuid', description: 'Optional department filter', isForeignKey: true, references: 'school_departments(id)' },
      { name: 'religion_id', type: 'uuid', description: 'Optional religion filter', isForeignKey: true, references: 'school_religions(id)' },
      { name: 'is_optional', type: 'boolean', description: 'Optional subject assignment flag' },
      { name: 'is_active', type: 'boolean', description: 'Active flag' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'student_subjects',
    description: 'Student-subject_class enrollments',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Student subject row ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'subject_class_id', type: 'uuid', description: 'Subject class reference', isForeignKey: true, references: 'subject_classes(id)' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
    ]
  },
  {
    name: 'attendance',
    description: 'Daily student attendance',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Attendance ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class reference', isForeignKey: true, references: 'classes(id)' },
      { name: 'session_id', type: 'uuid', description: 'Session reference', isForeignKey: true, references: 'sessions(id)' },
      { name: 'term_id', type: 'uuid', description: 'Term reference', isForeignKey: true, references: 'terms(id)' },
      { name: 'date', type: 'date', description: 'Attendance date' },
      { name: 'status', type: 'text', description: 'present, absent, late, excused' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
    ]
  },
  {
    name: 'assignments',
    description: 'Assignments created for classes and subjects',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Assignment ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'title', type: 'text', description: 'Assignment title' },
      { name: 'description', type: 'text', description: 'Assignment description' },
      { name: 'subject_id', type: 'uuid', description: 'Subject reference', isForeignKey: true, references: 'subjects(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class reference', isForeignKey: true, references: 'classes(id)' },
      { name: 'teacher_id', type: 'uuid', description: 'Teacher reference', isForeignKey: true, references: 'teachers(id)' },
      { name: 'session_id', type: 'uuid', description: 'Session reference', isForeignKey: true, references: 'sessions(id)' },
      { name: 'term_id', type: 'uuid', description: 'Term reference', isForeignKey: true, references: 'terms(id)' },
      { name: 'due_date', type: 'date', description: 'Due date' },
      { name: 'total_marks', type: 'numeric', description: 'Max marks' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'assignment_submissions',
    description: 'Student assignment submissions and grading',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Submission ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'assignment_id', type: 'uuid', description: 'Assignment reference', isForeignKey: true, references: 'assignments(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'submitted_at', type: 'timestamptz', description: 'Submission time' },
      { name: 'submitted_on_time', type: 'boolean', description: 'On-time submission flag' },
      { name: 'grade', type: 'numeric', description: 'Score awarded' },
      { name: 'feedback', type: 'text', description: 'Grading feedback' },
      { name: 'graded_at', type: 'timestamptz', description: 'Graded time' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'results',
    description: 'Per student/subject-class assessment result row',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Result ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'subject_class_id', type: 'uuid', description: 'Subject class reference', isForeignKey: true, references: 'subject_classes(id)' },
      { name: 'session_id', type: 'uuid', description: 'Session reference', isForeignKey: true, references: 'sessions(id)' },
      { name: 'term_id', type: 'uuid', description: 'Term reference', isForeignKey: true, references: 'terms(id)' },
      { name: 'welcome_test_score', type: 'numeric', description: 'Welcome test component score' },
      { name: 'mid_term_test_score', type: 'numeric', description: 'Mid-term component score' },
      { name: 'vetting_score', type: 'numeric', description: 'Vetting component score' },
      { name: 'exam_score', type: 'numeric', description: 'Exam component score' },
      { name: 'total', type: 'numeric', description: 'Total score' },
      { name: 'grade', type: 'text', description: 'Grade label' },
      { name: 'remark', type: 'text', description: 'Teacher remark' },
      { name: 'is_visible_to_parents', type: 'boolean', description: 'Visibility to parent portal' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'results_publication',
    description: 'Class-term publication controls for result visibility',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Publication ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class reference', isForeignKey: true, references: 'classes(id)' },
      { name: 'session_id', type: 'uuid', description: 'Session reference', isForeignKey: true, references: 'sessions(id)' },
      { name: 'term_id', type: 'uuid', description: 'Term reference', isForeignKey: true, references: 'terms(id)' },
      { name: 'is_published', type: 'boolean', description: 'General published flag' },
      { name: 'is_published_to_parents', type: 'boolean', description: 'Parent portal visibility flag' },
      { name: 'calculation_mode', type: 'text', description: 'Calculation mode used at publication' },
      { name: 'published_component_keys', type: 'text[]', description: 'Visible assessment components' },
      { name: 'published_at', type: 'timestamptz', description: 'Publish timestamp' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'result_school_settings',
    description: 'Per-school result grading configuration header',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Settings ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'pass_percentage', type: 'numeric', description: 'Pass threshold percentage' },
      { name: 'is_configured', type: 'boolean', description: 'Configuration status' },
      { name: 'configured_at', type: 'timestamptz', description: 'Configured timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'result_component_templates',
    description: 'Result score component templates (e.g. test, exam)',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Template ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'component_key', type: 'text', description: 'Component machine key' },
      { name: 'component_name', type: 'text', description: 'Component display name' },
      { name: 'max_score', type: 'numeric', description: 'Maximum score' },
      { name: 'display_order', type: 'integer', description: 'Display ordering' },
      { name: 'is_active', type: 'boolean', description: 'Active component flag' },
    ]
  },
  {
    name: 'result_grade_scales',
    description: 'Per-school grading bands',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Grade scale row ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'grade_label', type: 'text', description: 'Grade label' },
      { name: 'min_percentage', type: 'numeric', description: 'Minimum score threshold' },
      { name: 'remark', type: 'text', description: 'Performance remark' },
      { name: 'display_order', type: 'integer', description: 'Display ordering' },
    ]
  },
  {
    name: 'period_slots',
    description: 'Time slots for timetable periods and breaks',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Period slot ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'day_of_week', type: 'text', description: 'Weekday name' },
      { name: 'period_number', type: 'integer', description: 'Period number for non-break rows' },
      { name: 'start_time', type: 'time', description: 'Start time' },
      { name: 'end_time', type: 'time', description: 'End time' },
      { name: 'is_break', type: 'boolean', description: 'Break row flag' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'timetable_entries',
    description: 'Timetable rows for class, period and subject',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Timetable entry ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class reference', isForeignKey: true, references: 'classes(id)' },
      { name: 'period_slot_id', type: 'uuid', description: 'Period slot reference', isForeignKey: true, references: 'period_slots(id)' },
      { name: 'subject_id', type: 'uuid', description: 'Subject reference', isForeignKey: true, references: 'subjects(id)' },
      { name: 'subject_class_id', type: 'uuid', description: 'Subject class reference (legacy/compat)', isForeignKey: true, references: 'subject_classes(id)' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'live_sessions',
    description: 'Scheduled/live online classes with class-scoped access',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Live session ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class reference', isForeignKey: true, references: 'classes(id)' },
      { name: 'subject_class_id', type: 'uuid', description: 'Subject class reference', isForeignKey: true, references: 'subject_classes(id)' },
      { name: 'teacher_id', type: 'uuid', description: 'Teacher reference', isForeignKey: true, references: 'teachers(id)' },
      { name: 'title', type: 'text', description: 'Live session title' },
      { name: 'meeting_id', type: 'text', description: 'External meeting id' },
      { name: 'scheduled_for', type: 'timestamptz', description: 'Scheduled start' },
      { name: 'scheduled_end_at', type: 'timestamptz', description: 'Scheduled end' },
      { name: 'status', type: 'text', description: 'scheduled, live, ended, cancelled' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'teacher_attendance',
    description: 'Teacher attendance records',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Attendance row ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'teacher_id', type: 'uuid', description: 'Teacher reference', isForeignKey: true, references: 'teachers(id)' },
      { name: 'date', type: 'date', description: 'Attendance date' },
      { name: 'status', type: 'text', description: 'present, absent, late, excused' },
      { name: 'marked_by', type: 'uuid', description: 'Marker teacher reference', isForeignKey: true, references: 'teachers(id)' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'notification_logs',
    description: 'Push/in-app notification send logs',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Log ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'title', type: 'text', description: 'Notification title' },
      { name: 'body', type: 'text', description: 'Notification body' },
      { name: 'target', type: 'text', description: 'all, role, user, class target mode' },
      { name: 'target_value', type: 'text', description: 'Target value payload' },
      { name: 'success_count', type: 'integer', description: 'Successful deliveries count' },
      { name: 'failure_count', type: 'integer', description: 'Failed deliveries count' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
    ]
  },
  {
    name: 'email_logs',
    description: 'Email dispatch logs',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Email log ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'title', type: 'text', description: 'Email subject/title' },
      { name: 'body', type: 'text', description: 'Email body' },
      { name: 'target', type: 'text', description: 'all, role, user, class target mode' },
      { name: 'sent_by', type: 'uuid', description: 'Sender user id', isForeignKey: true, references: 'auth.users(id)' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
    ]
  },
  {
    name: 'ai_chat_sessions',
    description: 'AI assistant chat conversation sessions',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Session ID', isPrimaryKey: true },
      { name: 'user_id', type: 'uuid', description: 'Session owner user id', isForeignKey: true, references: 'auth.users(id)' },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'title', type: 'text', description: 'Session title' },
      { name: 'is_pinned', type: 'boolean', description: 'Pinned flag' },
      { name: 'is_archived', type: 'boolean', description: 'Archived flag' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'ai_chat_messages',
    description: 'AI assistant messages per session',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Message ID', isPrimaryKey: true },
      { name: 'session_id', type: 'uuid', description: 'Chat session reference', isForeignKey: true, references: 'ai_chat_sessions(id)' },
      { name: 'user_id', type: 'uuid', description: 'Message owner user id', isForeignKey: true, references: 'auth.users(id)' },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'role', type: 'text', description: 'user or assistant role' },
      { name: 'content', type: 'text', description: 'Message content' },
      { name: 'query_plan', type: 'jsonb', description: 'Generated query plan metadata' },
      { name: 'error', type: 'boolean', description: 'Assistant message error marker' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
    ]
  },
  {
    name: 'website_pages',
    description: 'Website builder pages per school',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Page ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'title', type: 'text', description: 'Page title' },
      { name: 'slug', type: 'text', description: 'Page slug' },
      { name: 'status', type: 'text', description: 'draft or published status' },
      { name: 'published_at', type: 'timestamptz', description: 'Publication timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'website_sections',
    description: 'Website page sections and their JSON content',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Section ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'page_id', type: 'uuid', description: 'Page reference', isForeignKey: true, references: 'website_pages(id)' },
      { name: 'section_key', type: 'text', description: 'Section key identifier' },
      { name: 'section_label', type: 'text', description: 'Section display label' },
      { name: 'order_sequence', type: 'integer', description: 'Section order' },
      { name: 'is_visible', type: 'boolean', description: 'Visibility flag' },
      { name: 'content', type: 'jsonb', description: 'Section JSON content payload' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'website_media',
    description: 'Uploaded media used by website builder',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Media ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'page_id', type: 'uuid', description: 'Optional page reference', isForeignKey: true, references: 'website_pages(id)' },
      { name: 'file_name', type: 'text', description: 'Original file name' },
      { name: 'public_url', type: 'text', description: 'Public media URL' },
      { name: 'mime_type', type: 'text', description: 'MIME type' },
      { name: 'file_size', type: 'bigint', description: 'File size in bytes' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'website_alumni_profiles',
    description: 'Published alumni profile directory',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Alumni profile ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'profile_slug', type: 'text', description: 'Public profile slug' },
      { name: 'full_name', type: 'text', description: 'Alumni full name' },
      { name: 'occupation', type: 'text', description: 'Occupation/title' },
      { name: 'is_visible', type: 'boolean', description: 'Public visibility flag' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'website_alumni_applications',
    description: 'Alumni application moderation queue',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Application ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'full_name', type: 'text', description: 'Applicant name' },
      { name: 'email', type: 'text', description: 'Applicant email' },
      { name: 'status', type: 'text', description: 'pending, approved, rejected' },
      { name: 'reviewed_at', type: 'timestamptz', description: 'Review timestamp' },
      { name: 'approved_profile_id', type: 'uuid', description: 'Approved profile link', isForeignKey: true, references: 'website_alumni_profiles(id)' },
      { name: 'submitted_at', type: 'timestamptz', description: 'Submission timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'finance_settings',
    description: 'Finance module settings per school',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Settings ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'paystack_subaccount_code', type: 'text', description: 'Paystack subaccount code' },
      { name: 'enable_paystack_checkout', type: 'boolean', description: 'Checkout enabled flag' },
      { name: 'default_currency', type: 'text', description: 'Default currency code' },
      { name: 'invoice_prefix', type: 'text', description: 'Invoice number prefix' },
      { name: 'receipt_prefix', type: 'text', description: 'Receipt number prefix' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'finance_fee_templates',
    description: 'Reusable fee templates for billing',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Fee template ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'name', type: 'text', description: 'Template name' },
      { name: 'category', type: 'text', description: 'tuition, uniform, exam, bus, custom' },
      { name: 'frequency', type: 'text', description: 'per_term, per_session, one_time' },
      { name: 'amount', type: 'numeric', description: 'Template amount' },
      { name: 'is_active', type: 'boolean', description: 'Active flag' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'finance_student_bills',
    description: 'Per-student bills with computed payment status',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Bill ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'session_id', type: 'uuid', description: 'Session reference', isForeignKey: true, references: 'sessions(id)' },
      { name: 'term_id', type: 'uuid', description: 'Term reference', isForeignKey: true, references: 'terms(id)' },
      { name: 'status', type: 'text', description: 'pending, partial, paid, waived, overdue, cancelled' },
      { name: 'total_amount', type: 'numeric', description: 'Total billed amount' },
      { name: 'amount_paid', type: 'numeric', description: 'Total paid amount' },
      { name: 'balance_amount', type: 'numeric', description: 'Remaining balance' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'finance_transactions',
    description: 'Payment transactions against student bills',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Transaction ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'bill_id', type: 'uuid', description: 'Bill reference', isForeignKey: true, references: 'finance_student_bills(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'reference', type: 'text', description: 'Unique transaction reference' },
      { name: 'provider', type: 'text', description: 'paystack or manual provider' },
      { name: 'payment_method', type: 'text', description: 'paystack, bank_transfer, cash, card, manual' },
      { name: 'status', type: 'text', description: 'pending, success, failed, abandoned, reversed' },
      { name: 'amount', type: 'numeric', description: 'Paid amount' },
      { name: 'paid_at', type: 'timestamptz', description: 'Payment timestamp' },
      { name: 'provider_reference', type: 'text', description: 'Gateway reference' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'finance_receipts',
    description: 'Generated receipts for successful transactions',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Receipt ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'bill_id', type: 'uuid', description: 'Bill reference', isForeignKey: true, references: 'finance_student_bills(id)' },
      { name: 'transaction_id', type: 'uuid', description: 'Transaction reference', isForeignKey: true, references: 'finance_transactions(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'receipt_number', type: 'text', description: 'Receipt number' },
      { name: 'invoice_number', type: 'text', description: 'Invoice number' },
      { name: 'issued_at', type: 'timestamptz', description: 'Issue timestamp' },
    ]
  },
  {
    name: 'jamb_questions',
    description: 'JAMB CBT question bank',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Question ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'subject_slug', type: 'text', description: 'Subject slug' },
      { name: 'subject_name', type: 'text', description: 'Subject name' },
      { name: 'exam_year', type: 'int', description: 'Exam year' },
      { name: 'topic', type: 'text', description: 'Question topic' },
      { name: 'question_text', type: 'text', description: 'Question body' },
      { name: 'options', type: 'jsonb', description: 'Multiple choice options' },
      { name: 'correct_option', type: 'text', description: 'Correct option key' },
      { name: 'explanation', type: 'text', description: 'Solution explanation' },
      { name: 'image_url', type: 'text', description: 'Optional image URL' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'jamb_student_access',
    description: 'Per-student JAMB CBT access grants',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Access row ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'granted_by_user_id', type: 'uuid', description: 'Granting admin user id', isForeignKey: true, references: 'auth.users(id)' },
      { name: 'is_active', type: 'boolean', description: 'Grant active flag' },
      { name: 'notes', type: 'text', description: 'Admin notes' },
      { name: 'granted_at', type: 'timestamptz', description: 'Grant timestamp' },
      { name: 'revoked_at', type: 'timestamptz', description: 'Revocation timestamp' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  },
  {
    name: 'jamb_attempts',
    description: 'Student CBT attempts and scores',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Attempt ID', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'subject_slug', type: 'text', description: 'Subject slug' },
      { name: 'subject_name', type: 'text', description: 'Subject name' },
      { name: 'exam_year', type: 'int', description: 'Exam year' },
      { name: 'total_questions', type: 'int', description: 'Total questions in attempt' },
      { name: 'correct_count', type: 'int', description: 'Correct answers count' },
      { name: 'score', type: 'numeric', description: 'Percent score' },
      { name: 'answers', type: 'jsonb', description: 'Submitted answer details' },
      { name: 'created_at', type: 'timestamptz', description: 'Creation timestamp' },
    ]
  },
  {
    name: 'jamb_exam_sessions',
    description: 'Active/submitted exam session lock records',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Exam session ID', isPrimaryKey: true },
      { name: 'student_id', type: 'uuid', description: 'Student reference', isForeignKey: true, references: 'students(id)' },
      { name: 'school_id', type: 'uuid', description: 'Owning school', isForeignKey: true, references: 'schools(id)' },
      { name: 'subject_slug', type: 'text', description: 'Subject slug' },
      { name: 'exam_year', type: 'integer', description: 'Exam year' },
      { name: 'status', type: 'text', description: 'active, submitted, expired, cancelled' },
      { name: 'started_at', type: 'timestamptz', description: 'Session start time' },
      { name: 'duration_minutes', type: 'integer', description: 'Exam duration in minutes' },
      { name: 'expires_at', type: 'timestamptz', description: 'Session expiry time' },
      { name: 'session_token', type: 'text', description: 'Unique session token' },
      { name: 'updated_at', type: 'timestamptz', description: 'Update timestamp' },
    ]
  }
];

/**
 * Get a simplified schema description for AI consumption.
 */
export function getSchemaDescription(): string {
  return DATABASE_SCHEMA.map((table) => {
    const columns = table.columns.map((col) => {
      let colDesc = `  - ${col.name} (${col.type}): ${col.description}`;
      if (col.isForeignKey && col.references) {
        colDesc += ` [FK -> ${col.references}]`;
      }
      return colDesc;
    }).join('\n');

    return `${table.name}: ${table.description}\n${columns}`;
  }).join('\n\n');
}

/**
 * Get table info by name.
 */
export function getTableInfo(tableName: string): TableInfo | undefined {
  return DATABASE_SCHEMA.find((table) => table.name === tableName);
}

/**
 * Get all table names.
 */
export function getAllTableNames(): string[] {
  return DATABASE_SCHEMA.map((table) => table.name);
}
