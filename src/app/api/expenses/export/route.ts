import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import * as XLSX from 'xlsx'

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

  const rows = expenses ?? []
  const grandTotal = rows.reduce((s, e) => s + Number(e.amount ?? 0), 0)

  // ── Sheet 1: All Expenses ─────────────────────────────────────────────────
  const detailSheet = XLSX.utils.aoa_to_sheet([
    [`Gray Wolf Workers — Expenses: ${label}`],
    [`Exported: ${format(new Date(), 'MMMM d, yyyy')}`],
    [],
    ['Date', 'Merchant', 'Category', 'Notes', 'Amount'],
    ...rows.map(e => [
      e.expense_date,
      e.merchant,
      e.category,
      e.notes ?? '',
      Number(e.amount ?? 0),
    ]),
    [],
    ['', '', '', 'TOTAL', grandTotal],
  ])

  // Column widths
  detailSheet['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 35 }, { wch: 12 },
  ]

  // ── Sheet 2: Category Summary ─────────────────────────────────────────────
  const byCat: Record<string, { count: number; total: number }> = {}
  for (const e of rows) {
    const cat = (e.category ?? 'other').toLowerCase()
    if (!byCat[cat]) byCat[cat] = { count: 0, total: 0 }
    byCat[cat].count++
    byCat[cat].total += Number(e.amount ?? 0)
  }

  const summarySheet = XLSX.utils.aoa_to_sheet([
    [`Summary by Category — ${label}`],
    [],
    ['Category', 'Transactions', 'Total'],
    ...[...CATEGORIES, ...Object.keys(byCat).filter(c => !CATEGORIES.includes(c))]
      .filter(cat => byCat[cat])
      .map(cat => [
        cat.charAt(0).toUpperCase() + cat.slice(1),
        byCat[cat].count,
        byCat[cat].total,
      ]),
    [],
    ['TOTAL', rows.length, grandTotal],
  ])
  summarySheet['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }]

  // ── Sheet 3: Per-category breakdown ──────────────────────────────────────
  const allCats = [...CATEGORIES, ...Object.keys(byCat).filter(c => !CATEGORIES.includes(c))].filter(c => byCat[c])
  const breakdownData: (string | number)[][] = [['Category', 'Date', 'Merchant', 'Notes', 'Amount']]
  for (const cat of allCats) {
    const catRows = rows.filter(e => (e.category ?? 'other').toLowerCase() === cat)
    for (const e of catRows) {
      breakdownData.push([
        cat.charAt(0).toUpperCase() + cat.slice(1),
        e.expense_date,
        e.merchant,
        e.notes ?? '',
        Number(e.amount ?? 0),
      ])
    }
    const catTotal = catRows.reduce((s, e) => s + Number(e.amount ?? 0), 0)
    breakdownData.push(['', '', `${cat} subtotal`, '', catTotal])
    breakdownData.push([])
  }
  const breakdownSheet = XLSX.utils.aoa_to_sheet(breakdownData)
  breakdownSheet['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 25 }, { wch: 35 }, { wch: 12 }]

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, detailSheet,    'All Expenses')
  XLSX.utils.book_append_sheet(wb, summarySheet,   'By Category')
  XLSX.utils.book_append_sheet(wb, breakdownSheet, 'Category Detail')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="gray-wolf-expenses-${month}.xlsx"`,
    },
  })
}
