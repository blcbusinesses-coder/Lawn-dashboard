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
import { format } from 'date-fns'

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

const EMPTY_FORM = { full_name: '', email: '', password: '', hourly_rate: '', phone: '' }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'employees' | 'timelogs'>('employees')

  const load = useCallback(async () => {
    const [empRes, tlRes] = await Promise.all([
      fetch('/api/employees'),
      fetch('/api/timelogs'),
    ])

    if (empRes.ok) setEmployees(await empRes.json())
    if (tlRes.ok) setTimeLogs(await tlRes.json())

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
      body: JSON.stringify({
        ...form,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
      }),
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

  // Calculate this month's hours per employee
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const employeeStats = employees.map((emp) => {
    const logs = timeLogs.filter(
      (t) => t.employee_id === emp.id && t.clock_in >= monthStart && t.clock_out !== null
    )
    const totalMinutes = logs.reduce((sum, t) => sum + (t.duration_minutes ?? 0), 0)
    const totalHours = totalMinutes / 60
    const grossPay = totalHours * (emp.hourly_rate ?? 0)
    return { ...emp, totalHours, grossPay, logCount: logs.length }
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Employees</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your team and track time</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>+ Add Employee</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <Button size="sm" variant={activeTab === 'employees' ? 'default' : 'outline'} onClick={() => setActiveTab('employees')}>Team</Button>
        <Button size="sm" variant={activeTab === 'timelogs' ? 'default' : 'outline'} onClick={() => setActiveTab('timelogs')}>Time Logs</Button>
      </div>

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
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">No employees. Add your first team member.</td></tr>
              ) : (
                employeeStats.map((emp) => (
                  <tr key={emp.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{emp.full_name}</td>
                    <td className="px-4 py-3 text-zinc-600">{emp.hourly_rate ? `${formatCurrency(emp.hourly_rate)}/hr` : '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{emp.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{emp.totalHours.toFixed(1)}h ({emp.logCount} shifts)</td>
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
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">No time logs yet</td></tr>
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

      {/* Add Employee Dialog */}
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
    </div>
  )
}
