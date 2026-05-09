import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'

function q(val: string | number | null | undefined): string {
  return `"${String(val ?? '').replace(/"/g, '""')}"`
}
function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(q).join(',')
}

const CATEGORIES = ['fuel', 'equipment', 'supplies', 'labor', 'other']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const monthDate = parseISO(`${month}-01`)
  const start = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const end   = format(endOfMonth(monthDate),   'yyyy-MM-dd')
  const label = format(monthDate, 'MMMM yyyy')

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('expense_date, merchant, category, notes, amount')
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('expense_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Aggregate ────────────────────────────────────────────────────────────
  const byCat: Record<string, number> = {}
  let grandTotal = 0
  for (const e of expenses ?? []) {
    const cat = (e.category ?? 'other').toLowerCase()
    byCat[cat] = (byCat[cat] ?? 0) + Number(e.amount ?? 0)
    grandTotal += Number(e.amount ?? 0)
  }

  const lines: string[] = []

  // ── Header ───────────────────────────────────────────────────────────────
  lines.push(row([`GRAY WOLF WORKERS — Expense Report: ${label}`]))
  lines.push(row([`Exported: ${format(new Date(), 'MMMM d, yyyy')}`]))
  lines.push(row([`Total Expenses: $${grandTotal.toFixed(2)}`]))
  lines.push(row([`Transactions: ${(expenses ?? []).length}`]))
  lines.push('')

  // ── Summary by category ───────────────────────────────────────────────────
  lines.push(row(['SUMMARY BY CATEGORY', '', '']))
  lines.push(row(['Category', 'Amount', 'Count']))
  const allCats = [...new Set([...CATEGORIES, ...Object.keys(byCat)])]
  for (const cat of allCats) {
    if (!byCat[cat]) continue
    const count = (expenses ?? []).filter(e => (e.category ?? 'other').toLowerCase() === cat).length
    lines.push(row([cat.charAt(0).toUpperCase() + cat.slice(1), byCat[cat].toFixed(2), count]))
  }
  lines.push(row(['TOTAL', grandTotal.toFixed(2), (expenses ?? []).length]))
  lines.push('')

  // ── Full detail ───────────────────────────────────────────────────────────
  lines.push(row(['EXPENSE DETAIL', '', '', '', '']))
  lines.push(row(['Date', 'Merchant', 'Category', 'Notes', 'Amount']))

  let runningTotal = 0
  for (const e of expenses ?? []) {
    const amt = Number(e.amount ?? 0)
    runningTotal += amt
    lines.push(row([
      e.expense_date,
      e.merchant,
      e.category,
      e.notes ?? '',
      amt.toFixed(2),
    ]))
  }

  lines.push(row(['', '', '', 'GRAND TOTAL', grandTotal.toFixed(2)]))
  lines.push('')

  // ── Category groups ───────────────────────────────────────────────────────
  for (const cat of allCats) {
    const catExpenses = (expenses ?? []).filter(e => (e.category ?? 'other').toLowerCase() === cat)
    if (!catExpenses.length) continue
    const catTotal = catExpenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)
    lines.push(row([`${cat.toUpperCase()} EXPENSES`, '', '', '', '']))
    lines.push(row(['Date', 'Merchant', 'Notes', '', 'Amount']))
    for (const e of catExpenses) {
      lines.push(row([e.expense_date, e.merchant, e.notes ?? '', '', Number(e.amount ?? 0).toFixed(2)]))
    }
    lines.push(row(['', '', `${cat} subtotal`, '', catTotal.toFixed(2)]))
    lines.push('')
  }

  const body = lines.join('\r\n')
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gray-wolf-expenses-${month}.csv"`,
    },
  })
}
