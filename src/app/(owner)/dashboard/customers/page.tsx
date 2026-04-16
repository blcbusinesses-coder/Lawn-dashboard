'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { toast } from 'sonner'
import { parseCSVString } from '@/lib/csv/parser'

interface Customer {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

const EMPTY_CUSTOMER = { full_name: '', email: '', phone: '', address: '', notes: '' }

// Fields we support mapping from CSV columns
const IMPORT_FIELDS = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'first_name', label: 'First Name (combined with last)' },
  { key: 'last_name', label: 'Last Name (combined with first)' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Street Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP Code' },
  { key: 'notes', label: 'Notes' },
]

const CUSTOMER_FORM_FIELDS = [
  { key: 'full_name', label: 'Full Name *' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'notes', label: 'Notes' },
]

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(EMPTY_CUSTOMER)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvParsed, setCsvParsed] = useState<{ headers: string[]; preview: Record<string, string>[] } | null>(null)
  const [colMap, setColMap] = useState<Record<string, string>>({})
  const [autoProperty, setAutoProperty] = useState(true)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customers')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setCustomers(Array.isArray(data) ? data : [])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_CUSTOMER)
    setFormOpen(true)
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ full_name: c.full_name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '' })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.full_name.trim()) return toast.error('Name is required')
    setSaving(true)

    const url = editing ? `/api/customers/${editing.id}` : '/api/customers'
    const method = editing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error)
    } else {
      toast.success(editing ? 'Customer updated' : 'Customer added')
      setFormOpen(false)
      load()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/customers/${deleteId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Customer deleted')
      setDeleteId(null)
      load()
    } else {
      toast.error('Could not delete customer')
    }
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      const parsed = parseCSVString(text)
      setCsvParsed(parsed)

      // Auto-detect common column names
      const autoMap: Record<string, string> = {}
      const h = parsed.headers.map((x) => x.toLowerCase().trim())

      const matchers: [string, string[]][] = [
        ['full_name', ['customer company name', 'full name', 'name', 'company']],
        ['first_name', ['first name', 'firstname', 'first']],
        ['last_name', ['last name', 'lastname', 'last']],
        ['email', ['email', 'e-mail', 'email address']],
        ['phone', ['phone', 'phone number', 'cell', 'mobile']],
        ['address', ['address', 'street', 'street address', 'address 1']],
        ['city', ['city']],
        ['state', ['state', 'province']],
        ['zip', ['zip', 'postal', 'zip code', 'postal code']],
        ['notes', ['notes', 'note', 'comments']],
      ]

      for (const [field, keywords] of matchers) {
        for (const kw of keywords) {
          const idx = h.indexOf(kw)
          if (idx !== -1) { autoMap[field] = parsed.headers[idx]; break }
        }
      }

      setColMap(autoMap)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!csvParsed || !csvText) return
    setImporting(true)

    const parsed = parseCSVString(csvText)
    const rows = parsed.rows.map((row) => {
      const mapped: Record<string, string> = {}
      for (const [field, col] of Object.entries(colMap)) {
        if (col && row[col] !== undefined) mapped[field] = row[col]
      }
      return mapped
    })

    const res = await fetch('/api/customers/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, auto_create_property: autoProperty }),
    })
    const result = await res.json()

    const parts = []
    if (result.inserted) parts.push(`${result.inserted} new customers`)
    if (result.updated) parts.push(`${result.updated} updated`)
    if (result.properties_created) parts.push(`${result.properties_created} properties created`)
    toast.success(parts.join(', ') || 'Import complete')
    if (result.errors?.length) toast.warning(`${result.errors.length} rows skipped`)

    setImportOpen(false)
    setCsvParsed(null)
    setCsvText('')
    load()
    setImporting(false)
  }

  const filtered = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Customers</h1>
          <p className="text-sm text-zinc-500 mt-1">{customers.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button onClick={openAdd}>+ Add Customer</Button>
        </div>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600">Address</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-50">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  ))}
                  <td />
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  {search ? 'No customers match your search' : 'No customers yet. Add one or import a CSV.'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900">{c.full_name}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.email ?? <span className="text-zinc-300">—</span>}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.phone ?? <span className="text-zinc-300">—</span>}</td>
                  <td className="px-4 py-3 text-zinc-600 max-w-xs truncate">{c.address ?? <span className="text-zinc-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setDeleteId(c.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {CUSTOMER_FORM_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                {f.key === 'notes' ? (
                  <Textarea
                    value={(form as Record<string, string>)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <Input
                    value={(form as Record<string, string>)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
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
          <DialogHeader><DialogTitle>Delete Customer?</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setCsvParsed(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import Customers from CSV</DialogTitle></DialogHeader>

          {!csvParsed ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Upload your CSV. Columns will be auto-detected — you can adjust the mapping before importing.
              </p>
              <Input type="file" accept=".csv" onChange={handleCSVFile} />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-zinc-700 mb-3">
                  Map CSV columns → customer fields
                  <span className="text-zinc-400 font-normal ml-2">(auto-detected, adjust if needed)</span>
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {IMPORT_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-0.5">
                      <Label className="text-xs text-zinc-500">{f.label}</Label>
                      <select
                        className="w-full border border-zinc-200 rounded-md px-2 py-1.5 text-sm bg-white"
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

              {/* Auto-create properties toggle */}
              <div className="flex items-start gap-3 bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                <input
                  type="checkbox"
                  id="auto-prop"
                  checked={autoProperty}
                  onChange={(e) => setAutoProperty(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="auto-prop" className="text-sm font-medium text-zinc-800 cursor-pointer">
                    Auto-create properties from address
                  </label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Creates a property record linked to each customer using their mapped address. Set price per mow in the Properties tab afterward.
                  </p>
                </div>
              </div>

              {/* Preview table */}
              <div>
                <p className="text-xs text-zinc-400 mb-1.5">Preview (first 5 rows)</p>
                <div className="overflow-x-auto rounded border border-zinc-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-50">
                        {csvParsed.headers.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium text-zinc-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsed.preview.map((row, i) => (
                        <tr key={i} className="border-t border-zinc-50">
                          {csvParsed.headers.map((h) => (
                            <td key={h} className="px-2 py-1.5 text-zinc-600 truncate max-w-[100px]">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setCsvParsed(null) }}>Cancel</Button>
            {csvParsed && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importing…' : `Import ${autoProperty ? '+ Create Properties' : ''}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!loading && (
        <div className="mt-4 flex gap-2">
          <Badge variant="secondary">{customers.length} customers</Badge>
        </div>
      )}
    </div>
  )
}
