'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { parseCSVString } from '@/lib/csv/parser'

interface Customer {
  id: string
  full_name: string
  email: string | null
  phone: string | null
}

interface Property {
  id: string
  address: string
  price_per_mow: number
  notes: string | null
  is_active: boolean
  customer_id: string
  customers: Customer
}

const EMPTY_FORM = { address: '', customer_id: '', price_per_mow: '', notes: '', is_active: true }

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [csvParsed, setCsvParsed] = useState<{ headers: string[]; preview: Record<string, string>[] } | null>(null)
  const [csvText, setCsvText] = useState('')
  const [colMap, setColMap] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    const [propRes, custRes] = await Promise.all([
      fetch('/api/properties'),
      fetch('/api/customers'),
    ])
    setProperties(await propRes.json())
    setCustomers(await custRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(p: Property) {
    setEditing(p)
    setForm({
      address: p.address,
      customer_id: p.customer_id,
      price_per_mow: String(p.price_per_mow),
      notes: p.notes ?? '',
      is_active: p.is_active,
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.address.trim()) return toast.error('Address is required')
    if (!form.customer_id) return toast.error('Customer is required')
    setSaving(true)

    const url = editing ? `/api/properties/${editing.id}` : '/api/properties'
    const method = editing ? 'PUT' : 'POST'
    const body = { ...form, price_per_mow: parseFloat(form.price_per_mow) || 0 }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      toast.error((await res.json()).error)
    } else {
      toast.success(editing ? 'Property updated' : 'Property added')
      setFormOpen(false)
      load()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/properties/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Property removed'); setDeleteId(null); load() }
    else toast.error('Could not delete property')
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      setCsvParsed(parseCSVString(text))
      setColMap({})
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!csvParsed || !csvText) return
    setImporting(true)
    const parsed = parseCSVString(csvText)
    const rows = parsed.rows.map((row) => {
      const mapped: Record<string, string | number | undefined> = {}
      for (const [field, col] of Object.entries(colMap)) {
        if (col && row[col]) {
          mapped[field] = field === 'price_per_mow' ? parseFloat(row[col]) : row[col]
        }
      }
      return mapped
    })

    const res = await fetch('/api/properties/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    const result = await res.json()
    toast.success(`Imported ${result.inserted} properties`)
    if (result.errors?.length) toast.warning(`${result.errors.length} rows had errors`)
    setImportOpen(false)
    setCsvParsed(null)
    load()
    setImporting(false)
  }

  const filtered = properties.filter(
    (p) =>
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      p.customers?.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const propFields = [
    { key: 'address', label: 'Address *' },
    { key: 'customer_email', label: 'Customer Email (to link)' },
    { key: 'price_per_mow', label: 'Price per Mow' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Properties</h1>
          <p className="text-sm text-zinc-500 mt-1">{properties.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button onClick={openAdd}>+ Add Property</Button>
        </div>
      </div>

      <Input placeholder="Search address or customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm mb-4" />

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Address</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Price/Mow</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-50">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                  ))}
                  <td />
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">No properties found</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900">{p.address}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.customers?.full_name}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatCurrency(p.price_per_mow)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteId(p.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Property' : 'Add Property'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Address *</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Customer *</Label>
              <select
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Price per Mow ($)</Label>
              <Input type="number" step="0.01" value={form.price_per_mow} onChange={(e) => setForm({ ...form, price_per_mow: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="active">Active property</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Property?</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600">Job history will also be deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import Properties from CSV</DialogTitle></DialogHeader>
          {!csvParsed ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">CSV should include address and customer email. Customers must exist first.</p>
              <Input type="file" accept=".csv" onChange={handleCSVFile} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {propFields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <select
                      className="w-full border border-zinc-200 rounded-md px-2 py-1.5 text-sm"
                      value={colMap[f.key] ?? ''}
                      onChange={(e) => setColMap({ ...colMap, [f.key]: e.target.value })}
                    >
                      <option value="">— skip —</option>
                      {csvParsed.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setCsvParsed(null) }}>Cancel</Button>
            {csvParsed && <Button onClick={handleImport} disabled={importing}>{importing ? 'Importing…' : 'Import'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
