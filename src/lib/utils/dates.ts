import {
  startOfISOWeek,
  endOfISOWeek,
  format,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  isSameMonth,
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

/**
 * A billable slice of an ISO week. Weeks that fall entirely inside one calendar
 * month produce a single segment (the Monday is its `weekStart` key, exactly
 * like before). Weeks that straddle a month boundary split into two segments at
 * the 1st of the month so mows are billed to the month they actually happened
 * in — without changing the 7-day shape of the week.
 */
export interface WeekSegment {
  /** Value stored in job_logs.week_start for mows in this slice. */
  weekStart: string
  /** First day of the slice (yyyy-MM-dd). */
  start: string
  /** Last day of the slice (yyyy-MM-dd). */
  end: string
  /** Human label for the date span, e.g. "Jun 29 – Jun 30". */
  label: string
  /** Full month name this slice bills to, e.g. "June". */
  billsTo: string
  /** True when the parent ISO week was split across two months. */
  split: boolean
}

export function getWeekSegments(weekStart: Date): WeekSegment[] {
  const monday = startOfISOWeek(weekStart)
  const sunday = endOfISOWeek(weekStart)

  // Common case: the whole ISO week sits in one month → one segment, unchanged.
  if (isSameMonth(monday, sunday)) {
    return [{
      weekStart: format(monday, 'yyyy-MM-dd'),
      start: format(monday, 'yyyy-MM-dd'),
      end: format(sunday, 'yyyy-MM-dd'),
      label: `${format(monday, 'MMM d')} – ${format(sunday, 'MMM d')}`,
      billsTo: format(monday, 'MMMM'),
      split: false,
    }]
  }

  // Straddles a month boundary → split at the 1st.
  const firstOfNext = startOfMonth(sunday)
  const lastOfFirst = endOfMonth(monday)
  return [
    {
      weekStart: format(monday, 'yyyy-MM-dd'),
      start: format(monday, 'yyyy-MM-dd'),
      end: format(lastOfFirst, 'yyyy-MM-dd'),
      label: `${format(monday, 'MMM d')} – ${format(lastOfFirst, 'MMM d')}`,
      billsTo: format(monday, 'MMMM'),
      split: true,
    },
    {
      weekStart: format(firstOfNext, 'yyyy-MM-dd'),
      start: format(firstOfNext, 'yyyy-MM-dd'),
      end: format(sunday, 'yyyy-MM-dd'),
      label: `${format(firstOfNext, 'MMM d')} – ${format(sunday, 'MMM d')}`,
      billsTo: format(sunday, 'MMMM'),
      split: true,
    },
  ]
}
