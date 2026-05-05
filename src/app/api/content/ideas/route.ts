import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  const { notes } = await request.json()
  if (!notes?.trim()) return NextResponse.json({ error: 'notes required' }, { status: 400 })

  const prompt = `You are a social media strategist for Gray Wolf Workers, a lawn care company in Kendallville, Indiana.

The owner wrote these raw notes:
"""
${notes}
"""

Turn these notes into 4 creative social media post ideas. Each should be punchy, human, and LOCAL — not corporate or AI-sounding.

For each idea:
- "hook": A single scroll-stopping opening sentence (no emojis unless natural — make it human)
- "message": 2–3 sentences that tell the real story, share the value, or connect emotionally
- "cta": One direct call-to-action sentence
- "rating": 1–5 stars for engagement potential (be honest)
- "platform": Best platform ("Facebook", "Instagram", "Instagram Reel", "Nextdoor", "Google Business")
- "best_time": Best day + time to post (e.g. "Tuesday 6–8pm")
- "format": Content format ("Photo post", "Before & After", "Reel", "Carousel", "Text post", "Story")
- "color": One of "yellow", "green", "blue", "pink" (vary them)
- "tip": One short tactical tip for making this post perform better (1 sentence)

Be creative. Mix formats — not all the same. Make the hooks punchy and real.

Return JSON: { "ideas": [ { "hook": "", "message": "", "cta": "", "rating": 4, "platform": "", "best_time": "", "format": "", "color": "", "tip": "" } ] }`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)
  const ideas = Array.isArray(parsed) ? parsed : (parsed.ideas ?? [])

  return NextResponse.json({ ideas })
}
