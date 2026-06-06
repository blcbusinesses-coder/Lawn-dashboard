'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Landmark, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface Allocation {
  id: string
  name: string
  target_amount: number
  allocated_amount: number
  created_at: string
}
interface Obligation {
  id: string; merchant: string; amount: number
  payment_method: 'credit_card' | 'loan'; due_date: string
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function BankPage() {
  // Bank balance (singleton business_settings)
  const [bankBalance, setBankBalance]   = useState<number | null>(null)
  const [balanceInput, setBalanceInput] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)

  // Allocations
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [loading, setLoading]         = useState(true)

  // Context data for suggestions / revenue
  const [payrollOwed, setPayrollOwed]   = useState(0)
  const [obligations, setObligations]   = useState<Obligation[]>([])
  const [monthRevenue, setMonthRevenue] = useState<number | null>(null)

  // Add-allocation form
  const [newName, setNewName]     = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [adding, setAdding]       = useState(false)

  // ── Loaders ─────────────────────────────────────────────────────────────────
  // Initial allocations load (loading starts true, so we only flip it off here).
  useEffect(() => {
    fetch('/api/bank/allocations')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setAllocations(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/money/settings')
      .then(r => r.json())
      .then(d => { const b = num(d?.bank_balance); setBankBalance(b); setBalanceInput(String(b)) })
      .catch(() => { setBankBalance(0); setBalanceInput('0') })
  }, [])

  useEffect(() => {
    fetch('/api/employees/payroll-summary')
      .then(r => r.json())
      .then(d => setPayrollOwed(num(d?.total_owed)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/expenses/obligations')
      .then(r => r.json())
      .then(d => setObligations(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const monthKey = format(new Date(), 'yyyy-MM')
    fetch(`/api/money/summary?month=${monthKey}`)
      .then(r => r.json())
      .then(d => setMonthRevenue(Array.isArray(d) ? num(d[0]?.revenue) : null))
      .catch(() => {})
  }, [])

  // ── Derived totals ────────────────────────────────────────────────────────────
  const totalAllocated   = allocations.reduce((s, a) => s + num(a.allocated_amount), 0)
  const totalStillNeeded = allocations.reduce((s, a) => s + Math.max(0, num(a.target_amount) - num(a.allocated_amount)), 0)
  const unallocated      = (bankBalance ?? 0) - totalAllocated

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function saveBalance() {
    const val = parseFloat(balanceInput)
    if (!Number.isFinite(val) || val < 0) { toast.error('Enter a valid balance'); return }
    setSavingBalance(true)
    const res = await fetch('/api/money/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank_balance: val }),
    })
    if (res.ok) { setBankBalance(val); toast.success('Balance updated') }
    else toast.error('Failed to save — has migration 0016 been applied?')
    setSavingBalance(false)
  }

  async function addAllocation(name: string, target: number, allocated = 0) {
    const trimmed = name.trim()
    if (!trimmed) { toast.error('Name is required'); return }
    setAdding(true)
    const res = await fetch('/api/bank/allocations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, target_amount: target, allocated_amount: allocated }),
    })
    if (res.ok) {
      const created = await res.json()
      setAllocations(prev => [...prev, created])
      setNewName(''); setNewTarget('')
    } else {
      toast.error('Failed to add — has migration 0017 been applied?')
    }
    setAdding(false)
  }

  // Commit one field of one allocation (used on blur of the inline inputs).
  async function commitField(id: string, field: 'name' | 'target_amount' | 'allocated_amount', raw: string) {
    const current = allocations.find(a => a.id === id)
    if (!current) return

    let value: string | number
    if (field === 'name') {
      value = raw.trim()
      if (!value || value === current.name) return
    } else {
      const n = parseFloat(raw)
      value = Number.isFinite(n) && n >= 0 ? n : 0
      if (value === num(current[field])) return
    }

    const prev = allocations
    setAllocations(p => p.map(a => (a.id === id ? { ...a, [field]: value } : a)))
    const res = await fetch('/api/bank/allocations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    })
    if (!res.ok) { setAllocations(prev); toast.error('Failed to save change') }
  }

  async function deleteAllocation(id: string) {
    const prev = allocations
    setAllocations(p => p.filter(a => a.id !== id))
    const res = await fetch(`/api/bank/allocations?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { setAllocations(prev); toast.error('Failed to remove') }
  }

  // Set allocated = target for a row (fully fund it).
  function fundFully(a: Allocation) {
    commitField(a.id, 'allocated_amount', String(num(a.target_amount)))
    setAllocations(p => p.map(x => (x.id === a.id ? { ...x, allocated_amount: num(a.target_amount) } : x)))
  }

  // ── Suggestions (things you owe that aren't a bucket yet) ──────────────────────
  const existingNames = new Set(allocations.map(a => a.name.toLowerCase()))
  const suggestions: { name: string; target: number }[] = []
  if (payrollOwed > 0 && !existingNames.has('payroll')) suggestions.push({ name: 'Payroll', target: payrollOwed })
  for (const ob of obligations) {
    const label = ob.payment_method === 'credit_card' ? `${ob.merchant} (Credit Card)` : `${ob.merchant} (Loan)`
    if (!existingNames.has(label.toLowerCase())) suggestions.push({ name: label, target: num(ob.amount) })
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Bank Account</h1>
        <p className="text-sm text-zinc-500 mt-1">Set what&rsquo;s in the account, then split it across what it&rsquo;s going toward.</p>
      </div>

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2.5">
          <Landmark size={15} className="text-zinc-400 shrink-0" />
          <p className="text-sm font-semibold text-zinc-800">Account Overview</p>
        </div>
        <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Bank balance (editable) */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">In the account</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-zinc-400 text-sm">$</span>
              <Input
                type="number" step="0.01" inputMode="decimal"
                value={balanceInput}
                onChange={e => setBalanceInput(e.target.value)}
                className="h-8 text-sm font-semibold"
                aria-label="Current bank balance"
              />
              <Button size="sm" variant="outline"
                onClick={saveBalance}
                disabled={savingBalance || balanceInput === String(bankBalance ?? '')}>
                {savingBalance ? '…' : 'Save'}
              </Button>
            </div>
          </div>
          {/* Unallocated */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">Not yet assigned</p>
            <p className={`text-2xl font-bold mt-1 ${unallocated >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatCurrency(unallocated)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">{formatCurrency(totalAllocated)} assigned</p>
          </div>
          {/* Still needed */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">Still to fund</p>
            <p className={`text-2xl font-bold mt-1 ${totalStillNeeded > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formatCurrency(totalStillNeeded)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">across all buckets</p>
          </div>
          {/* This month revenue */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">{format(new Date(), 'MMM')} revenue</p>
            <p className="text-2xl font-bold mt-1 text-zinc-700">
              {monthRevenue !== null ? formatCurrency(monthRevenue) : '—'}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">coming in this month</p>
          </div>
        </div>
        {unallocated < 0 && (
          <div className="px-5 py-2.5 bg-red-50 border-t border-red-100 text-xs text-red-600">
            You&rsquo;ve assigned more than what&rsquo;s in the account. Lower an allocation or update the balance.
          </div>
        )}
      </div>

      {/* ── Allocations ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">Where the money is going</h2>
          <span className="text-xs text-zinc-400">{allocations.length} bucket{allocations.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">Thing</th>
                  <th className="text-right px-4 py-2.5 font-medium">Needs (target)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Set aside</th>
                  <th className="text-right px-4 py-2.5 font-medium">Still needed</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {allocations.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                    No buckets yet. Add one below, or use a suggestion.
                  </td></tr>
                ) : allocations.map(a => {
                  const stillNeeded = Math.max(0, num(a.target_amount) - num(a.allocated_amount))
                  const funded = stillNeeded === 0 && num(a.target_amount) > 0
                  return (
                    <tr key={a.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-2">
                        <input
                          key={`name-${a.id}`}
                          defaultValue={a.name}
                          onBlur={e => commitField(a.id, 'name', e.target.value)}
                          className="w-full bg-transparent font-medium text-zinc-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300 rounded px-1.5 py-1 -mx-1.5"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-zinc-400 text-xs">$</span>
                          <input
                            key={`target-${a.id}`}
                            type="number" step="0.01" inputMode="decimal"
                            defaultValue={num(a.target_amount)}
                            onBlur={e => commitField(a.id, 'target_amount', e.target.value)}
                            className="w-24 text-right bg-transparent text-zinc-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300 rounded px-1.5 py-1"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-zinc-400 text-xs">$</span>
                          <input
                            key={`alloc-${a.id}`}
                            type="number" step="0.01" inputMode="decimal"
                            defaultValue={num(a.allocated_amount)}
                            onBlur={e => commitField(a.id, 'allocated_amount', e.target.value)}
                            className="w-24 text-right bg-transparent font-medium text-green-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300 rounded px-1.5 py-1"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {funded
                          ? <span className="text-green-600">✓ Funded</span>
                          : <span className="text-orange-600">{formatCurrency(stillNeeded)}</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {!funded && num(a.target_amount) > 0 && (
                            <button
                              onClick={() => fundFully(a)}
                              className="text-xs text-zinc-400 hover:text-green-600 transition-colors"
                              title="Set aside the full amount"
                            >Fund</button>
                          )}
                          <button
                            onClick={() => deleteAllocation(a.id)}
                            className="text-zinc-400 hover:text-red-500 transition-colors"
                            title="Remove"
                          ><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add row */}
        <div className="border-t border-zinc-100 px-4 py-3 bg-zinc-50/50 flex items-center gap-2 flex-wrap">
          <Input
            placeholder="New bucket (e.g. Taxes, New mower)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="h-9 max-w-xs"
          />
          <div className="flex items-center gap-1">
            <span className="text-zinc-400 text-sm">$</span>
            <Input
              type="number" step="0.01" inputMode="decimal"
              placeholder="target"
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              className="h-9 w-28"
            />
          </div>
          <Button
            size="sm"
            onClick={() => addAllocation(newName, parseFloat(newTarget) || 0)}
            disabled={adding || !newName.trim()}
          >
            <Plus size={14} className="mr-1" />
            {adding ? 'Adding…' : 'Add bucket'}
          </Button>
        </div>
      </div>

      {/* ── Suggestions ─────────────────────────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs text-zinc-500 mb-2.5">
            Quick add from what you owe — click to create a bucket with the amount pre-filled:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button
                key={s.name}
                onClick={() => addAllocation(s.name, s.target)}
                disabled={adding}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                <Plus size={12} className="text-zinc-400" />
                <span className="font-medium text-zinc-700">{s.name}</span>
                <span className="text-zinc-400">{formatCurrency(s.target)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
