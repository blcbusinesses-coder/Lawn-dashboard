import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface JobType {
  key: string
  label: string
  hourly: number
  default_hours: number
  materials: number
}

const DEFAULT_JOB_TYPES: JobType[] = [
  { key: 'leaf_cleanup', label: 'Leaf Cleanup',      hourly: 60, default_hours: 3,   materials: 0 },
  { key: 'mulch',        label: 'Mulch Install',     hourly: 60, default_hours: 4,   materials: 0 },
  { key: 'hedge_trim',   label: 'Hedge / Bush Trim', hourly: 60, default_hours: 2,   materials: 0 },
  { key: 'other',        label: 'Other / Custom',    hourly: 60, default_hours: 2,   materials: 0 },
]

// GET /api/estimates/config — owner: calculator defaults (job types, drive rate,
// validity window) from automation_settings, with safe fallbacks.
export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('automation_settings')
    .select('key, value')
    .in('key', ['estimate_job_types', 'estimate_drive_rate', 'estimate_valid_days'])

  const settings: Record<string, unknown> = {}
  for (const row of data ?? []) settings[row.key] = row.value

  const jobTypes = Array.isArray(settings.estimate_job_types)
    ? (settings.estimate_job_types as JobType[])
    : DEFAULT_JOB_TYPES
  const driveRate = Number(settings.estimate_drive_rate) || 45
  const validDays = Number(settings.estimate_valid_days) || 30

  return NextResponse.json({
    job_types: jobTypes,
    drive_rate: driveRate,
    valid_days: validDays,
  })
}
