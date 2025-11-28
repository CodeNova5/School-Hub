import { AttendanceEntry, Result } from './types';

export function calculateAverageAttendance(attendance: AttendanceEntry[]): number {
  if (!attendance || attendance.length === 0) return 0;

  const presentCount = attendance.filter(a => a.status === 'present').length;
  return Math.round((presentCount / attendance.length) * 100);
}

export function calculateTermGPA(results: Result[]): number {
  if (!results || results.length === 0) return 0;

  const totalScore = results.reduce((sum, r) => sum + r.total, 0);
  const maxScore = results.length * 100;

  return Math.round((totalScore / maxScore) * 100);
}

export function calculateGrade(total: number): string {
  if (total >= 90) return 'A+';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  return 'F';
}

export function filterStudentResultsBySessionAndTerm(
  results: Result[],
  sessionId: string,
  termId: string
): Result[] {
  return results.filter(
    r => r.session_id === sessionId && r.term_id === termId
  );
}

export function filterAttendanceByPeriod(
  attendance: AttendanceEntry[],
  period: 'daily' | 'weekly' | 'monthly' | 'term' | 'session',
  date?: Date
): AttendanceEntry[] {
  const now = date || new Date();

  return attendance.filter(entry => {
    const entryDate = new Date(entry.date);

    switch (period) {
      case 'daily':
        return entryDate.toDateString() === now.toDateString();

      case 'weekly':
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return entryDate >= weekAgo && entryDate <= now;

      case 'monthly':
        return (
          entryDate.getMonth() === now.getMonth() &&
          entryDate.getFullYear() === now.getFullYear()
        );

      case 'term':
        const termStart = new Date(now);
        termStart.setMonth(now.getMonth() - 4);
        return entryDate >= termStart && entryDate <= now;

      case 'session':
        const sessionStart = new Date(now);
        sessionStart.setFullYear(now.getFullYear() - 1);
        return entryDate >= sessionStart && entryDate <= now;

      default:
        return true;
    }
  });
}

export function getAttendanceStatusColor(status: string): string {
  switch (status) {
    case 'present':
      return 'bg-green-100 text-green-800';
    case 'absent':
      return 'bg-red-100 text-red-800';
    case 'late':
      return 'bg-yellow-100 text-yellow-800';
    case 'excused':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+':
    case 'A':
      return 'text-green-600';
    case 'B':
      return 'text-blue-600';
    case 'C':
      return 'text-yellow-600';
    case 'D':
      return 'text-orange-600';
    case 'F':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function exportToCSV(data: any[], filename: string) {
  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => {
      const value = row[header];
      if (typeof value === 'object') return JSON.stringify(value);
      return `"${value}"`;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
