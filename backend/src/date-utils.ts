const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

export function addYearsKey(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function isWeekend(dateKey: string): boolean {
  const day = parseDateOnly(dateKey).getUTCDay();
  return day === 0 || day === 6;
}
