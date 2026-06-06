'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Landmark, Plus, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface Allocation {
  id: string
  name: string
  target_amount: number
  allocated_amount: number
  created_at: string
}
interface Obligation {
  id: string
  merchant: string
  amount: number
  payment_method: 'credit_card' | 'loan'
  due_date: string
  allocated_amount: number
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

  // Custom buckets (bank_allocations) and obligation buckets (unpaid expenses)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading]         = useState(true)

  // Context
  const [payrollOwed, setPayrollOwed]     = useState(0)
  const [monthRevenue, setMonthRevenue]   = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  // Add-bucket form
  const [newName, setNewName]     = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [adding, setAdding]       = useState(false)

  // ── Loaders ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/bank/allocations').then(r => (r.ok ? r.json() : [])),
      fetch('/api/expenses/obligations').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([allocs, obs]) => {
        setAllocations(Array.isArray(allocs) ? allocs : [])
        setObligations(Array.isArray(obs) ? obs : [])
      })
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
    fetch(`/api/money/summary?month=${selectedMonth}`)
      .then(r => r.json())
      .then(d => setMonthRevenue(Array.isArray(d) ? num(d[0]?.revenue) : 0))
      .catch(() => setMonthRevenue(0))
  }, [selectedMonth])

  // ── Derived totals ────────────────────────────────────────────────────────────
  const obStillNeeded     = obligations.reduce((s, o) => s + Math.max(0, num(o.amount) - num(o.allocated_amount)), 0)
  const customStillNeeded = allocations.reduce((s, a) => s + Math.max(0, num(a.target_amount) - num(a.allocated_amount)), 0)
  const totalStillNeeded  = obStillNeeded + customStillNeeded
  const totalSetAside =
    obligations.reduce((s, o) => s + num(o.allocated_amount), 0) +
    allocations.reduce((s, a) => s + num(a.allocated_amount), 0)

  // What's left for the two partners after payroll and every bill is covered.
  const freeToSplit = (bankBalance ?? 0) - payrollOwed - totalStillNeeded
  const perPartner  = freeToSplit / 2

  // ── Balance ─────────────────────────────────────────────────────────────────
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

  // ── Obligation buckets (set-aside is a running total on the expense) ──────────
  async function setObligationAside(id: string, raw: string) {
    const ob = obligations.find(o => o.id === id)
    if (!ob) return
    const n = parseFloat(raw)
    const value = Number.isFinite(n) && n >= 0 ? n : 0
    if (value === num(ob.allocated_amount)) return

    const prev = obligations
    setObligations(p => p.map(o => (o.id === id ? { ...o, allocated_amount: value } : o)))
    const res = await fetch('/api/expenses/obligations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, allocated_amount: value }),
    })
    if (!res.ok) { setObligations(prev); toast.error('Failed to save — has migration 0018 been applied?') }
  }

  function fundObligation(ob: Obligation) {
    setObligations(p => p.map(o => (o.id === ob.id ? { ...o, allocated_amount: num(ob.amount) } : o)))
    fetch('/api/expenses/obligations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ob.id, allocated_amount: num(ob.amount) }),
    }).then(r => { if (!r.ok) toast.error('Failed to fund') })
  }

  // ── Custom buckets (bank_allocations) ─────────────────────────────────────────
  async function addAllocation(name: string, target: number) {
    const trimmed = name.trim()
    if (!trimmed) { toast.error('Name is required'); return }
    setAdding(true)
    const res = await fetch('/api/bank/allocations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, target_amount: target, allocated_amount: 0 }),
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

  function fundCustom(a: Allocation) {
    commitField(a.id, 'allocated_amount', String(num(a.target_amount)))
    setAllocations(p => p.map(x => (x.id === a.id ? { ...x, allocated_amount: num(a.target_amount) } : x)))
  }

  async function deleteAllocation(id: string) {
    const prev = allocations
    setAllocations(p => p.filter(a => a.id !== id))
    const res = await fetch(`/api/bank/allocations?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { setAllocations(prev); toast.error('Failed to remove') }
  }

  const bucketCount = obligations.length + allocations.length
  const monthLabel  = format(parseISO(`${selectedMonth}-01`), 'MMMM')

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Bank Account</h1>
          <p className="text-sm text-zinc-500 mt-1">The live view: set what&rsquo;s in the account, fund what it owes, see what you and your partner actually keep.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Evaluate month</span>
          <input
            type="month"
            value={selectedMonth}
            max={format(new Date(), 'yyyy-MM')}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            aria-label="Month to evaluate"
          />
        </div>
      </div>

      {/* ── Overview ────────────────────────────────────────────────────────── */}
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
          {/* Selected month revenue */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">{monthLabel} revenue</p>
            <p className="text-2xl font-bold mt-1 text-zinc-700">
              {monthRevenue !== null ? formatCurrency(monthRevenue) : '—'}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">money you have to direct</p>
          </div>
          {/* Still to fund */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">Still to fund</p>
            <p className={`text-2xl font-bold mt-1 ${totalStillNeeded > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formatCurrency(totalStillNeeded)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">{formatCurrency(totalSetAside)} set aside so far</p>
          </div>
          {/* Take-home */}
          <div className={`rounded-lg border px-4 py-3 ${freeToSplit >= 0 ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Free to split</p>
            <p className={`text-2xl font-bold mt-1 ${freeToSplit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {bankBalance !== null ? formatCurrency(freeToSplit) : '—'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">≈ {formatCurrency(perPartner)} each (you + partner)</p>
          </div>
        </div>

        {/* Profit math */}
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">{formatCurrency(bankBalance ?? 0)}</span> in the account
          <span className="text-zinc-300">−</span>
          <span className="font-medium text-orange-600">{formatCurrency(payrollOwed)}</span> payroll owed
          <span className="text-zinc-300">−</span>
          <span className="font-medium text-violet-600">{formatCurrency(totalStillNeeded)}</span> still needed for bills
          <span className="text-zinc-300">=</span>
          <span className={`font-semibold ${freeToSplit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(freeToSplit)}</span> free to split
        </div>

        {freeToSplit < 0 && (
          <div className="px-5 py-2.5 bg-red-50 border-t border-red-100 text-xs text-red-600">
            Heads up — the account doesn&rsquo;t fully cover payroll plus what&rsquo;s still needed for bills. Don&rsquo;t pull profit until more revenue lands.
          </div>
        )}
      </div>

      {/* ── Buckets ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Where the money is going</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Unpaid bills come in automatically, soonest due first. Add your own buckets below.</p>
          </div>
          <span className="text-xs text-zinc-400 shrink-0">{bucketCount} bucket{bucketCount !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">Thing</th>
                  <th className="text-left px-4 py-2.5 font-medium">Due</th>
                  <th className="text-right px-4 py-2.5 font-medium">Needs (target)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Set aside</th>
                  <th className="text-right px-4 py-2.5 font-medium">Still needed</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {bucketCount === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    No bills or buckets yet. Add one below.
                  </td></tr>
                )}

                {/* Obligation buckets (unpaid expenses) — sorted by due date by the API */}
                {obligations.map(ob => {
                  const stillNeeded = Math.max(0, num(ob.amount) - num(ob.allocated_amount))
                  const funded = stillNeeded === 0 && num(ob.amount) > 0
                  return (
                    <tr key={`ob-${ob.id}`} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-800">{ob.merchant}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ob.payment_method === 'credit_card' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                            {ob.payment_method === 'credit_card' ? 'Credit Card' : 'Loan'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">{format(parseISO(ob.due_date), 'MMM d')}</td>
                      <td className="px-4 py-2 text-right text-zinc-700">{formatCurrency(num(ob.amount))}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-zinc-400 text-xs">$</span>
                          <input
                            key={`ob-alloc-${ob.id}-${num(ob.allocated_amount)}`}
                            type="number" step="0.01" inputMode="decimal"
                            defaultValue={num(ob.allocated_amount)}
                            onBlur={e => setObligationAside(ob.id, e.target.value)}
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
                        <div className="flex items-center justify-end">
                          {!funded && num(ob.amount) > 0 && (
                            <button
                              onClick={() => fundObligation(ob)}
                              className="text-xs text-zinc-400 hover:text-green-600 transition-colors"
                              title="Set aside the full amount"
                            >Fund</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {/* Custom buckets */}
                {allocations.map(a => {
                  const stillNeeded = Math.max(0, num(a.target_amount) - num(a.allocated_amount))
                  const funded = stillNeeded === 0 && num(a.target_amount) > 0
                  return (
                    <tr key={`al-${a.id}`} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-2">
                        <input
                          key={`name-${a.id}`}
                          defaultValue={a.name}
                          onBlur={e => commitField(a.id, 'name', e.target.value)}
                          className="w-full bg-transparent font-medium text-zinc-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300 rounded px-1.5 py-1 -mx-1.5"
                        />
                      </td>
                      <td className="px-4 py-2 text-zinc-300">—</td>
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
                              onClick={() => fundCustom(a)}
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

        {/* Add custom bucket */}
        <div className="border-t border-zinc-100 px-4 py-3 bg-zinc-50/50 flex items-center gap-2 flex-wrap">
          <Input
            placeholder="New bucket (e.g. Taxes, Savings, New mower)"
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
    </div>
  )
}
