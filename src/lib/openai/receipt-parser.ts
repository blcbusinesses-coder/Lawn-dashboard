import { openai } from './client'

export interface ParsedReceipt {
  merchant: string
  amount: number
  category: 'fuel' | 'equipment' | 'supplies' | 'labor' | 'other'
  date: string
  notes: string
}

export async function parseReceipt(imageUrl: string): Promise<ParsedReceipt> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a receipt parsing assistant for a lawn care business called Gray Wolf Workers.
Extract structured data from the receipt image and return valid JSON with these fields:
- merchant: business name (string)
- amount: total amount paid as a number (no currency symbols)
- category: one of "fuel", "equipment", "supplies", "labor", "other"
- date: date of purchase in YYYY-MM-DD format
- notes: any useful notes about the purchase (string, can be empty)

For category:
- fuel: gas, diesel, oil
- equipment: mowers, tools, parts, repairs
- supplies: fertilizer, bags, string, chemicals
- labor: subcontractor payments
- other: everything else`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl, detail: 'high' },
          },
          {
            type: 'text',
            text: 'Extract the receipt data and return it as JSON.',
          },
        ],
      },
    ],
    max_tokens: 500,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from OpenAI')

  const parsed = JSON.parse(content) as ParsedReceipt
  return parsed
}
