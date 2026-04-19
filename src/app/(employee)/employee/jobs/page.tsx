'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getWeekStart, prevWeek, nextWeek, formatWeekLabel, toDateString } from '@/lib/utils/dates'
import { formatCurrency } from '@/lib/utils/currency'
import { ChevronLeft, ChevronRight, CheckCircle2, MinusCircle, MapPin, User } from 'lucide-react'

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
        toast.success('Marked as complete')
      }
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setPending((p) => { const s = new Set(p); s.delete(propertyId); return s })
    }
  }

  const doneCount = jobLogs.filter((j) => j.status === 'done').length
  const total = properties.length

  return (
    <div className="p-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="pt-1 mb-4">
        <h1 className="text-2xl font-bold text-zinc-900">My Jobs</h1>
        {!loading && (
          <p className="text-sm text-zinc-500 mt-0.5">
            {doneCount} of {total} complete this week
          </p>
        )}
      </div>

      {/* Progress bar */}
      {!loading && total > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-zinc-200 shadow-sm px-4 py-3 mb-4">
        <button
          onClick={() => setWeekStart(prevWeek(weekStart))}
          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-zinc-800">{formatWeekLabel(weekStart)}</span>
        <button
          onClick={() => setWeekStart(nextWeek(weekStart))}
          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Job cards */}
      <div className="space-y-2.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))
        ) : properties.length === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-10 text-center">
            <MapPin size={24} className="mx-auto mb-2 text-zinc-300" />
            <p className="text-sm text-zinc-400">No properties assigned</p>
          </div>
        ) : (
          properties.map((p) => {
            const log = jobLogs.find((j) => j.property_id === p.id)
            const status = log?.status ?? null
            const isDone = status === 'done'
            const isSkipped = status === 'skipped'
            const isMyDone = log?.completed_by === userId

            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${
                  isDone ? 'border-green-200' : isSkipped ? 'border-zinc-200 opacity-60' : 'border-zinc-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {isDone && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
                      {isSkipped && <MinusCircle size={15} className="text-zinc-400 shrink-0" />}
                      <p className={`font-semibold text-sm leading-snug truncate ${isDone ? 'text-green-800' : 'text-zinc-900'}`}>
                        {p.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 ml-0">
                      <span className="flex items-center gap-1">
                        <User size={11} />
                        {p.customers?.full_name}
                      </span>
                      <span>{formatCurrency(p.price_per_mow)}</span>
                    </div>
                    {isDone && (
                      <p className="text-xs text-green-600 mt-1 ml-0">
                        {isMyDone ? 'Completed by you' : 'Completed'}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={isDone ? 'default' : 'outline'}
                    className={`shrink-0 ${isDone ? 'bg-green-600 hover:bg-green-700 border-green-600 text-white' : ''}`}
                    disabled={pending.has(p.id)}
                    onClick={() => markDone(p.id)}
                  >
                    {isDone ? 'Done' : 'Mark Done'}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
