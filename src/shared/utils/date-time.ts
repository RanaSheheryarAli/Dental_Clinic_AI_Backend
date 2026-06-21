const DEFAULT_CLINIC_TIME_ZONE = 'Asia/Karachi';

function formatIsoDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

export function getClinicTimeZone() {
  return DEFAULT_CLINIC_TIME_ZONE;
}

export function getIsoDateInTimeZone(timeZone = DEFAULT_CLINIC_TIME_ZONE, date = new Date()) {
  return formatIsoDateParts(date, timeZone);
}

export function formatSlotDate(slot: string, timeZone = DEFAULT_CLINIC_TIME_ZONE) {
  return formatIsoDateParts(new Date(slot), timeZone);
}

export function formatSlotTime(slot: string, timeZone = DEFAULT_CLINIC_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(slot));
}

export function formatSlotDateAndTime(slot: string, timeZone = DEFAULT_CLINIC_TIME_ZONE) {
  return `${formatSlotDate(slot, timeZone)} at ${formatSlotTime(slot, timeZone)}`;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Add (or subtract) whole days to a YYYY-MM-DD date and return YYYY-MM-DD. */
export function addDaysToIsoDate(isoDate: string, days: number) {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Weekday name for a YYYY-MM-DD date (calendar weekday, timezone-independent). */
export function getWeekdayName(isoDate: string) {
  return WEEKDAY_NAMES[new Date(`${isoDate}T00:00:00.000Z`).getUTCDay()];
}
