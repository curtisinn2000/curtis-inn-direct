const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HOTEL_TIME_ZONE = 'America/New_York';

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function diffDays(start: string, end: string): number {
  return Math.round((parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / MS_PER_DAY);
}

export function eachStayDate(checkIn: string, checkOut: string): string[] {
  const nights = diffDays(checkIn, checkOut);
  return Array.from({ length: nights }, (_, index) => {
    const d = parseDateOnly(checkIn);
    d.setUTCDate(d.getUTCDate() + index);
    return d.toISOString().slice(0, 10);
  });
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hotelTodayKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HOTEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function addDaysKey(dateKey: string, days: number): string {
  const d = parseDateOnly(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function earliestPublicCheckInKey(now = new Date()): string {
  return hotelTodayKey(now);
}

export function addYearsKey(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function isWeekend(dateKey: string): boolean {
  const day = parseDateOnly(dateKey).getUTCDay();
  return day === 0 || day === 6;
}
