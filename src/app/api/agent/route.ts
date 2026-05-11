import { anthropic } from '@/lib/anthropic/client'
import { handleAgentTool } from '@/lib/openai/agent-handlers'
import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'

// ── Web search via Tavily ─────────────────────────────────────────────────────
async function tavilySearch(query: string): Promise<string> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:     process.env.TAVILY_API_KEY,
        query,
        max_results: 5,
        search_depth: 'basic',
      }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (!data.results?.length) return 'No results found.'
    return data.results
      .map((r: { title: string; content: string; url: string }) =>
        `**${r.title}**\n${r.content}\n${r.url}`
      )
      .join('\n\n---\n\n')
  } catch {
    return 'Web search unavailable.'
  }
}

// ── Tool definitions ──────────────────────────────────────────────────────────
const CLAUDE_TOOLS: Anthropic.Tool[] = [
  // Read tools
  { name: 'query_customers',           description: 'Fetch customer list with optional name/email filter',          input_schema: { type: 'object' as const, properties: { search: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'query_jobs',                description: 'Get job completion statistics for a date range',               input_schema: { type: 'object' as const, properties: { start_date: { type: 'string' }, end_date: { type: 'string' }, property_address: { type: 'string' } }, required: ['start_date', 'end_date'] } },
  { name: 'query_expenses',            description: 'Fetch expense records filtered by date range or category',     input_schema: { type: 'object' as const, properties: { start_date: { type: 'string' }, end_date: { type: 'string' }, category: { type: 'string' } } } },
  { name: 'query_revenue',             description: 'Get invoice revenue totals for a date range',                  input_schema: { type: 'object' as const, properties: { start_date: { type: 'string' }, end_date: { type: 'string' } }, required: ['start_date', 'end_date'] } },
  { name: 'query_properties',          description: 'List all active properties with pricing and customer info',    input_schema: { type: 'object' as const, properties: { search: { type: 'string' } } } },
  { name: 'query_employee_hours',      description: 'Get employee time log summaries and calculated pay',           input_schema: { type: 'object' as const, properties: { start_date: { type: 'string' }, end_date: { type: 'string' }, employee_id: { type: 'string' } } } },
  // Action tools
  { name: 'create_customer',           description: 'Create a new customer record',                                 input_schema: { type: 'object' as const, properties: { full_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, notes: { type: 'string' } }, required: ['full_name'] } },
  { name: 'update_customer',           description: 'Update fields on an existing customer by their ID',            input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, full_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, notes: { type: 'string' } }, required: ['id'] } },
  { name: 'create_property',           description: 'Create a new property linked to a customer',                   input_schema: { type: 'object' as const, properties: { customer_name: { type: 'string' }, address: { type: 'string' }, price_per_mow: { type: 'number' }, notes: { type: 'string' } }, required: ['customer_name', 'address'] } },
  { name: 'bulk_create_properties',    description: 'Create multiple properties at once for one customer',          input_schema: { type: 'object' as const, properties: { customer_name: { type: 'string' }, properties: { type: 'array', items: { type: 'object', properties: { address: { type: 'string' }, price_per_mow: { type: 'number' } }, required: ['address'] } } }, required: ['customer_name', 'properties'] } },
  { name: 'update_property',           description: 'Update a property record by ID',                               input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, address: { type: 'string' }, price_per_mow: { type: 'number' }, notes: { type: 'string' }, is_active: { type: 'boolean' } }, required: ['id'] } },
  { name: 'create_job_log',            description: 'Log a job as done or skipped for a property and week',         input_schema: { type: 'object' as const, properties: { property_address: { type: 'string' }, week_start: { type: 'string' }, status: { type: 'string', enum: ['done', 'skipped'] }, notes: { type: 'string' } }, required: ['property_address', 'week_start', 'status'] } },
  { name: 'create_expense',            description: 'Create a new expense record',                                  input_schema: { type: 'object' as const, properties: { merchant: { type: 'string' }, amount: { type: 'number' }, category: { type: 'string' }, expense_date: { type: 'string' }, notes: { type: 'string' } }, required: ['merchant', 'amount', 'expense_date'] } },
  { name: 'send_sms',                  description: 'Send an SMS text message to a customer by name',               input_schema: { type: 'object' as const, properties: { customer_name: { type: 'string' }, body: { type: 'string' } }, required: ['customer_name', 'body'] } },
  { name: 'generate_monthly_invoices', description: 'Generate draft invoices for all customers for a given month',  input_schema: { type: 'object' as const, properties: { year: { type: 'number' }, month: { type: 'number' } }, required: ['year', 'month'] } },
  { name: 'create_scheduled_task',     description: 'Create a scheduled task or reminder',                          input_schema: { type: 'object' as const, properties: { title: { type: 'string' }, description: { type: 'string' }, trigger_type: { type: 'string' }, trigger_date: { type: 'string' } }, required: ['title', 'trigger_type'] } },
  { name: 'list_scheduled_tasks',      description: 'List scheduled tasks filtered by status',                      input_schema: { type: 'object' as const, properties: { status: { type: 'string' } } } },
  { name: 'update_scheduled_task',     description: 'Update or complete a scheduled task',                          input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, status: { type: 'string' }, trigger_date: { type: 'string' } }, required: ['id'] } },
  { name: 'list_one_off_jobs',         description: 'List one-off/ad-hoc jobs with optional status filter',         input_schema: { type: 'object' as const, properties: { status: { type: 'string' } } } },
  { name: 'create_one_off_job',        description: 'Create a one-off job (mulching, cleanup, etc.)',               input_schema: { type: 'object' as const, properties: { customer_name: { type: 'string' }, description: { type: 'string' }, amount: { type: 'number' }, scheduled_date: { type: 'string' } }, required: ['customer_name', 'description'] } },
  { name: 'complete_one_off_job',      description: 'Mark a one-off job as completed',                              input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, completed_date: { type: 'string' } }, required: ['id'] } },

  // ── Visual tools ─────────────────────────────────────────────────────────────
  {
    name: 'render_chart',
    description: 'Render an inline chart in the UI. Use when showing trends, comparisons, or time-series data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:     { type: 'string',  description: 'Chart title' },
        chartType: { type: 'string',  enum: ['bar', 'line', 'area'], description: 'Type of chart' },
        xKey:      { type: 'string',  description: 'Key to use for the x-axis (e.g. "month")' },
        yKeys:     { type: 'array',   items: { type: 'string' }, description: 'Keys to plot on y-axis (e.g. ["revenue", "expenses"])' },
        colors:    { type: 'array',   items: { type: 'string' }, description: 'Optional hex colors for each yKey' },
        data:      { type: 'array',   items: { type: 'object' }, description: 'Array of data objects, each with xKey and yKey properties' },
      },
      required: ['title', 'chartType', 'xKey', 'yKeys', 'data'],
    },
  },
  {
    name: 'render_table',
    description: 'Render an interactive sortable/filterable table in the UI. Use for lists of customers, jobs, expenses, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:   { type: 'string', description: 'Table title' },
        columns: { type: 'array',  items: { type: 'string' }, description: 'Column header names' },
        rows:    { type: 'array',  items: { type: 'array', items: { type: 'string' } }, description: 'Array of row arrays, each matching column order' },
      },
      required: ['title', 'columns', 'rows'],
    },
  },
  {
    name: 'render_map',
    description: 'Render an interactive map with location pins. Use when showing customer or property locations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:     { type: 'string', description: 'Map title' },
        locations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name:        { type: 'string' },
              address:     { type: 'string' },
              lat:         { type: 'number' },
              lng:         { type: 'number' },
              description: { type: 'string' },
            },
            required: ['name', 'lat', 'lng'],
          },
        },
      },
      required: ['title', 'locations'],
    },
  },

  // ── Web search ────────────────────────────────────────────────────────────────
  {
    name: 'web_search',
    description: 'Search the web for current information. Use for competitor prices, weather, local events, lawn care industry info, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
]

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(isProactive = false): string {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  if (isProactive) {
    return `You are Wolf, the AI business agent for Gray Wolf Workers. Today is ${today}.
Run your daily business health check. Use your tools to:
1. Check for any overdue invoices
2. Check if any properties haven't been mowed in over 2 weeks
3. Review this week's scheduled jobs
4. Check for any new leads that haven't been followed up
5. Look at expenses vs revenue this month
Produce a concise morning briefing with: what's urgent, what's looking good, and 1-2 recommended actions for today. Be specific with names and numbers.`
  }
  return `You are Wolf, the AI business agent for Gray Wolf Workers — a professional lawn care company. Today is ${today}.

You have full access to business data and can take real actions. You can also render rich visuals inline.

VISUAL TOOLS — use these proactively:
- render_chart: when showing any trend, comparison, or time series (revenue over months, expenses by category, etc.)
- render_table: when listing multiple records (customers, jobs, expenses) — prefer this over markdown tables
- render_map: when discussing property or customer locations
- web_search: for competitor research, weather, local market info, anything current

RESPONSE STYLE:
- Be direct and confident. You know this business.
- Use visuals generously — charts and tables beat walls of text
- **Bold** key numbers and names
- Flag anything unusual proactively
- Suggest next actions when relevant`
}

