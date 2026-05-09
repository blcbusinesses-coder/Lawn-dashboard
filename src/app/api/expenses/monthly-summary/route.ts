import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const months = Math.min(parseInt(searchParams.get('months') ?? '6'), 24)
  const supabase = await createAdminClient()

  const result = []

  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i)
    const start = format(startOfMonth(d), 'yyyy-MM-dd')
    const end   = format(endOfMonth(d),   'yyyy-MM-dd')
    const label = format(d, 'MMM yyyy')

    const { data } = await supabase
      .from('expenses')
      .select('category, amount')
      .gte('expense_date', start)
      .lte('expense_date', end)

    const monthly: Record<string, number> = { fuel: 0, equipment: 0, supplies: 0, labor: 0, other: 0 }
    let total = 0
    for (const e of data ?? []) {
      const cat = e.category ?? 'other'
      monthly[cat] = (monthly[cat] ?? 0) + Number(e.amount ?? 0)
      total += Number(e.amount ?? 0)
    }

    result.push({ month: label, ...monthly, total })
  }

  return NextResponse.json(result)
}
