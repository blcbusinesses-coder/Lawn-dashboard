import { anthropic } from '@/lib/anthropic/client'
import { handleAgentTool } from '@/lib/openai/agent-handlers'
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'

// ── Tool definitions for Claude ───────────────────────────────────────────────
const CLAUDE_TOOLS: Anthropic.Tool[] = [
  { name: 'query_customers',          description: 'Fetch customer list with optional name/email filter',          input_schema: { type: 'object' as const, properties: { search: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'query_jobs',               description: 'Get job completion statistics for a date range',               input_schema: { type: 'object' as const, properties: { start_date: { type: 'string' }, end_date: { type: 'string' }, property_address: { type: 'string' } }, required: ['start_date', 'end_date'] } },
  { name: 'query_expenses',           description: 'Fetch expense records filtered by date range or category',     input_schema: { type: 'object' as const, properties: { start_date: { type: 'string' }, end_date: { type: 'string' }, category: { type: 'string' } } } },
  { name: 'query_revenue',            description: 'Get invoice revenue totals for a date range',                  input_schema: { type: 'object' as const, properties: { start_date: { type: 'string' }, end_date: { type: 'string' } }, required: ['start_date', 'end_date'] } },
  { name: 'query_properties',         description: 'List all active properties with pricing and customer info',    input_schema: { type: 'object' as const, properties: { search: { type: 'string' } } } },
  { name: 'query_employee_hours',     description: 'Get employee time log summaries and calculated pay',           input_schema: { type: 'object' as const, properties: { start_date: { type: 'string' }, end_date: { type: 'string' }, employee_id: { type: 'string' } } } },
  { name: 'create_customer',          description: 'Create a new customer record',                                 input_schema: { type: 'object' as const, properties: { full_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, notes: { type: 'string' } }, required: ['full_name'] } },
  { name: 'update_customer',          description: 'Update fields on an existing customer by their ID',            input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, full_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, notes: { type: 'string' } }, required: ['id'] } },
  { name: 'create_property',          description: 'Create a new property linked to a customer',                   input_schema: { type: 'object' as const, properties: { customer_name: { type: 'string' }, address: { type: 'string' }, price_per_mow: { type: 'number' }, notes: { type: 'string' } }, required: ['customer_name', 'address'] } },
  { name: 'bulk_create_properties',   description: 'Create multiple properties at once for one customer',          input_schema: { type: 'object' as const, properties: { customer_name: { type: 'string' }, properties: { type: 'array', items: { type: 'object', properties: { address: { type: 'string' }, price_per_mow: { type: 'number' }, notes: { type: 'string' } }, required: ['address'] } } }, required: ['customer_name', 'properties'] } },
  { name: 'update_property',          description: 'Update a property record by ID',                               input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, address: { type: 'string' }, price_per_mow: { type: 'number' }, notes: { type: 'string' }, is_active: { type: 'boolean' } }, required: ['id'] } },
  { name: 'create_job_log',           description: 'Log a job as done or skipped for a property and week',        input_schema: { type: 'object' as const, properties: { property_address: { type: 'string' }, week_start: { type: 'string' }, status: { type: 'string', enum: ['done', 'skipped'] }, notes: { type: 'string' } }, required: ['property_address', 'week_start', 'status'] } },
  { name: 'create_expense',           description: 'Create a new expense record',                                  input_schema: { type: 'object' as const, properties: { merchant: { type: 'string' }, amount: { type: 'number' }, category: { type: 'string' }, expense_date: { type: 'string' }, notes: { type: 'string' } }, required: ['merchant', 'amount', 'expense_date'] } },
  { name: 'send_sms',                 description: 'Send an SMS text message to a customer by name',              input_schema: { type: 'object' as const, properties: { customer_name: { type: 'string' }, body: { type: 'string' } }, required: ['customer_name', 'body'] } },
  { name: 'generate_monthly_invoices',description: 'Generate draft invoices for all customers for a given month', input_schema: { type: 'object' as const, properties: { year: { type: 'number' }, month: { type: 'number' } }, required: ['year', 'month'] } },
  { name: 'create_scheduled_task',    description: 'Create a scheduled task or reminder',                          input_schema: { type: 'object' as const, properties: { title: { type: 'string' }, description: { type: 'string' }, trigger_type: { type: 'string' }, trigger_date: { type: 'string' }, action_type: { type: 'string' }, action_params: { type: 'object' } }, required: ['title', 'trigger_type'] } },
  { name: 'list_scheduled_tasks',     description: 'List scheduled tasks filtered by status',                      input_schema: { type: 'object' as const, properties: { status: { type: 'string' } } } },
  { name: 'update_scheduled_task',    description: 'Update or complete a scheduled task',                          input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' }, trigger_date: { type: 'string' } }, required: ['id'] } },
  { name: 'list_one_off_jobs',        description: 'List one-off/ad-hoc jobs with optional status filter',         input_schema: { type: 'object' as const, properties: { status: { type: 'string' } } } },
  { name: 'create_one_off_job',       description: 'Create a one-off job (mulching, cleanup, etc.)',               input_schema: { type: 'object' as const, properties: { customer_name: { type: 'string' }, description: { type: 'string' }, amount: { type: 'number' }, scheduled_date: { type: 'string' } }, required: ['customer_name', 'description'] } },
  { name: 'complete_one_off_job',     description: 'Mark a one-off job as completed',                              input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, completed_date: { type: 'string' } }, required: ['id'] } },
]

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return `You are Wolf, the AI business agent for Gray Wolf Workers — a professional lawn care company. Today is ${today}.

You have full access to business data and can take real actions through your tools. You are not just answering questions — you are actively managing and growing this business.

CAPABILITIES:
- Query live data: customers, properties, jobs, expenses, revenue, employee hours
- Take actions: create/update customers, properties, jobs, expenses, send SMS, generate invoices, manage tasks
- Analyze trends, spot problems, and give proactive business advice

RESPONSE STYLE:
- Be direct and confident. You know this business deeply.
- Use **bold** for names, numbers, and key metrics
- Use tables for comparisons and multi-row data
- Use bullet lists for multiple items
- When showing financial data, always include totals
- Flag anything unusual (e.g. a customer with no recent jobs, high expenses in a category)
- If asked for a chart or visual, describe what it would show clearly in your response

PROACTIVE INTELLIGENCE:
- If you notice something important while answering (e.g. unpaid invoices, missed jobs), mention it
- Suggest next actions when relevant
- Think like a COO who also handles operations, not just a data lookup tool

You have access to the full business: every customer, every job, every dollar.`
}

