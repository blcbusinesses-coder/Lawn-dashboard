import { createAdminClient } from '@/lib/supabase/server'
import { getTwilioClient, TWILIO_FROM } from '@/lib/twilio/client'
import { generateInvoices } from '@/lib/invoices/generate'
import { startOfISOWeek, format } from 'date-fns'
import type { Json } from '@/types/database'

interface QueryCustomersArgs { search?: string; limit?: number }
interface QueryJobsArgs { start_date: string; end_date: string; property_address?: string }
interface QueryExpensesArgs { start_date?: string; end_date?: string; category?: string }
interface QueryRevenueArgs { start_date: string; end_date: string }
interface QueryPropertiesArgs { search?: string }
interface QueryEmployeeHoursArgs { start_date?: string; end_date?: string; employee_id?: string }

// ── helpers ──────────────────────────────────────────────────────────────────

async function findCustomerByName(supabase: Awaited<ReturnType<typeof createAdminClient>>, name: string) {
  const { data } = await supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .ilike('full_name', `%${name}%`)
    .limit(1)
    .single()
  return data
}

async function findPropertyByAddress(supabase: Awaited<ReturnType<typeof createAdminClient>>, address: string) {
  const { data } = await supabase
    .from('properties')
    .select('id, address')
    .ilike('address', `%${address}%`)
    .limit(1)
    .single()
  return data
}

