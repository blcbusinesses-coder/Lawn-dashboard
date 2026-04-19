'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { format, differenceInMinutes } from 'date-fns'
import { Timer, CirclePause, Square, Play } from 'lucide-react'

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
      toast.success(openEntry ? 'Clocked out' : 'Clocked in')
      load()
    }
    setClocking(false)
  }

  const isClockedIn = !!openEntry

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 w-full max-w-sm text-center">

        {/* Status icon */}
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-5 ${
          isClockedIn ? 'bg-green-50 border-2 border-green-200' : 'bg-zinc-50 border-2 border-zinc-200'
        }`}>
          {isClockedIn
            ? <Timer size={32} className="text-green-600" />
            : <CirclePause size={32} className="text-zinc-400" />
          }
        </div>

        <h1 className="text-xl font-bold text-zinc-900 mb-1">
          {loading ? 'Loading…' : isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
        </h1>

        {isClockedIn && openEntry ? (
          <div className="mb-6 mt-2">
            <p className="text-sm text-zinc-500">
              Since {format(new Date(openEntry.clock_in), 'h:mm a, MMM d')}
            </p>
            <p className="text-3xl font-bold text-green-600 mt-2 tracking-tight">{elapsed}</p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 mb-6 mt-1">Tap below to start tracking your time.</p>
        )}

        <Button
          size="lg"
          className={`w-full h-14 text-base font-semibold shadow-sm ${
            isClockedIn
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
          onClick={handleClock}
          disabled={clocking || loading}
        >
          {clocking ? (
            'Please wait…'
          ) : isClockedIn ? (
            <span className="flex items-center gap-2"><Square size={16} fill="currentColor" /> Clock Out</span>
          ) : (
            <span className="flex items-center gap-2"><Play size={16} fill="currentColor" /> Clock In</span>
          )}
        </Button>

        <p className="text-xs text-zinc-400 mt-4">
          {format(new Date(), 'EEEE, MMMM d · h:mm a')}
        </p>
      </div>
    </div>
  )
}
