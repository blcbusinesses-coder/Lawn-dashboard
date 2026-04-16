import { openai } from './client'

interface InvoiceMessageParams {
  customerName: string
  month: string
  jobCount: number
  total: number
}

export async function generateInvoiceMessage(params: InvoiceMessageParams): Promise<string> {
  const { customerName, month, jobCount, total } = params

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You write professional, friendly, and brief invoice messages for Gray Wolf Workers, a lawn care company.
Keep messages to 2-3 sentences. Be warm but professional. Reference the specific month and service count naturally.`,
      },
      {
        role: 'user',
        content: `Write an invoice message for ${customerName}.
Month: ${month}
Services completed: ${jobCount} lawn mowing${jobCount > 1 ? 's' : ''}
Total due: $${total.toFixed(2)}

Do not include "Dear" or formal salutations. Start directly with the message content.`,
      },
    ],
    max_tokens: 150,
  })

  return response.choices[0]?.message?.content ?? `Thank you for choosing Gray Wolf Workers for your lawn care needs in ${month}. We completed ${jobCount} service${jobCount > 1 ? 's' : ''} this month. We appreciate your continued business!`
}
