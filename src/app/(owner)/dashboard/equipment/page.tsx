'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { cn } from '@/lib/utils'

interface Equipment {
  id: string
  name: string
  type: string
  brand: string | null
  model: string | null
  serial_number: string | null
  purchase_date: string | null
  purchase_price: number | null
  status: 'active' | 'maintenance' | 'retired'
  notes: string | null
}

const EQUIPMENT_TYPES = [
  { value: 'mower_rider', label: 'Rider Mower' },
  { value: 'mower_push', label: 'Push Mower' },
  { value: 'mower_zero_turn', label: 'Zero-Turn Mower' },
  { value: 'trimmer', label: 'String Trimmer' },
  { value: 'blower', label: 'Blower' },
  { value: 'edger', label: 'Edger' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'truck', label: 'Truck / Vehicle' },
  { value: 'other', label: 'Other' },
]

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  maintenance: 'bg-yellow-50 text-yellow-700',
  retired: 'bg-zinc-100 text-zinc-500',
}

const EMPTY_FORM = {
  name: '',
  type: 'other',
  brand: '',
  model: '',
  serial_number: '',
  purchase_date: '',
  purchase_price: '',
  status: 'active',
  notes: '',
}

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('active')

  const load = useCallback(async () => {
    const res = await fetch('/api/equipment')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(eq: Equipment) {
    setEditing(eq)
    setForm({
      name: eq.name,
      type: eq.type,
      brand: eq.brand ?? '',
      model: eq.model ?? '',
      serial_number: eq.serial_number ?? '',
      purchase_date: eq.purchase_date ?? '',
      purchase_price: eq.purchase_price?.toString() ?? '',
      status: eq.status,
      notes: eq.notes ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)

    const payload = {
      name: form.name,
      type: form.type,
      brand: form.brand || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      status: form.status,
      notes: form.notes || null,
    }

    const url = editing ? `/api/equipment/${editing.id}` : '/api/equipment'
    const method = editing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error)
    } else {
      toast.success(editing ? 'Equipment updated' : 'Equipment added')
      setFormOpen(false)
      load()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/equipment/${deleteId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Equipment deleted')
      setDeleteId(null)
      load()
    } else {
      toast.error('Could not delete equipment')
    }
  }

  function getTypeLabel(type: string) {
    return EQUIPMENT_TYPES.find((t) => t.value === type)?.label ?? type
  }

  const filtered = statusFilter === 'all' ? items : items.filter((i) => i.status === statusFilter)
  const activeCount = items.filter((i) => i.status === 'active').length

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Equipment</h1>
          <p className="text-sm text-zinc-500 mt-1">{activeCount} active pieces</p>
        </div>
        <Button onClick={openAdd}>+ Add Equipment</Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 mb-5 bg-zinc-100 rounded-lg p-1 w-fit">
        {['active', 'maintenance', 'retired', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
              statusFilter === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 py-12 text-center text-zinc-400 bg-white rounded-xl border border-zinc-200">
            No equipment found. Add your first piece of equipment.
          </div>
        ) : (
          filtered.map((eq) => (
            <div key={eq.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 truncate">{eq.name}</p>
                  <p className="text-sm text-zinc-500">{getTypeLabel(eq.type)}</p>
                </div>
                <Badge className={cn('text-xs border-0 shrink-0', STATUS_STYLES[eq.status])}>
                  {eq.status}
                </Badge>
              </div>

              {(eq.brand || eq.model) && (
                <p className="text-sm text-zinc-600">
                  {[eq.brand, eq.model].filter(Boolean).join(' ')}
                </p>
              )}

              {eq.serial_number && (
                <p className="text-xs text-zinc-400">S/N: {eq.serial_number}</p>
              )}

              {eq.purchase_price != null && (
                <p className="text-xs text-zinc-400">
                  Purchased {eq.purchase_date ? `${new Date(eq.purchase_date + 'T00:00:00').toLocaleDateString()} — ` : ''}
                  ${eq.purchase_price.toLocaleString()}
                </p>
              )}

              {eq.notes && (
                <p className="text-xs text-zinc-500 border-t border-zinc-100 pt-2">{eq.notes}</p>
              )}

              <div className="flex gap-2 mt-auto pt-2 border-t border-zinc-100">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => openEdit(eq)}>Edit</Button>
                <Button size="sm" variant="ghost" className="flex-1 text-red-500 hover:text-red-600" onClick={() => setDeleteId(eq.id)}>Delete</Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. John Deere Z540R"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v ?? '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v ?? '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. John Deere" />
              </div>
              <div className="space-y-1">
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. Z540R" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Serial Number</Label>
              <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Purchase Price ($)</Label>
                <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="0.00" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Equipment?</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
