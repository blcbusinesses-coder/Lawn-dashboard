import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  const { content, targetPlatform } = await request.json()
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const prompt = `You are a social media writer for Gray Wolf Workers, a lawn care company in Kendallville, Indiana.

Repurpose the following content for ${targetPlatform || 'Facebook'}. Keep the Gray Wolf Workers voice: professional, local, straightforward. No emojis unless the original had them. No hashtag spam.

Original content:
"${content}"

Return JSON: { "repurposed": "the rewritten post", "caption": "optional short caption variant", "hashtags": ["relevant", "tags"] }`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0].message.content ?? '{}'
  const result = JSON.parse(raw)
  return NextResponse.json(result)
}
