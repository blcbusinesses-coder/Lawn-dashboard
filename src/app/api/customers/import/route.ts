import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface CustomerRow {
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  notes?: string
}

function buildName(row: CustomerRow): string {
  if (row.full_name?.trim()) return row.full_name.trim()
  const parts = [row.first_name?.trim(), row.last_name?.trim()].filter(Boolean)
  return parts.join(' ')
}

function buildAddress(row: CustomerRow): string | null {
  const parts: string[] = []
  if (row.address?.trim()) parts.push(row.address.trim())
  const cityStateZip = [row.city?.trim(), row.state?.trim(), row.zip?.trim()]
    .filter(Boolean)
    .join(', ')
  if (cityStateZip) parts.push(cityStateZip)
  return parts.join(', ') || null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { rows, auto_create_property }: { rows: CustomerRow[]; auto_create_property?: boolean } =
    await request.json()

  if (!rows?.length) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const results = {
    inserted: 0,
    updated: 0,
    properties_created: 0,
    errors: [] as string[],
  }

  for (const row of rows) {
    const full_name = buildName(row)
    if (!full_name) {
      results.errors.push('Skipped row: no name found')
      continue
    }

    const fullAddress = buildAddress(row)
    const customerData = {
      full_name,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      address: fullAddress,
      notes: row.notes?.trim() || null,
    }

    let customerId: string | null = null

    // Upsert on email if present
    if (customerData.email) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customerData.email)
        .single()

      if (existing) {
        await supabase.from('customers').update(customerData).eq('id', existing.id)
        customerId = existing.id
        results.updated++
      }
    }

    if (!customerId) {
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select('id')
        .single()

      if (error) {
        results.errors.push(`${full_name}: ${error.message}`)
        continue
      }
      customerId = data.id
      results.inserted++
    }

    // Auto-create property from address
    if (auto_create_property && customerId && fullAddress && fullAddress !== 'Not sure') {
      // Check if property already exists for this customer+address
      const { data: existingProp } = await supabase
        .from('properties')
        .select('id')
        .eq('customer_id', customerId)
        .eq('address', fullAddress)
        .single()

      if (!existingProp) {
        const { error: propError } = await supabase.from('properties').insert({
          customer_id: customerId,
          address: fullAddress,
          price_per_mow: 0,
        })
        if (!propError) results.properties_created++
      }
    }
  }

  return NextResponse.json(results)
}