// Convert OpenAI-style messages to Anthropic format
function toAnthropicMessages(messages: { role: string; content: string }[]): Anthropic.MessageParam[] {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { messages } = body as { messages: { role: string; content: string }[] }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicMessages = toAnthropicMessages(messages)
        const toolResults: Anthropic.MessageParam[] = []

        // Agentic loop
        let loopMessages = [...anthropicMessages]
        let iterations   = 0

        while (iterations < 10) {
          iterations++
          const response = await anthropic.messages.create({
            model:      'claude-sonnet-4-5',
            max_tokens: 4096,
            system:     buildSystemPrompt(),
            tools:      CLAUDE_TOOLS,
            messages:   [...loopMessages, ...toolResults],
          })

          // Check if we need tool calls
          const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
          const textBlocks    = response.content.filter(b => b.type === 'text')     as Anthropic.TextBlock[]

          if (response.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
            // Execute all tool calls
            const toolResultContents: Anthropic.ToolResultBlockParam[] = []

            for (const toolUse of toolUseBlocks) {
              // Stream a "thinking" event so the UI can show it
              const thinkingEvent = JSON.stringify({
                type: 'tool_call',
                tool: toolUse.name,
                input: toolUse.input,
              })
              controller.enqueue(encoder.encode(`\x00TOOL:${thinkingEvent}\x00`))

              try {
                const result = await handleAgentTool(toolUse.name, toolUse.input as Record<string, unknown>)
                toolResultContents.push({
                  type:        'tool_result',
                  tool_use_id: toolUse.id,
                  content:     JSON.stringify(result),
                })
              } catch (err) {
                toolResultContents.push({
                  type:        'tool_result',
                  tool_use_id: toolUse.id,
                  content:     `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
                  is_error:    true,
                })
              }
            }

            // Add assistant turn + tool results to loop
            toolResults.push({ role: 'assistant', content: response.content })
            toolResults.push({ role: 'user',      content: toolResultContents })
            continue
          }

          // Final text response — stream it
          const text = textBlocks.map(b => b.text).join('')
          controller.enqueue(encoder.encode(text))
          break
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`**Error:** ${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
