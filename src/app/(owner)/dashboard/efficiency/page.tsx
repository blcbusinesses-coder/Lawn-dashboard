'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, Zap, Clock, Gauge } from 'lucide-react'

interface EfficiencyMetric {
  id: string
  label: string
  minutes_per_1000sqft: number | null
  notes: string | null
  employee: { id: string; full_name: string } | null
  equipment: { id: string; name: string } | null
}

interface EfficiencySetting {
  key: string
  label: string | null
  value: number
  unit: string | null
}

interface Employee { id: string; full_name: string }
interface Equipment { id: string; name: string }

const SETTING_KEYS = [
  'rider_speed_multiplier',
  'avg_drive_minutes_between_jobs',
  'avg_setup_minutes_per_job',
  'target_jobs_per_crew_day',
]

export default function EfficiencyPage() {
  const [metrics, setMetrics] = useState<EfficiencyMetric[]>([])
  const [settings, setSettings] = useState<EfficiencySetting[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])

  const [metricOpen, setMetricOpen] = useState(false)
  const [editingMetric, setEditingMetric] = useState<EfficiencyMetric | null>(null)
  const [metricForm, setMetricForm] = useState({
    label: '', minutes_per_1000sqft: '', employee_id: '', equipment_id: '', notes: '',
  })
  const [savingMetric, setSavingMetric] = useState(false)

  const [editingSettingKey, setEditingSettingKey] = useState<string | null>(null)
  const [settingDraft, setSettingDraft] = useState('')

  const load = useCallback(async () => {
    const [effRes, empRes, eqRes] = await Promise.all([
      fetch('/api/efficiency'),
      fetch('/api/employees'),
      fetch('/api/equipment'),
    ])
    if (effRes.ok) {
      const { metrics: m, settings: s } = await effRes.json()
      setMetrics(m ?? [])
      setSettings(s ?? [])
    }
    if (empRes.ok) setEmployees(await empRes.json())
    if (eqRes.ok) setEquipmentList(await eqRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAddMetric() {
    setEditingMetric(null)
    setMetricForm({ label: '', minutes_per_1000sqft: '', employee_id: '', equipment_id: '', notes: '' })
    setMetricOpen(true)
  }

  function openEditMetric(m: EfficiencyMetric) {
    setEditingMetric(m)
    setMetricForm({
      label: m.label,
      minutes_per_1000sqft: m.minutes_per_1000sqft?.toString() ?? '',
      employee_id: m.employee?.id ?? '',
      equipment_id: m.equipment?.id ?? '',
      notes: m.notes ?? '',
    })
    setMetricOpen(true)
  }

  async function handleSaveMetric() {
    if (!metricForm.label.trim()) return toast.error('Label is required')
    setSavingMetric(true)

    const payload = {
      label: metricForm.label,
      minutes_per_1000sqft: metricForm.minutes_per_1000sqft ? parseFloat(metricForm.minutes_per_1000sqft) : null,
      employee_id: metricForm.employee_id || null,
      equipment_id: metricForm.equipment_id || null,
      notes: metricForm.notes || null,
    }

    const url = editingMetric ? `/api/efficiency/${editingMetric.id}` : '/api/efficiency'
    const method = editingMetric ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error)
    } else {
      toast.success(editingMetric ? 'Metric updated' : 'Metric added')
      setMetricOpen(false)
      load()
    }
    setSavingMetric(false)
  }

  async function handleDeleteMetric(id: string) {
    const res = await fetch(`/api/efficiency/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMetrics((prev) => prev.filter((m) => m.id !== id))
      toast.success('Metric deleted')
    }
  }

  async function saveSetting(key: string, value: number) {
    const res = await fetch('/api/efficiency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'setting', key, value }),
    })
    if (res.ok) {
      setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value } : s))
      setEditingSettingKey(null)
      toast.success('Setting saved')
    } else {
      toast.error('Could not save setting')
    }
  }

  // Derived calculations
  const riderMultiplier = settings.find((s) => s.key === 'rider_speed_multiplier')?.value ?? 2.5
  const driveTime = settings.find((s) => s.key === 'avg_drive_minutes_between_jobs')?.value ?? 10
  const setupTime = settings.find((s) => s.key === 'avg_setup_minutes_per_job')?.value ?? 5
  const targetJobs = settings.find((s) => s.key === 'target_jobs_per_crew_day')?.value ?? 8

  const avgMowRate = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + (m.minutes_per_1000sqft ?? 0), 0) / metrics.filter((m) => m.minutes_per_1000sqft != null).length
    : null

  const minutesPerAvgLawn = avgMowRate != null ? avgMowRate * 8 : null // assuming 8k sqft avg
  const riderMinutes = minutesPerAvgLawn != null ? minutesPerAvgLawn / riderMultiplier : null
  const totalPerJob = minutesPerAvgLawn != null ? minutesPerAvgLawn + driveTime + setupTime : null
  const maxJobsPerDay = totalPerJob != null ? Math.floor(480 / totalPerJob) : null // 8 hr day

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Efficiency Planner</h1>
        <p className="text-sm text-zinc-500 mt-1">Optimize crew and equipment performance</p>
      </div>

      {/* Summary cards */}
      {!loading && avgMowRate != null && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1 text-zinc-500">
              <Clock size={14} />
              <span className="text-xs font-medium">Avg mow rate</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">{avgMowRate.toFixed(1)}</p>
            <p className="text-xs text-zinc-400">min / 1,000 sqft</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1 text-zinc-500">
              <Zap size={14} />
              <span className="text-xs font-medium">Rider savings</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {minutesPerAvgLawn != null ? Math.round(minutesPerAvgLawn - (minutesPerAvgLawn / riderMultiplier)) : '—'}
            </p>
            <p className="text-xs text-zinc-400">min saved per 8k lawn</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1 text-zinc-500">
              <Clock size={14} />
              <span className="text-xs font-medium">Time per job</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {totalPerJob != null ? Math.round(totalPerJob) : '—'}
            </p>
            <p className="text-xs text-zinc-400">min (mow + drive + setup)</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1 text-zinc-500">
              <Gauge size={14} />
              <span className="text-xs font-medium">Max jobs / day</span>
            </div>
            <p className={`text-2xl font-bold ${maxJobsPerDay != null && maxJobsPerDay >= targetJobs ? 'text-green-600' : 'text-red-500'}`}>
              {maxJobsPerDay ?? '—'}
            </p>
            <p className="text-xs text-zinc-400">target: {targetJobs}</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Speed Metrics */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Mow Speed Metrics</h2>
              <p className="text-xs text-zinc-400 mt-0.5">How fast each employee / equipment mows</p>
            </div>
            <Button size="sm" onClick={openAddMetric}><Plus size={14} className="mr-1" />Add</Button>
          </div>

          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4">
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : metrics.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 bg-white rounded-xl border border-zinc-200 text-sm">
                No metrics yet. Add your first to start tracking.
              </div>
            ) : (
              metrics.map((m) => (
                <div key={m.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900">{m.label}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-zinc-500">
                      {m.minutes_per_1000sqft != null && (
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          {m.minutes_per_1000sqft} min / 1k sqft
                        </span>
                      )}
                      {m.employee && <span>👤 {m.employee.full_name}</span>}
                      {m.equipment && <span>🔧 {m.equipment.name}</span>}
                    </div>
                    {m.notes && <p className="text-xs text-zinc-400 mt-1">{m.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditMetric(m)} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded hover:bg-zinc-100 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDeleteMetric(m.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded hover:bg-zinc-100 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Global Settings */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-zinc-900">Business Settings</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Click any value to edit</p>
          </div>

          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))
            ) : (
              settings.filter((s) => SETTING_KEYS.includes(s.key)).map((s) => (
                <div key={s.key} className="bg-white rounded-xl border border-zinc-200 p-4">
                  <p className="text-sm font-medium text-zinc-700 mb-2">{s.label ?? s.key}</p>
                  {editingSettingKey === s.key ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={settingDraft}
                        onChange={(e) => setSettingDraft(e.target.value)}
                        className="w-28 h-8 text-sm"
                        autoFocus
                      />
                      <span className="text-xs text-zinc-400">{s.unit}</span>
                      <Button size="sm" className="h-8" onClick={() => saveSetting(s.key, parseFloat(settingDraft))}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingSettingKey(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingSettingKey(s.key); setSettingDraft(s.value.toString()) }}
                      className="flex items-baseline gap-2 group"
                    >
                      <span className="text-2xl font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">
                        {s.value}
                      </span>
                      <span className="text-xs text-zinc-400">{s.unit}</span>
                      <Pencil size={12} className="text-zinc-300 group-hover:text-blue-400 transition-colors ml-1" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Comparison table */}
          {!loading && metrics.length > 1 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">Speed Comparison</h3>
              <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Setup</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500">min/1k sqft</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500">8k lawn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics
                      .filter((m) => m.minutes_per_1000sqft != null)
                      .sort((a, b) => (a.minutes_per_1000sqft ?? 99) - (b.minutes_per_1000sqft ?? 99))
                      .map((m) => (
                        <tr key={m.id} className="border-b border-zinc-50 last:border-0">
                          <td className="px-3 py-2 text-zinc-700">{m.label}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-900">{m.minutes_per_1000sqft}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-600">
                            {Math.round((m.minutes_per_1000sqft ?? 0) * 8)} min
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Add/Edit Metric Dialog */}
      <Dialog open={metricOpen} onOpenChange={setMetricOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMetric ? 'Edit Metric' : 'Add Speed Metric'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Label *</Label>
              <Input
                value={metricForm.label}
                onChange={(e) => setMetricForm({ ...metricForm, label: e.target.value })}
                placeholder="e.g. John – Push Mower, Rider ZTR"
              />
            </div>

            <div className="space-y-1">
              <Label>Minutes per 1,000 sqft</Label>
              <Input
                type="number"
                step="0.1"
                value={metricForm.minutes_per_1000sqft}
                onChange={(e) => setMetricForm({ ...metricForm, minutes_per_1000sqft: e.target.value })}
                placeholder="e.g. 4.5"
              />
              <p className="text-xs text-zinc-400">Time to mow 1,000 sq ft. Tip: time a known lawn and divide.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Employee (optional)</Label>
                <Select value={metricForm.employee_id || 'none'} onValueChange={(v) => setMetricForm({ ...metricForm, employee_id: (v ?? '') === 'none' ? '' : (v ?? '') })}>
                  <SelectTrigger><SelectValue placeholder="— none —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Equipment (optional)</Label>
                <Select value={metricForm.equipment_id || 'none'} onValueChange={(v) => setMetricForm({ ...metricForm, equipment_id: (v ?? '') === 'none' ? '' : (v ?? '') })}>
                  <SelectTrigger><SelectValue placeholder="— none —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {equipmentList.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={metricForm.notes}
                onChange={(e) => setMetricForm({ ...metricForm, notes: e.target.value })}
                rows={2}
                placeholder="e.g. Measured on flat terrain, no obstacles"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetricOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMetric} disabled={savingMetric}>{savingMetric ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