// ── Visual tool handler ───────────────────────────────────────────────────────
function handleVisualTool(name: string, input: Record<string, unknown>): string {
  // Returns a sentinel that the UI will parse
  return `RENDERED:${name}`
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { messages, isProactive } = body as { messages: { role: string; content: string }[]; isProactive?: boolean }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicMessages: Anthropic.MessageParam[] = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

        const toolResults: Anthropic.MessageParam[] = []
        let iterations = 0

        while (iterations < 12) {
          iterations++

          const response = await anthropic.messages.create({
            model:      'claude-sonnet-4-5',
            max_tokens: 4096,
            system:     buildSystemPrompt(isProactive),
            tools:      CLAUDE_TOOLS,
            messages:   [...anthropicMessages, ...toolResults],
          })

          const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
          const textBlocks    = response.content.filter(b => b.type === 'text')     as Anthropic.TextBlock[]

          if (response.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
            const toolResultContents: Anthropic.ToolResultBlockParam[] = []

            for (const toolUse of toolUseBlocks) {
              const inp = toolUse.input as Record<string, unknown>
              const isVisual = ['render_chart', 'render_table', 'render_map'].includes(toolUse.name)

              // Emit tool call event for UI
              controller.enqueue(encoder.encode(
                `\x00TOOL:${JSON.stringify({ type: 'tool_call', tool: toolUse.name, input: inp })}\x00`
              ))

              let result: string
              if (isVisual) {
                // Emit visual event for UI to render
                controller.enqueue(encoder.encode(
                  `\x00VISUAL:${JSON.stringify({ type: toolUse.name.replace('render_', ''), ...inp })}\x00`
                ))
                result = `Visual rendered: ${toolUse.name}`
              } else if (toolUse.name === 'web_search') {
                result = await tavilySearch(inp.query as string)
              } else {
                try {
                  result = JSON.stringify(await handleAgentTool(toolUse.name, inp))
                } catch (err) {
                  result = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
                }
              }

              toolResultContents.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
            }

            toolResults.push({ role: 'assistant', content: response.content })
            toolResults.push({ role: 'user',      content: toolResultContents })
            continue
          }

          controller.enqueue(encoder.encode(textBlocks.map(b => b.text).join('')))
          break
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`**Error:** ${err instanceof Error ? err.message : 'Unknown error'}`))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
