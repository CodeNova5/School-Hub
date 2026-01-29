/**
 * Centralized API client for admin operations
 * Provides read and write operations for the admin panel
 */

interface ReadOptions {
  table: string;
  select?: string;
  filters?: Record<string, any>;
  order?: Array<{ column: string; ascending?: boolean }>;
}

interface WriteOptions {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data?: Record<string, any>;
  filters?: Record<string, any>;
}

/**
 * Read data from database
 */
export async function apiRead<T = any>(options: ReadOptions): Promise<T[]> {
  try {
    const response = await fetch('/api/admin-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'select',
        ...options,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to read data');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error('API Read Error:', error);
    throw error;
  }
}

/**
 * Write data to database (insert, update, delete)
 */
export async function apiWrite(options: WriteOptions): Promise<any> {
  try {
    const response = await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: options.operation,
        table: options.table,
        data: options.data,
        filters: options.filters,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to ${options.operation} data`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Write Error:', error);
    throw error;
  }
}

/**
 * Convenience methods for common operations
 */
export const apiClient = {
  // Generic operations
  apiRead,
  apiWrite,

  // Read operations
  readStudents: (classId: string) =>
    apiRead({
      table: 'students',
      select: '*',
      filters: { class_id: classId },
      order: [{ column: 'first_name', ascending: true }],
    }),

  readSubjectClasses: (classId: string) =>
    apiRead({
      table: 'subject_classes',
      select: `id, subject_code, subject:subjects(id, name, is_optional, religion, department), teacher:teachers(id, first_name, last_name)`,
      filters: { class_id: classId },
      order: [{ column: 'subject_code', ascending: true }],
    }),

  readTeachers: () =>
    apiRead({
      table: 'teachers',
      select: 'id, first_name, last_name',
      filters: { status: 'active' },
    }),

  readSessions: () =>
    apiRead({
      table: 'sessions',
      select: '*',
      order: [{ column: 'start_date', ascending: false }],
    }),

  readTerms: () =>
    apiRead({
      table: 'terms',
      select: '*',
      order: [{ column: 'start_date', ascending: true }],
    }),

  readAttendance: (classId: string, date: string) =>
    apiRead({
      table: 'attendance',
      select: '*',
      filters: { class_id: classId, date },
    }),

  readResults: (classId: string) =>
    apiRead({
      table: 'results',
      select: '*',
      filters: { class_id: classId },
    }),

  // Write operations
  updateSubjectCode: (subjectClassId: string, subjectCode: string) =>
    apiWrite({
      table: 'subject_classes',
      operation: 'update',
      data: { subject_code: subjectCode },
      filters: { id: subjectClassId },
    }),

  assignTeacher: (subjectClassId: string, teacherId: string) =>
    apiWrite({
      table: 'subject_classes',
      operation: 'update',
      data: { teacher_id: teacherId },
      filters: { id: subjectClassId },
    }),

  deleteSubjectClass: (subjectClassId: string) =>
    apiWrite({
      table: 'subject_classes',
      operation: 'delete',
      filters: { id: subjectClassId },
    }),

  updateStudentClass: (studentId: string, classId: string | null) =>
    apiWrite({
      table: 'students',
      operation: 'update',
      data: { class_id: classId },
      filters: { id: studentId },
    }),

  saveAttendance: (attendanceData: any[]) =>
    apiWrite({
      table: 'attendance',
      operation: 'insert',
      data: attendanceData,
    }),

  updateAttendance: (attendanceId: string, status: string) =>
    apiWrite({
      table: 'attendance',
      operation: 'update',
      data: { status },
      filters: { id: attendanceId },
    }),

  saveResults: (resultsData: any[]) =>
    apiWrite({
      table: 'results',
      operation: 'insert',
      data: resultsData,
    }),

  updateResults: (resultId: string, score: number, grade: string) =>
    apiWrite({
      table: 'results',
      operation: 'update',
      data: { score, grade },
      filters: { id: resultId },
    }),
};