function currentWeekStart(): string {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function handleAgentTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const supabase = await createAdminClient()

  switch (name) {
    // ── READ TOOLS ────────────────────────────────────────────────────────
    case 'query_customers': {
      const { search, limit = 20 } = args as QueryCustomersArgs
      let q = supabase.from('customers').select('*').limit(limit)
      if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
      const { data } = await q
      return data
    }

    case 'query_jobs': {
      const { start_date, end_date, property_address } = args as unknown as QueryJobsArgs
      let q = supabase
        .from('job_logs')
        .select('*, properties(address, price_per_mow, customers(full_name))')
        .gte('week_start', start_date)
        .lte('week_start', end_date)
      if (property_address) q = q.ilike('properties.address', `%${property_address}%`)
      const { data } = await q
      return data
    }

    case 'query_expenses': {
      const { start_date, end_date, category } = args as QueryExpensesArgs
      let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false })
      if (start_date) q = q.gte('expense_date', start_date)
      if (end_date) q = q.lte('expense_date', end_date)
      if (category) q = q.eq('category', category)
      const { data } = await q
      return data
    }

    case 'query_revenue': {
      const { start_date, end_date } = args as unknown as QueryRevenueArgs
      const { data } = await supabase
        .from('invoices')
        .select('total_amount, period_start, period_end, status, customers(full_name)')
        .gte('period_start', start_date)
        .lte('period_end', end_date)
        .neq('status', 'void')
      return data
    }

    case 'query_properties': {
      const { search } = args as QueryPropertiesArgs
      let q = supabase.from('properties').select('*, customers(full_name, email, phone)').eq('is_active', true)
      if (search) q = q.ilike('address', `%${search}%`)
      const { data } = await q
      return data
    }

    case 'query_employee_hours': {
      const { start_date, end_date, employee_id } = args as QueryEmployeeHoursArgs
      let q = supabase.from('time_logs').select('*, profiles(full_name, hourly_rate)').order('clock_in', { ascending: false })
      if (start_date) q = q.gte('clock_in', `${start_date}T00:00:00`)
      if (end_date) q = q.lte('clock_in', `${end_date}T23:59:59`)
      if (employee_id) q = q.eq('employee_id', employee_id)
      const { data } = await q
      return data
    }

    // ── ACTION TOOLS ──────────────────────────────────────────────────────
    case 'create_customer': {
      const { full_name, email, phone, address, notes } = args as {
        full_name: string; email?: string; phone?: string; address?: string; notes?: string
      }
      const { data, error } = await supabase
        .from('customers')
        .insert({ full_name, email: email || null, phone: phone || null, address: address || null, notes: notes || null })
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, customer: data }
    }

    case 'update_customer': {
      const { id, full_name, email, phone, address, notes } = args as {
        id: string; full_name?: string; email?: string | null; phone?: string | null; address?: string | null; notes?: string | null
      }
      const { data, error } = await supabase
        .from('customers')
        .update({ full_name, email, phone, address, notes })
        .eq('id', id)
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, customer: data }
    }

    case 'create_property': {
      const { customer_name, address, price_per_mow = 0, notes } = args as {
        customer_name: string; address: string; price_per_mow?: number; notes?: string
      }
      const customer = await findCustomerByName(supabase, customer_name)
      if (!customer) return { error: `No customer found matching "${customer_name}"` }

      const { data, error } = await supabase
        .from('properties')
        .insert({ customer_id: customer.id, address, price_per_mow, notes: notes || null })
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, property: data, customer_name: customer.full_name }
    }

    case 'bulk_create_properties': {
      const { customer_name, properties } = args as {
        customer_name: string
        properties: Array<{ address: string; price_per_mow?: number; notes?: string }>
      }
      const customer = await findCustomerByName(supabase, customer_name)
      if (!customer) return { error: `No customer found matching "${customer_name}"` }

      const rows = properties.map((p) => ({
        customer_id: customer.id,
        address: p.address,
        price_per_mow: p.price_per_mow ?? 0,
        notes: p.notes || null,
      }))

      const { data, error } = await supabase.from('properties').insert(rows).select()
      if (error) return { error: error.message }
      return { success: true, created: data?.length ?? 0, customer_name: customer.full_name, properties: data }
    }

    case 'update_property': {
      const { id, address, price_per_mow, notes, is_active } = args as {
        id: string; address?: string; price_per_mow?: number; notes?: string | null; is_active?: boolean
      }
      const { data, error } = await supabase
        .from('properties')
        .update({ address, price_per_mow, notes, is_active })
        .eq('id', id)
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, property: data }
    }

    case 'create_job_log': {
      const { property_address, week_start: rawWeek, status, notes } = args as {
        property_address: string; week_start: string; status: 'done' | 'skipped'; notes?: string
      }
      const property = await findPropertyByAddress(supabase, property_address)
      if (!property) return { error: `No property found matching "${property_address}"` }

      const week_start = rawWeek === 'current' ? currentWeekStart() : rawWeek

      const { data, error } = await supabase
        .from('job_logs')
        .upsert(
          { property_id: property.id, week_start, status, notes: notes || null },
          { onConflict: 'property_id,week_start' }
        )
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, job_log: data, property_address: property.address, week_start }
    }

    case 'create_expense': {
      const { merchant, amount, category = 'general', expense_date, notes } = args as {
        merchant: string; amount: number; category?: string; expense_date: string; notes?: string
      }
      const { data, error } = await supabase
        .from('expenses')
        .insert({ merchant, amount, category, expense_date, notes: notes || null })
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, expense: data }
    }

    case 'send_sms': {
      const { customer_name, body } = args as { customer_name: string; body: string }
      const customer = await findCustomerByName(supabase, customer_name)
      if (!customer) return { error: `No customer found matching "${customer_name}"` }
      if (!customer.phone) return { error: `Customer "${customer.full_name}" has no phone number on file` }

      const twilio = getTwilioClient()
      const message = await twilio.messages.create({ from: TWILIO_FROM, to: customer.phone, body })

      await supabase.from('sms_messages').insert({
        customer_id: customer.id,
        to_phone: customer.phone,
        body,
        twilio_sid: message.sid,
        status: message.status,
      })

      return { success: true, sid: message.sid, to: customer.phone, customer_name: customer.full_name }
    }

    case 'generate_monthly_invoices': {
      const { year, month } = args as { year: number; month: number }
      const result = await generateInvoices(supabase, year, month)
      return result
    }

    case 'create_scheduled_task': {
      const { title, description, trigger_type, trigger_date, action_type, action_params } = args as {
        title: string; description?: string; trigger_type: 'once' | 'monthly' | 'weekly' | 'reminder'
        trigger_date?: string; action_type?: string; action_params?: Record<string, unknown>
      }
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .insert({ title, description: description || null, trigger_type, trigger_date: trigger_date || null, action_type: action_type || null, action_params: (action_params || null) as Json | null })
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, task: data }
    }

    case 'list_scheduled_tasks': {
      const { status = 'pending' } = args as { status?: 'pending' | 'done' | 'cancelled' }
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('status', status)
        .order('trigger_date', { ascending: true, nullsFirst: false })
      if (error) return { error: error.message }
      return data
    }

    case 'update_scheduled_task': {
      const { id, status } = args as { id: string; status: 'done' | 'cancelled' }
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, task: data }
    }

    case 'create_one_off_job': {
      const { title, description, customer_name, amount = 0, scheduled_date, notes } = args as {
        title: string; description?: string; customer_name?: string
        amount?: number; scheduled_date?: string; notes?: string
      }

      let customer_id: string | null = null
      let resolved_customer: string | null = null
      if (customer_name) {
        const customer = await findCustomerByName(supabase, customer_name)
        if (!customer) return { error: `No customer found matching "${customer_name}"` }
        customer_id = customer.id
        resolved_customer = customer.full_name
      }

      const { data, error } = await supabase
        .from('one_off_jobs')
        .insert({
          title,
          description: description || null,
          customer_id,
          amount,
          scheduled_date: scheduled_date || null,
          notes: notes || null,
        })
        .select()
        .single()
      if (error) return { error: error.message }
      return { success: true, job: data, customer_name: resolved_customer }
    }

    case 'list_one_off_jobs': {
      const { status } = args as { status?: 'pending' | 'done' | 'cancelled' }
      let q = supabase
        .from('one_off_jobs')
        .select('*, customers(full_name)')
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) return { error: error.message }
      return data
    }

    case 'complete_one_off_job': {
      const { id, completed_date } = args as { id: string; completed_date?: string }
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('one_off_jobs')
        .update({ status: 'done', completed_date: completed_date || today })
        .eq('id', id)
        .select('*, customers(full_name)')
        .single()
      if (error) return { error: error.message }
      return { success: true, job: data }
    }

    default:
      return { error: `Unknown function: ${name}` }
  }
}
