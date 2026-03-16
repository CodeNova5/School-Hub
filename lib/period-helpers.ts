/**
 * Period Schedule Helper Functions
 * Utilities for generating school timetable periods based on school hours
 */

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * Adds minutes to a time string (HH:MM format)
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

/**
 * Calculates duration in minutes between two times
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startTotalMins = startH * 60 + startM;
  const endTotalMins = endH * 60 + endM;
  return endTotalMins - startTotalMins;
}

/**
 * Generates a complete period schedule for all school days
 *
 * @param startTime - School start time (HH:MM format, e.g., "08:00")
 * @param endTime - School end time (HH:MM format, e.g., "16:00")
 * @param numberOfPeriods - Total number of class periods (e.g., 8)
 * @param periodDuration - Duration of each period in minutes (e.g., 45)
 * @param breakSchedule - Array of break configurations
 *   Example: [{ afterPeriod: 3, duration: 15, isLunch: false }, { afterPeriod: 6, duration: 30, isLunch: true }]
 *
 * @returns Array of period objects for all 5 school days
 */
export interface BreakConfig {
  afterPeriod: number; // Break after this period number (1-indexed)
  duration: number; // Break duration in minutes
  isLunch?: boolean; // Whether this is a lunch break
}

export interface GeneratedPeriod {
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
  is_lunch?: boolean;
}

export function generatePeriodSchedule(
  startTime: string,
  endTime: string,
  numberOfPeriods: number,
  periodDuration: number,
  breakSchedule: BreakConfig[]
): GeneratedPeriod[] {
  const periods: GeneratedPeriod[] = [];

  // Sort breaks by afterPeriod to process them in order
  const sortedBreaks = [...breakSchedule].sort((a, b) => a.afterPeriod - b.afterPeriod);

  let currentTime = startTime;
  let periodCount = 1;
  let breakCount = 0;

  // Generate periods for each day
  for (const day of DAYS_OF_WEEK) {
    currentTime = startTime; // Reset time for each day
    periodCount = 1;
    let nextBreakIndex = 0; // Track which break we're looking for

    while (periodCount <= numberOfPeriods) {
      // Check if there's a break scheduled after the current period
      const breakAfterThisPeriod = sortedBreaks.find(
        (b) => b.afterPeriod === periodCount
      );

      // Add class period
      const periodEndTime = addMinutesToTime(currentTime, periodDuration);
      periods.push({
        day_of_week: day,
        period_number: periodCount,
        start_time: currentTime,
        end_time: periodEndTime,
        is_break: false,
        is_lunch: false,
      });

      currentTime = periodEndTime;

      // Add break if scheduled after this period
      if (breakAfterThisPeriod) {
        const breakEndTime = addMinutesToTime(currentTime, breakAfterThisPeriod.duration);
        breakCount++;
        periods.push({
          day_of_week: day,
          period_number: periodCount + 1000 + breakCount, // Use high number for break identification
          start_time: currentTime,
          end_time: breakEndTime,
          is_break: true,
          is_lunch: breakAfterThisPeriod.isLunch || false,
        });
        currentTime = breakEndTime;
      }

      periodCount++;
    }
  }

  return periods;
}

/**
 * Validates if the generated schedule fits within school hours
 */
export function validateScheduleFitsInSchoolHours(
  startTime: string,
  endTime: string,
  generatedPeriods: GeneratedPeriod[]
): { isValid: boolean; error?: string } {
  // Find the last period end time
  const lastPeriod = generatedPeriods[generatedPeriods.length - 1];

  const schoolEndMinutes = calculateDuration('00:00', endTime);
  const lastEndMinutes = calculateDuration('00:00', lastPeriod.end_time);

  if (lastEndMinutes > schoolEndMinutes) {
    return {
      isValid: false,
      error: `Schedule extends beyond school end time. Last period ends at ${lastPeriod.end_time} but school ends at ${endTime}`,
    };
  }

  return { isValid: true };
}

/**
 * Formats period data for display (removes break period numbers starting with 1000+)
 */
export function formatPeriodsForDisplay(periods: GeneratedPeriod[]): GeneratedPeriod[] {
  return periods.map((p) => ({
    ...p,
    period_number: p.is_break ? 0 : p.period_number, // Breaks don't have period numbers
  }));
}

/**
 * Groups periods by day for easier preview
 */
export function groupPeriodsByDay(periods: GeneratedPeriod[]): Record<string, GeneratedPeriod[]> {
  const grouped: Record<string, GeneratedPeriod[]> = {};

  DAYS_OF_WEEK.forEach((day) => {
    grouped[day] = periods.filter((p) => p.day_of_week === day);
  });

  return grouped;
}

/**
 * Calculates statistics about the generated schedule
 */
export interface ScheduleStats {
  totalPeriods: number;
  totalBreaks: number;
  totalDays: number;
  avgBreakDuration: number;
  totalClassTime: number;
  totalBreakTime: number;
}

export function calculateScheduleStats(periods: GeneratedPeriod[]): ScheduleStats {
  const breakPeriods = periods.filter((p) => p.is_break);
  const classPeriods = periods.filter((p) => !p.is_break);

  let totalBreakTime = 0;
  breakPeriods.forEach((p) => {
    totalBreakTime += calculateDuration(p.start_time, p.end_time);
  });

  let totalClassTime = 0;
  classPeriods.forEach((p) => {
    totalClassTime += calculateDuration(p.start_time, p.end_time);
  });

  const uniqueDays = new Set(periods.map((p) => p.day_of_week)).size;

  return {
    totalPeriods: classPeriods.length / uniqueDays,
    totalBreaks: breakPeriods.length / uniqueDays,
    totalDays: uniqueDays,
    avgBreakDuration: breakPeriods.length > 0 ? totalBreakTime / breakPeriods.length : 0,
    totalClassTime,
    totalBreakTime,
  };
}
