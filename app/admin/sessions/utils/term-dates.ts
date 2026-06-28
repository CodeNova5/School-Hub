// ─── 52-Week Academic Year Rollover ──────────────────────────────────────
// Adds exactly 52 weeks (364 days) to preserve the day-of-week.
// If a term started on a Monday last year, it starts on a Monday this year.

export function shiftDateByOneAcademicYear(dateString: string, shifts: number = 1): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 364 * shifts); // 52 weeks per academic year
  return date.toISOString().split('T')[0];
}

export function getNextSessionName(currentName: string): string | null {
  // Session names look like "2026/2027"
  const parts = currentName.split('/');
  const year1 = parseInt(parts[0]);
  const year2 = parseInt(parts[1]);
  if (isNaN(year1) || isNaN(year2)) return null;
  return `${year2}/${year2 + 1}`;
}
