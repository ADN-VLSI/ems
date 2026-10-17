/**
 * Validation and Date/Time helpers shared by Frontend and Backend
 */

import { UpdateSections, DeadlineStatus } from './types';

export const DEFAULT_APP_TIMEZONE = 'Asia/Dhaka';
export const CUTOFF_HOUR = 23;
export const CUTOFF_MINUTE = 30;

/**
 * Company wide report recipient requirements
 */
export const COMPANY_REPORT_TO = 'foez.ahmed@adnsemicon.com';
export const COMPANY_REPORT_CC = [
  'mohiuddin.reyad@adnsemicon.com',
  'farhan.efty@adnsemicon.com',
];

/**
 * Validates update sections
 */
export function validateUpdateSections(data: any): { valid: boolean; errors: string[]; sanitized: UpdateSections } {
  const errors: string[] = [];

  const sanitizeBullets = (items: any): string[] => {
    if (!Array.isArray(items)) return [];
    return items
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(item => item.length > 0);
  };

  const todaysTasks = sanitizeBullets(data?.todaysTasks);
  const suddenTasks = sanitizeBullets(data?.suddenTasks);
  const blockers = sanitizeBullets(data?.blockers);
  const plansGoingForward = sanitizeBullets(data?.plansGoingForward);

  if (todaysTasks.length === 0) {
    errors.push("At least one bullet point is required under 'Today\'s Tasks'.");
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      todaysTasks,
      suddenTasks,
      blockers,
      plansGoingForward,
    },
  };
}

/**
 * Formats a Date object into YYYY-MM-DD in the target timezone
 */
export function getDateStringInTimezone(date: Date, timezone: string = DEFAULT_APP_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // outputs YYYY-MM-DD
}

/**
 * Gets parts of the current time in the target timezone
 */
export function getTimePartsInTimezone(date: Date, timezone: string = DEFAULT_APP_TIMEZONE): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => {
    const p = parts.find(x => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

/**
 * Evaluates whether submissions are open or locked for the current date,
 * and calculates the exact remaining time.
 */
export function getDeadlineStatus(now: Date = new Date(), timezone: string = DEFAULT_APP_TIMEZONE): DeadlineStatus {
  const parts = getTimePartsInTimezone(now, timezone);
  const currentDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

  // Deadline is today at 23:30:00
  const isPastCutoff = parts.hour > CUTOFF_HOUR || (parts.hour === CUTOFF_HOUR && parts.minute >= CUTOFF_MINUTE);

  // Compute remaining seconds until today's 23:30:00
  // Today's total seconds from 00:00:00
  const currentTotalSeconds = parts.hour * 3600 + parts.minute * 60 + parts.second;
  const deadlineTotalSeconds = CUTOFF_HOUR * 3600 + CUTOFF_MINUTE * 60;
  const remainingSeconds = Math.max(0, deadlineTotalSeconds - currentTotalSeconds);

  // Compute next submission date
  // If already locked today, next submission opens for tomorrow
  const nextDateObj = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextParts = getTimePartsInTimezone(nextDateObj, timezone);
  const nextSubmissionDate = `${nextParts.year}-${String(nextParts.month).padStart(2, '0')}-${String(nextParts.day).padStart(2, '0')}`;

  return {
    currentTimeIso: now.toISOString(),
    timezone,
    currentDate,
    deadlineIso: `${currentDate}T23:30:00`,
    deadlineDisplay: `11:30 PM (${timezone})`,
    isLocked: isPastCutoff,
    remainingSeconds: isPastCutoff ? 0 : remainingSeconds,
    nextSubmissionDate,
    nextSubmissionDeadlineDisplay: `11:30 PM (${timezone})`,
  };
}
