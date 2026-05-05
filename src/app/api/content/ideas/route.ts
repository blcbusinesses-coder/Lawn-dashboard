import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  const { topic, platform } = await request.json()

  const prompt = `You are a social media strategist for Gray Wolf Workers, a lawn care company in Kendallville, Indiana.

Generate 5 content ideas for ${platform || 'Facebook/Instagram'} ${topic ? `about: ${topic}` : 'to attract local customers and showcase lawn work'}.

For each idea include:
- A punchy title (no emojis)
- A 1-2 sentence description of the post
- Best time to post (day/time)
- Content type (photo, reel, story, text)

Format as JSON array: [{ "title": "", "description": "", "best_time": "", "type": "" }]`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)
  const ideas = Array.isArray(parsed) ? parsed : (parsed.ideas ?? parsed.content_ideas ?? [])

  return NextResponse.json({ ideas })
}
