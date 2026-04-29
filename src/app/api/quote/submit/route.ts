/**
 * POST /api/quote/submit
 * Public endpoint — saves self-service quote lead. No SMS sent.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, phone, address, lot_size_sqft, mowable_sqft, base_price, addons, chosen_start_day, selected_addon_keys } = body

  if (!name?.trim() || !phone?.trim() || !address?.trim()) {
    return NextResponse.json({ error: 'name, phone, and address are required' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Calculate total with selected add-ons
  const addonTotal = (addons as Array<{ key: string; price: number }> ?? [])
    .filter((a) => (selected_addon_keys as string[] ?? []).includes(a.key))
    .reduce((sum: number, a: { price: number }) => sum + a.price, 0)

  const quoted_amount = (base_price ?? 0) + addonTotal

  const { data, error } = await admin
    .from('leads')
    .insert({
      name:             name.trim(),
      phone:            phone.trim(),
      address:          address.trim(),
      status:           'new',
      lot_size_sqft:    lot_size_sqft ?? null,
      quoted_amount,
      addons:           addons ?? null,
      chosen_start_day: chosen_start_day ?? null,
      quote_source:     'self_service',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, lead_id: data.id }, { status: 201 })
}
