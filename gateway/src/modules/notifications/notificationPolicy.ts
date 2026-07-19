export type NotificationType = 'task_reminder' | 'overdue' | 'morning_plan' | 'evening_review' | 'reschedule' | 'system';

export type QuietHours = { start: string; end: string };

export type NotificationPreferences = {
  timezone: string;
  quietHours?: QuietHours;
  remindersEnabled?: boolean;
  morningPlanEnabled?: boolean;
  eveningReviewEnabled?: boolean;
};

export type NotificationRequest = {
  type: NotificationType;
  recipientId: string;
  at: Date;
  preferences: NotificationPreferences;
  critical?: boolean;
  taskId?: string;
  taskVersion?: string | number;
  localDate?: string;
};

export type NotificationDecision = { allowed: boolean; reason: 'allowed' | 'quiet_hours' | 'disabled' | 'invalid_timezone' };

const clock = (value: string): number | null => {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export function localTimeMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) throw new RangeError('INVALID_TIMEZONE');
  return hour * 60 + minute;
}

export function localDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new RangeError('INVALID_TIMEZONE');
  return `${year}-${month}-${day}`;
}

export function isQuietHours(date: Date, quietHours: QuietHours | undefined, timezone: string): boolean {
  if (!quietHours) return false;
  const start = clock(quietHours.start);
  const end = clock(quietHours.end);
  if (start === null || end === null || start === end) return false;
  const now = localTimeMinutes(date, timezone);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function shouldSendNotification(request: NotificationRequest): NotificationDecision {
  try {
    // Security and system-critical messages are never held by a user's quiet hours.
    if (request.critical || request.type === 'system') return { allowed: true, reason: 'allowed' };
    const enabled = request.type === 'morning_plan' ? request.preferences.morningPlanEnabled !== false
      : request.type === 'evening_review' ? request.preferences.eveningReviewEnabled !== false
        : request.preferences.remindersEnabled !== false;
    if (!enabled) return { allowed: false, reason: 'disabled' };
    if (isQuietHours(request.at, request.preferences.quietHours, request.preferences.timezone)) return { allowed: false, reason: 'quiet_hours' };
    return { allowed: true, reason: 'allowed' };
  } catch (error) {
    if (error instanceof RangeError) return { allowed: false, reason: 'invalid_timezone' };
    throw error;
  }
}

export function notificationKey(request: Pick<NotificationRequest, 'type' | 'recipientId' | 'taskId' | 'taskVersion' | 'localDate'>): string {
  const suffix = request.type === 'task_reminder' || request.type === 'overdue'
    ? `${request.taskId ?? 'unknown'}:${String(request.taskVersion ?? '0')}`
    : `${request.localDate ?? 'unknown'}`;
  return `telegram:${request.recipientId}:${request.type}:${suffix}`;
}

