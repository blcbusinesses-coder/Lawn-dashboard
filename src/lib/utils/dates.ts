import {
  startOfISOWeek,
  endOfISOWeek,
  format,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns'

export function getWeekStart(date: Date = new Date()): Date {
  return startOfISOWeek(date)
}

export function getWeekEnd(date: Date = new Date()): Date {
  return endOfISOWeek(date)
}

export function formatWeekLabel(weekStart: Date): string {
  const end = endOfISOWeek(weekStart)
  return `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
}

export function nextWeek(weekStart: Date): Date {
  return addWeeks(weekStart, 1)
}

export function prevWeek(weekStart: Date): Date {
  return subWeeks(weekStart, 1)
}

export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getLastMonthRange(): { start: string; end: string } {
  const lastMonth = subMonths(new Date(), 1)
  return {
    start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
    end: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
  }
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const d = new Date(year, month - 1, 1)
  return {
    start: format(startOfMonth(d), 'yyyy-MM-dd'),
    end: format(endOfMonth(d), 'yyyy-MM-dd'),
  }
}
