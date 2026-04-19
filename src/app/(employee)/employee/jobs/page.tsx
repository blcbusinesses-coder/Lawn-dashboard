'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getWeekStart, prevWeek, nextWeek, formatWeekLabel, toDateString } from '@/lib/utils/dates'
import { formatCurrency } from '@/lib/utils/currency'

interface Property {
  id: string
  address: string
  price_per_mow: number
  customers: { full_name: string }
}

interface JobLog {
  id: string
  property_id: string
  week_start: string
  status: 'done' | 'skipped'
  completed_by: string | null
}

export default function EmployeeJobsPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart())
  const [properties, setProperties] = useState<Property[]>([])
  const [jobLogs, setJobLogs] = useState<JobLog[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  const weekDateStr = toDateString(weekStart)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const load = useCallback(async () => {
    try {
      const [propRes, jobRes] = await Promise.all([
        fetch('/api/properties'),
        fetch(`/api/jobs?week_start=${weekDateStr}`),
      ])
      if (!propRes.ok) throw new Error(await propRes.text())
      if (!jobRes.ok) throw new Error(await jobRes.text())
      const propData = await propRes.json()
      const jobData = await jobRes.json()
      setProperties(Array.isArray(propData) ? propData : [])
      setJobLogs(Array.isArray(jobData) ? jobData : [])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [weekDateStr])

  useEffect(() => { setLoading(true); load() }, [load])

  async function markDone(propertyId: string) {
    if (pending.has(propertyId)) return
    setPending((p) => new Set(p).add(propertyId))

    const existing = jobLogs.find((j) => j.property_id === propertyId)
    const newStatus = existing?.status === 'done' ? null : 'done'

    try {
      if (newStatus === null) {
        await fetch(`/api/jobs?property_id=${propertyId}&week_start=${weekDateStr}`, { method: 'DELETE' })
      } else {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId, week_start: weekDateStr, status: 'done' }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('Job marked as done!')
      }
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setPending((p) => { const s = new Set(p); s.delete(propertyId); return s })
    }
  }

  const doneCount = jobLogs.filter((j) => j.status === 'done').length

  return (
    <div className="p-4">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">My Jobs</h1>
          <p className="text-sm text-zinc-500">{doneCount} of {properties.length} done this week</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(prevWeek(weekStart))}>← Prev</Button>
          <span className="text-sm font-medium text-zinc-700 min-w-[160px] text-center">{formatWeekLabel(weekStart)}</span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(nextWeek(weekStart))}>Next →</Button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))
        ) : properties.length === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-400">
            No properties assigned
          </div>
        ) : (
          properties.map((p) => {
            const log = jobLogs.find((j) => j.property_id === p.id)
            const status = log?.status ?? null
            const isDone = status === 'done'
            const isMyDone = log?.completed_by === userId

            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border transition-all ${isDone ? 'border-green-200 bg-green-50' : 'border-zinc-200'} p-4`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900">{p.address}</p>
                    <p className="text-sm text-zinc-500">{p.customers?.full_name} · {formatCurrency(p.price_per_mow)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {status === 'done' && (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        {isMyDone ? '✓ Done by you' : '✓ Done'}
                      </Badge>
                    )}
                    {status === 'skipped' && <Badge variant="secondary">Skipped</Badge>}
                    <Button
                      size="sm"
                      variant={isDone ? 'default' : 'outline'}
                      className={isDone ? 'bg-green-600 hover:bg-green-700' : ''}
                      disabled={pending.has(p.id)}
                      onClick={() => markDone(p.id)}
                    >
                      {isDone ? '✓ Done' : 'Mark Done'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
