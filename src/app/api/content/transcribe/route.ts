import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtu\.be\/([^?\s]+)/,
    /youtube\.com\/shorts\/([^?\s]+)/,
    /youtube\.com\/embed\/([^?\s]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    })
    const html = await pageRes.text()

    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var\s+|<\/script>)/)
    if (!match) return null

    const playerResponse = JSON.parse(match[1])
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (!captionTracks?.length) return null

    const track = captionTracks.find((t: { languageCode: string }) => t.languageCode === 'en') ?? captionTracks[0]
    const captionUrl = `${track.baseUrl}&fmt=json3`

    const captionRes = await fetch(captionUrl, { signal: AbortSignal.timeout(8000) })
    const captionData = await captionRes.json()

    const text = (captionData.events ?? [])
      .filter((e: { segs?: unknown[] }) => e.segs)
      .flatMap((e: { segs: Array<{ utf8: string }> }) => e.segs.map((s) => s.utf8))
      .join(' ')
      .replace(/\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    return text || null
  } catch {
    return null
  }
}

async function extractPageContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrayWolfBot/1.0)' },
    signal: AbortSignal.timeout(10000),
  })
  const html = await res.text()

  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)
}

export async function POST(request: NextRequest) {
  const { url } = await request.json()
  if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 })

  let sourceText = ''
  let sourceType = 'webpage'

  const ytId = extractYouTubeId(url)
  if (ytId) {
    sourceType = 'youtube'
    const transcript = await getYouTubeTranscript(ytId)
    if (transcript) {
      sourceText = transcript
    } else {
      try { sourceText = await extractPageContent(url) } catch { /* ignore */ }
    }
  } else {
    try {
      sourceText = await extractPageContent(url)
    } catch {
      return NextResponse.json({ error: 'Could not fetch content from that URL. Make sure it\'s a public page.' }, { status: 422 })
    }
  }

  if (!sourceText.trim()) {
    return NextResponse.json({ error: 'No readable text found at that URL.' }, { status: 422 })
  }

  const prompt = `You are a social media content writer for Gray Wolf Workers, a lawn care company in Kendallville, Indiana.

Here is content from ${sourceType === 'youtube' ? 'a YouTube video transcript' : 'a webpage'}:
---
${sourceText.slice(0, 3500)}
---

Rewrite this content for Gray Wolf Workers. Adapt the core idea, story, or value to lawn care, lawn maintenance, or outdoor property services. Keep it real and local — not corporate. Don't start with "Are you..." or generic openers.

Return JSON:
{
  "facebook": "Full Facebook post (150–250 words, conversational, local feel, no hashtags)",
  "instagram": "Instagram caption (punchy, 3–4 sentences + line break + 5–7 relevant hashtags starting with #)",
  "hook": "One scroll-stopping first sentence",
  "summary": "2-sentence plain-English summary of what the original content was about",
  "topic": "2–3 word topic label"
}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(res.choices[0].message.content ?? '{}')
  return NextResponse.json({ ...result, sourceType })
}
