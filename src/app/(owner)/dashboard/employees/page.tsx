'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { format, subMonths, startOfMonth } from 'date-fns'

interface Employee {
  id: string
  full_name: string
  hourly_rate: number | null
  phone: string | null
  is_active: boolean
}

interface TimeLog {
  id: string
  employee_id: string
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
  profiles?: { full_name: string; hourly_rate: number | null }
}

interface ManualHours {
  id: string
  employee_id: string
  month: string
  hours: number
  notes: string | null
  profiles?: { full_name: string; hourly_rate: number | null }
}

const EMPTY_FORM = { full_name: '', email: '', password: '', hourly_rate: '', phone: '' }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [manualHours, setManualHours] = useState<ManualHours[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'employees' | 'monthly' | 'timelogs'>('employees')

  // Manual hours dialog
  const [hoursDialog, setHoursDialog] = useState(false)
  const [hoursForm, setHoursForm] = useState({ employee_id: '', month: '', hours: '', notes: '' })
  const [hoursSaving, setHoursSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [empRes, tlRes, mhRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/timelogs'),
        fetch('/api/employees/hours'),
      ])
      if (empRes.ok) setEmployees(await empRes.json())
      if (tlRes.ok) setTimeLogs(await tlRes.json())
      if (mhRes.ok) setManualHours(await mhRes.json())
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      return toast.error('Name, email, and password are required')
    }
    setSaving(true)
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null }),
    })
    if (!res.ok) {
      toast.error((await res.json()).error)
    } else {
      toast.success(`Employee ${form.full_name} added`)
      setFormOpen(false)
      setForm(EMPTY_FORM)
      load()
    }
    setSaving(false)
  }

  async function handleSaveHours() {
    if (!hoursForm.employee_id || !hoursForm.month || !hoursForm.hours) {
      return toast.error('Employee, month, and hours are required')
    }
    setHoursSaving(true)
    const res = await fetch('/api/employees/hours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: hoursForm.employee_id,
        month: hoursForm.month,
        hours: parseFloat(hoursForm.hours),
        notes: hoursForm.notes || null,
      }),
    })
    setHoursSaving(false)
    if (res.ok) {
      toast.success('Hours saved')
      setHoursDialog(false)
      setHoursForm({ employee_id: '', month: '', hours: '', notes: '' })
      load()
    } else {
      toast.error('Failed to save hours')
    }
  }

  async function deleteHours(id: string) {
    await fetch(`/api/employees/hours?id=${id}`, { method: 'DELETE' })
    load()
  }

  function openEditHours(mh: ManualHours) {
    setHoursForm({
      employee_id: mh.employee_id,
      month: mh.month,
      hours: String(mh.hours),
      notes: mh.notes ?? '',
    })
    setHoursDialog(true)
  }

  // ── Current month stats from clock logs ──────────────────────────────────────
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const employeeStats = employees.map((emp) => {
    const logs = timeLogs.filter(
      (t) => t.employee_id === emp.id && t.clock_in >= monthStart && t.clock_out !== null
    )
    const clockMinutes = logs.reduce((sum, t) => sum + (t.duration_minutes ?? 0), 0)
    const clockHours = clockMinutes / 60

    const currentMonth = format(now, 'yyyy-MM')
    const manualEntry = manualHours.find((m) => m.employee_id === emp.id && m.month === currentMonth)
    const totalHours = clockHours + (manualEntry?.hours ?? 0)
    const grossPay = totalHours * (emp.hourly_rate ?? 0)
    return { ...emp, totalHours, grossPay, logCount: logs.length }
  })

  // ── Monthly summary: last 12 months per employee ──────────────────────────────
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(startOfMonth(now), i)
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') }
  })

  type MonthlySummaryRow = {
    employee: Employee
    rows: { month: string; label: string; clockHours: number; manualHours: number; totalHours: number; pay: number; manualId: string | null }[]
  }

  const monthlySummary: MonthlySummaryRow[] = employees.map((emp) => ({
    employee: emp,
    rows: months.map(({ key, label }) => {
      const clockMins = timeLogs
        .filter((t) => t.employee_id === emp.id && t.clock_in.startsWith(key) && t.clock_out)
        .reduce((sum, t) => sum + (t.duration_minutes ?? 0), 0)
      const clockHrs = clockMins / 60
      const manualEntry = manualHours.find((m) => m.employee_id === emp.id && m.month === key)
      const manualHrs = manualEntry?.hours ?? 0
      const total = clockHrs + manualHrs
      return {
        month: key,
        label,
        clockHours: clockHrs,
        manualHours: manualHrs,
        totalHours: total,
        pay: total * (emp.hourly_rate ?? 0),
        manualId: manualEntry?.id ?? null,
      }
    }),
  }))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Employees</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your team and track time</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setHoursForm({ employee_id: '', month: format(now, 'yyyy-MM'), hours: '', notes: '' }); setHoursDialog(true) }}>
            + Log Hours
          </Button>
          <Button onClick={() => setFormOpen(true)}>+ Add Employee</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['employees', 'monthly', 'timelogs'] as const).map((t) => (
          <Button key={t} size="sm" variant={activeTab === t ? 'default' : 'outline'} onClick={() => setActiveTab(t)}>
            {t === 'employees' ? 'Team' : t === 'monthly' ? 'Monthly Summary' : 'Clock Logs'}
          </Button>
        ))}
      </div>

      {/* ── TEAM TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Hourly Rate</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Hours This Month</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Est. Pay</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : employeeStats.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">No employees yet.</td></tr>
              ) : (
                employeeStats.map((emp) => (
                  <tr key={emp.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{emp.full_name}</td>
                    <td className="px-4 py-3 text-zinc-600">{emp.hourly_rate ? `${formatCurrency(emp.hourly_rate)}/hr` : '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{emp.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{emp.totalHours.toFixed(1)}h</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{formatCurrency(emp.grossPay)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={emp.is_active ? 'default' : 'secondary'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MONTHLY SUMMARY TAB ───────────────────────────────────────────────── */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : monthlySummary.length === 0 ? (
            <p className="text-zinc-400 text-sm">No employees yet.</p>
          ) : (
            monthlySummary.map(({ employee, rows }) => {
              const totalHours = rows.reduce((s, r) => s + r.totalHours, 0)
              const totalPay   = rows.reduce((s, r) => s + r.pay, 0)
              const hasData    = rows.some((r) => r.totalHours > 0)
              return (
                <div key={employee.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-900">{employee.full_name}</span>
                      {employee.hourly_rate && (
                        <span className="ml-2 text-xs text-zinc-400">{formatCurrency(employee.hourly_rate)}/hr</span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-500">
                      {totalHours.toFixed(1)}h total · {formatCurrency(totalPay)} est. pay
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left px-4 py-2 font-medium text-zinc-500 text-xs">Month</th>
                        <th className="text-right px-4 py-2 font-medium text-zinc-500 text-xs">Clock Hours</th>
                        <th className="text-right px-4 py-2 font-medium text-zinc-500 text-xs">Manual Hours</th>
                        <th className="text-right px-4 py-2 font-medium text-zinc-500 text-xs">Total</th>
                        <th className="text-right px-4 py-2 font-medium text-zinc-500 text-xs">Est. Pay</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.filter((r) => r.totalHours > 0 || r.month === format(now, 'yyyy-MM')).map((row) => (
                        <tr key={row.month} className="border-b border-zinc-50 hover:bg-zinc-50">
                          <td className="px-4 py-2.5 text-zinc-700 font-medium">{row.label}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-500">{row.clockHours > 0 ? `${row.clockHours.toFixed(1)}h` : '—'}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-500">{row.manualHours > 0 ? `${row.manualHours.toFixed(1)}h` : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">{row.totalHours.toFixed(1)}h</td>
                          <td className="px-4 py-2.5 text-right text-zinc-700">{row.pay > 0 ? formatCurrency(row.pay) : '—'}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => openEditHours({ id: row.manualId ?? '', employee_id: employee.id, month: row.month, hours: row.manualHours, notes: null })}
                              className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                            >
                              {row.manualId ? 'Edit' : '+ Add'}
                            </button>
                            {row.manualId && (
                              <button
                                onClick={() => deleteHours(row.manualId!)}
                                className="ml-2 text-xs text-zinc-300 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!hasData && (
                        <tr><td colSpan={6} className="px-4 py-4 text-center text-zinc-300 text-xs">No hours logged yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── CLOCK LOGS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'timelogs' && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Clock In</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Clock Out</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Pay</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : timeLogs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">No clock logs yet</td></tr>
              ) : (
                timeLogs.map((log) => {
                  const hours = (log.duration_minutes ?? 0) / 60
                  const rate = (log.profiles as { hourly_rate: number | null } | undefined)?.hourly_rate ?? 0
                  const pay = hours * rate
                  return (
                    <tr key={log.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-900">
                        {(log.profiles as { full_name: string } | undefined)?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">{format(new Date(log.clock_in), 'MMM d, h:mm a')}</td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {log.clock_out ? format(new Date(log.clock_out), 'MMM d, h:mm a') : <Badge variant="secondary">Active</Badge>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {log.duration_minutes ? `${Math.floor(log.duration_minutes / 60)}h ${log.duration_minutes % 60}m` : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-zinc-900">{rate > 0 ? formatCurrency(pay) : '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADD EMPLOYEE DIALOG ───────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-500">The employee will use this email and password to sign in.</p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Hourly Rate ($)</Label>
                <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create Employee'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── LOG HOURS DIALOG ──────────────────────────────────────────────────── */}
      <Dialog open={hoursDialog} onOpenChange={setHoursDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Monthly Hours</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-500">Manually record hours worked for a specific month. This is added on top of any clock-in/out entries.</p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Employee *</Label>
              <select
                value={hoursForm.employee_id}
                onChange={(e) => setHoursForm({ ...hoursForm, employee_id: e.target.value })}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Month *</Label>
                <Input
                  type="month"
                  value={hoursForm.month}
                  onChange={(e) => setHoursForm({ ...hoursForm, month: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Hours *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 32.5"
                  value={hoursForm.hours}
                  onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g. Adjusted for overtime"
                value={hoursForm.notes}
                onChange={(e) => setHoursForm({ ...hoursForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoursDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveHours} disabled={hoursSaving}>{hoursSaving ? 'Saving…' : 'Save Hours'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
