'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { getWeekStart, prevWeek, nextWeek, formatWeekLabel, toDateString } from '@/lib/utils/dates'
import { formatCurrency } from '@/lib/utils/currency'
import { format, addDays } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer { id: string; full_name: string }
interface Property {
  id: string
  address: string
  price_per_mow: number
  customers: Customer
}
interface JobLog {
  id: string
  property_id: string
  week_start: string
  status: 'done' | 'skipped'
}
interface PropertyWithStatus extends Property {
  jobLog: JobLog | null
}
interface OneOffJob {
  id: string
  title: string
  description: string | null
  amount: number
  status: 'pending' | 'done' | 'cancelled'
  scheduled_date: string | null
  completed_date: string | null
  notes: string | null
  customers: Customer | null
  properties: { id: string; address: string } | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JobsPage() {
  // Weekly jobs state
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart())
  const [properties, setProperties] = useState<Property[]>([])
  const [jobLogs, setJobLogs] = useState<JobLog[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [optimistic, setOptimistic] = useState<Map<string, 'done' | 'skipped' | null>>(new Map())

  // One-off jobs state
  const [oneOffJobs, setOneOffJobs] = useState<OneOffJob[]>([])
  const [oneOffLoading, setOneOffLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [formSaving, setFormSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    customer_id: '',
    amount: '',
    scheduled_date: '',
    notes: '',
  })

  // Edit one-off job state
  const [editingJob, setEditingJob] = useState<OneOffJob | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    customer_id: '',
    amount: '',
    scheduled_date: '',
    completed_date: '',
    notes: '',
    status: 'pending' as 'pending' | 'done' | 'cancelled',
  })
  const [editSaving, setEditSaving] = useState(false)

  const weekDateStr = toDateString(weekStart)
  const weekEndStr = toDateString(addDays(weekStart, 6))

  // ── Load weekly jobs ────────────────────────────────────────────────────────
  const loadWeekly = useCallback(async () => {
    const [propRes, jobRes] = await Promise.all([
      fetch('/api/properties'),
      fetch(`/api/jobs?week_start=${weekDateStr}`),
    ])
    setProperties(await propRes.json())
    setJobLogs(await jobRes.json())
    setLoading(false)
    setOptimistic(new Map())
  }, [weekDateStr])

  useEffect(() => { setLoading(true); loadWeekly() }, [loadWeekly])

  // ── Load one-off jobs ───────────────────────────────────────────────────────
  const loadOneOff = useCallback(async () => {
    setOneOffLoading(true)
    // Show pending + recently completed (last 60 days)
    const res = await fetch('/api/one-off-jobs')
    if (res.ok) setOneOffJobs(await res.json())
    setOneOffLoading(false)
  }, [])

  useEffect(() => { loadOneOff() }, [loadOneOff])

  // Load customers for form dropdown
  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(setCustomers).catch(() => {})
  }, [])

  // ── Weekly job actions ──────────────────────────────────────────────────────
  async function setStatus(propertyId: string, status: 'done' | 'skipped' | null) {
    if (pending.has(propertyId)) return
    setOptimistic((prev) => new Map(prev).set(propertyId, status))
    setPending((prev) => new Set(prev).add(propertyId))
    try {
      if (status === null) {
        await fetch(`/api/jobs?property_id=${propertyId}&week_start=${weekDateStr}`, { method: 'DELETE' })
      } else {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId, week_start: weekDateStr, status }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }
      const jobRes = await fetch(`/api/jobs?week_start=${weekDateStr}`)
      setJobLogs(await jobRes.json())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
      setOptimistic((prev) => { const m = new Map(prev); m.delete(propertyId); return m })
    } finally {
      setPending((prev) => { const s = new Set(prev); s.delete(propertyId); return s })
      setOptimistic((prev) => { const m = new Map(prev); m.delete(propertyId); return m })
    }
  }

  // ── One-off job actions ─────────────────────────────────────────────────────
  async function markOneOffDone(job: OneOffJob) {
    const res = await fetch('/api/one-off-jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: job.id, status: 'done' }),
    })
    if (res.ok) {
      toast.success(`"${job.title}" marked as done`)
      loadOneOff()
    } else {
      toast.error('Failed to update job')
    }
  }

  async function cancelOneOff(job: OneOffJob) {
    const res = await fetch('/api/one-off-jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: job.id, status: 'cancelled' }),
    })
    if (res.ok) { loadOneOff() }
    else { toast.error('Failed to cancel job') }
  }

  async function deleteOneOff(id: string) {
    await fetch(`/api/one-off-jobs?id=${id}`, { method: 'DELETE' })
    loadOneOff()
  }

  async function handleAddOneOff() {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setFormSaving(true)
    const res = await fetch('/api/one-off-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        customer_id: form.customer_id || null,
        amount: parseFloat(form.amount) || 0,
        scheduled_date: form.scheduled_date || null,
        notes: form.notes || null,
      }),
    })
    setFormSaving(false)
    if (res.ok) {
      toast.success('One-off job added')
      setShowAddDialog(false)
      setForm({ title: '', description: '', customer_id: '', amount: '', scheduled_date: '', notes: '' })
      loadOneOff()
    } else {
      toast.error('Failed to create job')
    }
  }

  function openEditDialog(job: OneOffJob) {
    setEditingJob(job)
    setEditForm({
      title: job.title,
      description: job.description ?? '',
      customer_id: job.customers?.id ?? '',
      amount: String(job.amount),
      scheduled_date: job.scheduled_date ?? '',
      completed_date: job.completed_date ?? '',
      notes: job.notes ?? '',
      status: job.status,
    })
  }

  async function handleSaveEdit() {
    if (!editingJob) return
    if (!editForm.title.trim()) { toast.error('Title is required'); return }
    setEditSaving(true)
    const res = await fetch('/api/one-off-jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingJob.id,
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        customer_id: editForm.customer_id || null,
        amount: parseFloat(editForm.amount) || 0,
        scheduled_date: editForm.scheduled_date || null,
        completed_date: editForm.completed_date || null,
        notes: editForm.notes.trim() || null,
        status: editForm.status,
      }),
    })
    setEditSaving(false)
    if (res.ok) {
      toast.success('Job updated')
      setEditingJob(null)
      loadOneOff()
    } else {
      const { error } = await res.json()
      toast.error(error ?? 'Failed to save')
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const propertiesWithStatus: PropertyWithStatus[] = properties.map((p) => ({
    ...p,
    jobLog: jobLogs.find((j) => j.property_id === p.id) ?? null,
  }))

  const doneCount = propertiesWithStatus.filter((p) => {
    const opt = optimistic.get(p.id)
    return (opt !== undefined ? opt : p.jobLog?.status) === 'done'
  }).length

  const mowRevenue = propertiesWithStatus
    .filter((p) => {
      const opt = optimistic.get(p.id)
      return (opt !== undefined ? opt : p.jobLog?.status) === 'done'
    })
    .reduce((sum, p) => sum + p.price_per_mow, 0)

  // One-off jobs completed this week
  const oneOffThisWeek = oneOffJobs.filter(
    (j) => j.status === 'done' && j.completed_date && j.completed_date >= weekDateStr && j.completed_date <= weekEndStr
  )
  const oneOffWeekRevenue = oneOffThisWeek.reduce((sum, j) => sum + j.amount, 0)

  // Split one-off jobs into pending and recent done
  const pendingOneOff = oneOffJobs.filter((j) => j.status === 'pending')
  const doneOneOff = oneOffJobs.filter((j) => j.status === 'done').slice(0, 10)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-8">
      {/* ── Weekly Jobs ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Jobs</h1>
            <p className="text-sm text-zinc-500 mt-1">Track weekly lawn completions</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(prevWeek(weekStart))}>← Prev</Button>
            <div className="text-center min-w-[180px]">
              <p className="text-sm font-medium text-zinc-900">{formatWeekLabel(weekStart)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(nextWeek(weekStart))}>Next →</Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Lawns Done</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{doneCount} / {properties.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Mowing Revenue</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(mowRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">One-Off This Week</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(oneOffWeekRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Week Revenue</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(mowRevenue + oneOffWeekRevenue)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Property</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Status</th>
                <th className="px-4 py-3 font-medium text-zinc-600 text-right">Actions</th>
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
              ) : propertiesWithStatus.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">No properties. Add some in the Properties tab first.</td></tr>
              ) : (
                propertiesWithStatus.map((p) => {
                  const opt = optimistic.get(p.id)
                  const status = opt !== undefined ? opt : p.jobLog?.status ?? null
                  const isPending = pending.has(p.id)
                  return (
                    <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">{p.address}</td>
                      <td className="px-4 py-3 text-zinc-600">{p.customers?.full_name}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatCurrency(p.price_per_mow)}</td>
                      <td className="px-4 py-3">
                        {status === 'done' && <Badge className="bg-green-100 text-green-700 border-green-200">Done</Badge>}
                        {status === 'skipped' && <Badge variant="secondary">Skipped</Badge>}
                        {status === null && <Badge variant="outline" className="text-zinc-400">Pending</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant={status === 'done' ? 'default' : 'outline'}
                            className={status === 'done' ? 'bg-green-600 hover:bg-green-700' : ''}
                            disabled={isPending}
                            onClick={() => setStatus(p.id, status === 'done' ? null : 'done')}>
                            ✓ Done
                          </Button>
                          <Button size="sm" variant={status === 'skipped' ? 'secondary' : 'ghost'}
                            disabled={isPending}
                            onClick={() => setStatus(p.id, status === 'skipped' ? null : 'skipped')}>
                            Skip
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── One-Off Jobs ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">One-Off Jobs</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Mulching, stick cleanup, and other ad-hoc services</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>+ Add One-Off Job</Button>
        </div>

        {/* Pending one-off jobs */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden mb-4">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">Pending</span>
            {pendingOneOff.length > 0 && <Badge variant="secondary">{pendingOneOff.length}</Badge>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Job</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Scheduled</th>
                <th className="px-4 py-2.5 font-medium text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {oneOffLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : pendingOneOff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    No pending one-off jobs. Click &ldquo;+ Add One-Off Job&rdquo; to create one.
                  </td>
                </tr>
              ) : (
                pendingOneOff.map((job) => (
                  <tr key={job.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{job.title}</p>
                      {job.description && <p className="text-xs text-zinc-400 mt-0.5">{job.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{job.customers?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-900 font-medium">{formatCurrency(job.amount)}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {job.scheduled_date ? format(new Date(job.scheduled_date + 'T12:00:00'), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => markOneOffDone(job)}>
                          ✓ Done
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(job)}>✏️ Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelOneOff(job)}>Cancel</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Recently completed one-off jobs */}
        {doneOneOff.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
              <span className="text-sm font-medium text-zinc-700">Recently Completed</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Job</th>
                  <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Amount</th>
                  <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Completed</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {doneOneOff.map((job) => (
                  <tr key={job.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Done</Badge>
                        <span className="font-medium text-zinc-800">{job.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{job.customers?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-900 font-medium">{formatCurrency(job.amount)}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {job.completed_date ? format(new Date(job.completed_date + 'T12:00:00'), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(job)}>✏️ Edit</Button>
                        <button
                          onClick={() => deleteOneOff(job.id)}
                          className="p-1.5 text-zinc-300 hover:text-red-400 transition-colors rounded"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit One-Off Job Dialog ──────────────────────────────────────── */}
      <Dialog open={!!editingJob} onOpenChange={(open) => { if (!open) setEditingJob(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit One-Off Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Service Type *</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="e.g. Mulching, Stick Cleanup"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Optional details"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <select
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={editForm.customer_id}
                onChange={(e) => setEditForm({ ...editForm, customer_id: e.target.value })}
              >
                <option value="">— No customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'pending' | 'done' | 'cancelled' })}
                >
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Scheduled Date</Label>
                <Input
                  type="date"
                  value={editForm.scheduled_date}
                  onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Completed Date</Label>
                <Input
                  type="date"
                  value={editForm.completed_date}
                  onChange={(e) => setEditForm({ ...editForm, completed_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingJob(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add One-Off Job Dialog ────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add One-Off Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Service Type *</Label>
              <Input
                placeholder="e.g. Mulching, Stick Cleanup, Leaf Removal"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Optional details"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <select
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              >
                <option value="">— No customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Scheduled Date</Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddOneOff} disabled={formSaving}>
              {formSaving ? 'Saving…' : 'Add Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
