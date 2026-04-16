import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface PropertyRow {
  address: string
  customer_email?: string
  customer_id?: string
  price_per_mow?: number
  notes?: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { rows }: { rows: PropertyRow[] } = await request.json()

  if (!rows?.length) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const results = { inserted: 0, errors: [] as string[] }

  for (const row of rows) {
    if (!row.address?.trim()) {
      results.errors.push('Skipped row: missing address')
      continue
    }

    let customerId = row.customer_id

    // Resolve customer by email if provided
    if (!customerId && row.customer_email?.trim()) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', row.customer_email.trim())
        .single()

      if (!customer) {
        results.errors.push(`${row.address}: customer not found for email ${row.customer_email}`)
        continue
      }
      customerId = customer.id
    }

    if (!customerId) {
      results.errors.push(`${row.address}: no customer_id or customer_email provided`)
      continue
    }

    const { error } = await supabase.from('properties').insert({
      address: row.address.trim(),
      customer_id: customerId,
      price_per_mow: row.price_per_mow ?? 0,
      notes: row.notes ?? null,
    })

    if (error) {
      results.errors.push(`${row.address}: ${error.message}`)
    } else {
      results.inserted++
    }
  }

  return NextResponse.json(results)
}
