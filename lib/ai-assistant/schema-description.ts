/**
 * Database Schema Description for AI Assistant
 * This file contains the schema information that the AI uses to generate queries.
 * Only includes table and column metadata - no sensitive data.
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
    name: 'students',
    description: 'Student information and enrollment data',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique student identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'text', description: 'Student ID number' },
      { name: 'first_name', type: 'text', description: 'Student first name' },
      { name: 'last_name', type: 'text', description: 'Student last name' },
      { name: 'email', type: 'text', description: 'Student email address' },
      { name: 'phone', type: 'text', description: 'Student phone number' },
      { name: 'date_of_birth', type: 'date', description: 'Student date of birth' },
      { name: 'gender', type: 'text', description: 'Student gender' },
      { name: 'class_id', type: 'uuid', description: 'Current class assignment', isForeignKey: true, references: 'classes(id)' },
      { name: 'department', type: 'text', description: 'Department (Science, Arts, Commercial)' },
      { name: 'religion', type: 'text', description: 'Religion (Christian, Muslim)' },
      { name: 'parent_name', type: 'text', description: 'Parent/Guardian name' },
      { name: 'parent_email', type: 'text', description: 'Parent email address' },
      { name: 'parent_phone', type: 'text', description: 'Parent phone number' },
      { name: 'status', type: 'text', description: 'Student status (active, inactive, graduated)' },
      { name: 'average_attendance', type: 'numeric', description: 'Average attendance percentage' },
    ]
  },
  {
    name: 'classes',
    description: 'Class/grade level information',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique class identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'name', type: 'text', description: 'Class name' },
      { name: 'level', type: 'text', description: 'Grade level (Nursery 1, Primary 1-6, JSS 1-3, SSS 1-3)' },
      { name: 'education_level', type: 'text', description: 'Education level (Pre-Primary, Primary, JSS, SSS)' },
      { name: 'department', type: 'text', description: 'Department (Science, Arts, Commercial)' },
      { name: 'stream', type: 'text', description: 'Stream/Section (A, B, C)' },
      { name: 'room_number', type: 'text', description: 'Classroom number' },
      { name: 'class_teacher_id', type: 'uuid', description: 'Class teacher', isForeignKey: true, references: 'teachers(id)' },
      { name: 'session_id', type: 'uuid', description: 'Academic session', isForeignKey: true, references: 'sessions(id)' },
    ]
  },
  {
    name: 'teachers',
    description: 'Teacher information and credentials',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique teacher identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'staff_id', type: 'text', description: 'Staff identification number' },
      { name: 'first_name', type: 'text', description: 'Teacher first name' },
      { name: 'last_name', type: 'text', description: 'Teacher last name' },
      { name: 'email', type: 'text', description: 'Teacher email address' },
      { name: 'phone', type: 'text', description: 'Teacher phone number' },
      { name: 'qualification', type: 'text', description: 'Academic qualifications' },
      { name: 'specialization', type: 'text', description: 'Subject specialization' },
      { name: 'status', type: 'text', description: 'Employment status (active, inactive)' },
      { name: 'hire_date', type: 'date', description: 'Date of hiring' },
    ]
  },
  {
    name: 'subjects',
    description: 'Available subjects/courses',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique subject identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'name', type: 'text', description: 'Subject name (e.g., Mathematics, English)' },
      { name: 'subject_code', type: 'text', description: 'Subject code' },
      { name: 'education_level', type: 'text', description: 'Education level (Pre-Primary, Primary, JSS, SSS)' },
      { name: 'department', type: 'text', description: 'Department (Science, Arts, Commercial)' },
      { name: 'religion', type: 'text', description: 'Religious subject (Christian, Muslim)' },
      { name: 'is_optional', type: 'boolean', description: 'Is this an optional subject?' },
    ]
  },
  {
    name: 'subject_classes',
    description: 'Subjects assigned to classes with teachers',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'subject_id', type: 'uuid', description: 'Subject', isForeignKey: true, references: 'subjects(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class', isForeignKey: true, references: 'classes(id)' },
      { name: 'teacher_id', type: 'uuid', description: 'Assigned teacher', isForeignKey: true, references: 'teachers(id)' },
    ]
  },
  {
    name: 'results',
    description: 'Student academic results and grades',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique result identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student', isForeignKey: true, references: 'students(id)' },
      { name: 'subject_class_id', type: 'uuid', description: 'Subject class', isForeignKey: true, references: 'subject_classes(id)' },
      { name: 'session_id', type: 'uuid', description: 'Academic session', isForeignKey: true, references: 'sessions(id)' },
      { name: 'term_id', type: 'uuid', description: 'Academic term', isForeignKey: true, references: 'terms(id)' },
      { name: 'welcome_test', type: 'numeric', description: 'Welcome test score' },
      { name: 'mid_term_test', type: 'numeric', description: 'Mid-term test score' },
      { name: 'vetting', type: 'numeric', description: 'Vetting score' },
      { name: 'exam', type: 'numeric', description: 'Final exam score' },
      { name: 'total', type: 'numeric', description: 'Total score (sum of all components)' },
      { name: 'grade', type: 'text', description: 'Letter grade (A, B, C, D, F)' },
      { name: 'remark', type: 'text', description: 'Performance remark (Excellent, Good, etc.)' },
    ]
  },
  {
    name: 'attendance',
    description: 'Student attendance records',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique attendance identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'student_id', type: 'uuid', description: 'Student', isForeignKey: true, references: 'students(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class', isForeignKey: true, references: 'classes(id)' },
      { name: 'date', type: 'date', description: 'Attendance date' },
      { name: 'status', type: 'text', description: 'Attendance status (present, absent, late, excused)' },
      { name: 'term_id', type: 'uuid', description: 'Academic term', isForeignKey: true, references: 'terms(id)' },
      { name: 'session_id', type: 'uuid', description: 'Academic session', isForeignKey: true, references: 'sessions(id)' },
    ]
  },
  {
    name: 'assignments',
    description: 'Teacher assignments and homework',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique assignment identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'title', type: 'text', description: 'Assignment title' },
      { name: 'description', type: 'text', description: 'Assignment instructions' },
      { name: 'teacher_id', type: 'uuid', description: 'Assigning teacher', isForeignKey: true, references: 'teachers(id)' },
      { name: 'class_id', type: 'uuid', description: 'Target class', isForeignKey: true, references: 'classes(id)' },
      { name: 'subject_id', type: 'uuid', description: 'Subject', isForeignKey: true, references: 'subjects(id)' },
      { name: 'due_date', type: 'timestamptz', description: 'Submission deadline' },
      { name: 'total_points', type: 'integer', description: 'Maximum points' },
      { name: 'session_id', type: 'uuid', description: 'Academic session', isForeignKey: true, references: 'sessions(id)' },
      { name: 'term_id', type: 'uuid', description: 'Academic term', isForeignKey: true, references: 'terms(id)' },
    ]
  },
  {
    name: 'assignment_submissions',
    description: 'Student assignment submissions',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique submission identifier', isPrimaryKey: true },
      { name: 'assignment_id', type: 'uuid', description: 'Assignment', isForeignKey: true, references: 'assignments(id)' },
      { name: 'student_id', type: 'uuid', description: 'Submitting student', isForeignKey: true, references: 'students(id)' },
      { name: 'submitted_at', type: 'timestamptz', description: 'Submission timestamp' },
      { name: 'score', type: 'numeric', description: 'Awarded score' },
      { name: 'feedback', type: 'text', description: 'Teacher feedback' },
      { name: 'graded_at', type: 'timestamptz', description: 'Grading timestamp' },
      { name: 'on_time', type: 'boolean', description: 'Was submission on time?' },
    ]
  },
  {
    name: 'sessions',
    description: 'Academic year/session information',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique session identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'name', type: 'text', description: 'Session name (e.g., 2024/2025)' },
      { name: 'start_date', type: 'date', description: 'Session start date' },
      { name: 'end_date', type: 'date', description: 'Session end date' },
      { name: 'is_current', type: 'boolean', description: 'Is this the current session?' },
    ]
  },
  {
    name: 'terms',
    description: 'Academic terms within sessions',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique term identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'session_id', type: 'uuid', description: 'Parent session', isForeignKey: true, references: 'sessions(id)' },
      { name: 'name', type: 'text', description: 'Term name (First Term, Second Term, Third Term)' },
      { name: 'start_date', type: 'date', description: 'Term start date' },
      { name: 'end_date', type: 'date', description: 'Term end date' },
      { name: 'is_current', type: 'boolean', description: 'Is this the current term?' },
    ]
  },
  {
    name: 'events',
    description: 'School calendar events',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique event identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'title', type: 'text', description: 'Event title' },
      { name: 'description', type: 'text', description: 'Event description' },
      { name: 'start_date', type: 'date', description: 'Event start date' },
      { name: 'end_date', type: 'date', description: 'Event end date' },
      { name: 'event_type', type: 'text', description: 'Event type (holiday, exam, sports, etc.)' },
    ]
  },
  {
    name: 'timetable_entries',
    description: 'Class timetable schedule',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique timetable entry identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'class_id', type: 'uuid', description: 'Class', isForeignKey: true, references: 'classes(id)' },
      { name: 'subject_class_id', type: 'uuid', description: 'Subject class', isForeignKey: true, references: 'subject_classes(id)' },
      { name: 'period_slot_id', type: 'uuid', description: 'Period slot', isForeignKey: true, references: 'period_slots(id)' },
    ]
  },
  {
    name: 'period_slots',
    description: 'Time periods for class schedule',
    rlsEnabled: true,
    columns: [
      { name: 'id', type: 'uuid', description: 'Unique period slot identifier', isPrimaryKey: true },
      { name: 'school_id', type: 'uuid', description: 'School identifier', isForeignKey: true, references: 'schools(id)' },
      { name: 'day_of_week', type: 'text', description: 'Day of week (Monday-Friday)' },
      { name: 'period_number', type: 'integer', description: 'Period number in day' },
      { name: 'start_time', type: 'time', description: 'Period start time' },
      { name: 'end_time', type: 'time', description: 'Period end time' },
      { name: 'is_break', type: 'boolean', description: 'Is this a break period?' },
    ]
  }
];

/**
 * Get a simplified schema description for AI consumption
 */
export function getSchemaDescription(): string {
  return DATABASE_SCHEMA.map(table => {
    const columns = table.columns.map(col => {
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
 * Get table info by name
 */
export function getTableInfo(tableName: string): TableInfo | undefined {
  return DATABASE_SCHEMA.find(table => table.name === tableName);
}

/**
 * Get all table names
 */
export function getAllTableNames(): string[] {
  return DATABASE_SCHEMA.map(table => table.name);
}
