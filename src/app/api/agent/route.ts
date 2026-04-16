import { openai } from '@/lib/openai/client'
import { agentTools } from '@/lib/openai/agent-functions'
import { handleAgentTool } from '@/lib/openai/agent-handlers'
import { NextRequest, NextResponse } from 'next/server'
import type OpenAI from 'openai'

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return `You are a full-capability business assistant for Gray Wolf Workers, a professional lawn care company.
Today's date is ${today}.

You have access to real-time data AND can take actions in the app through your tools. You can:

QUERIES (read data):
- Look up customers, properties, job history, expenses, revenue, employee hours

ACTIONS (write data):
- create_customer / update_customer — add or edit customers
- create_property / bulk_create_properties / update_property — add or edit lawn properties
- create_job_log — mark a job done or skipped for any property/week
- create_expense — log an expense
- send_sms — text a customer by name
- generate_monthly_invoices — generate draft invoices for a month
- create_one_off_job / list_one_off_jobs / complete_one_off_job — manage ad-hoc services like mulching, stick cleanup, leaf removal
- create_scheduled_task / list_scheduled_tasks / update_scheduled_task — manage reminders and tasks

When the user uploads an image (e.g. a list of addresses), extract all visible addresses and use the appropriate tool to create the records they ask for.

Guidelines:
- Always confirm what you created/updated by summarizing the result
- Use fuzzy customer name matching (partial names work fine)
- For week_start you can use "current" to mean this week
- Format money as $X.XX
- If an action fails, explain why and suggest a fix`
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: buildSystemPrompt() },
          ...messages,
        ]

        // Agentic loop
        while (true) {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: openaiMessages,
            tools: agentTools,
            tool_choice: 'auto',
            stream: false,
          })

          const choice = response.choices[0]
          const message = choice.message

          openaiMessages.push(message)

          if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
            for (const toolCall of message.tool_calls) {
              if (!('function' in toolCall)) continue
              const args = JSON.parse(toolCall.function.arguments || '{}')
              const result = await handleAgentTool(toolCall.function.name, args)

              openaiMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              })
            }
            continue
          }

          const content = message.content ?? ''
          controller.enqueue(encoder.encode(content))
          break
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`Error: ${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
