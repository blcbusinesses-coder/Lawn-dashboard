'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { format, differenceInMinutes } from 'date-fns'

interface TimeLog {
  id: string
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
}

export default function ClockPage() {
  const [openEntry, setOpenEntry] = useState<TimeLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [clocking, setClocking] = useState(false)
  const [elapsed, setElapsed] = useState<string>('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/clock')
      if (!res.ok) throw new Error(await res.text())
      const { open_entry } = await res.json()
      setOpenEntry(open_entry)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Live elapsed timer
  useEffect(() => {
    if (!openEntry) { setElapsed(''); return }
    const tick = () => {
      const mins = differenceInMinutes(new Date(), new Date(openEntry.clock_in))
      const h = Math.floor(mins / 60)
      const m = mins % 60
      setElapsed(`${h}h ${m}m`)
    }
    tick()
    const interval = setInterval(tick, 30000)
    return () => clearInterval(interval)
  }, [openEntry])

  async function handleClock() {
    setClocking(true)
    const action = openEntry ? 'clock_out' : 'clock_in'

    const res = await fetch('/api/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, entry_id: openEntry?.id }),
    })

    if (!res.ok) {
      toast.error((await res.json()).error)
    } else {
      toast.success(openEntry ? 'Clocked out!' : 'Clocked in!')
      load()
    }
    setClocking(false)
  }

  const isClockedIn = !!openEntry

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 w-full max-w-sm text-center shadow-sm">
        <div className="mb-6">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl mb-4 ${isClockedIn ? 'bg-green-100' : 'bg-zinc-100'}`}>
            {isClockedIn ? '⏱️' : '⏸️'}
          </div>
          <h1 className="text-xl font-bold text-zinc-900">
            {loading ? '…' : isClockedIn ? 'Clocked In' : 'Clocked Out'}
          </h1>
          {isClockedIn && openEntry && (
            <div className="mt-2">
              <p className="text-sm text-zinc-500">
                Since {format(new Date(openEntry.clock_in), 'h:mm a, MMM d')}
              </p>
              <p className="text-2xl font-bold text-green-600 mt-1">{elapsed}</p>
            </div>
          )}
        </div>

        <Button
          size="lg"
          className={`w-full text-base py-6 ${isClockedIn ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
          onClick={handleClock}
          disabled={clocking || loading}
        >
          {clocking ? '…' : isClockedIn ? '🛑 Clock Out' : '▶ Clock In'}
        </Button>

        <p className="text-xs text-zinc-400 mt-3">
          {format(new Date(), 'EEEE, MMMM d, yyyy · h:mm a')}
        </p>
      </div>
    </div>
  )
}
