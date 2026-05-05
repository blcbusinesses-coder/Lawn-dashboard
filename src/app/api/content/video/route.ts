import { NextRequest, NextResponse } from 'next/server'
import { generateKlingToken } from '@/lib/kling/client'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { image, imageTail, prompt, duration = '5', aspectRatio = '9:16', mode = 'std' } = body

  if (!image) return NextResponse.json({ error: 'image required' }, { status: 400 })

  let token: string
  try {
    token = await generateKlingToken()
  } catch {
    return NextResponse.json(
      { error: 'Kling not configured. Add KLING_ACCESS_KEY and KLING_SECRET_KEY to your environment.' },
      { status: 503 }
    )
  }

  const klingBody: Record<string, unknown> = {
    model_name: 'kling-v1-5',
    image,
    prompt: prompt || 'Smooth cinematic motion, professional lawn care reveal',
    negative_prompt: 'blurry, low quality, shaky, distorted, watermark',
    cfg_scale: 0.5,
    mode,
    duration,
    aspect_ratio: aspectRatio,
  }

  if (imageTail) {
    klingBody.image_tail = imageTail
  }

  const res = await fetch('https://api.klingai.com/v1/videos/image2video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(klingBody),
  })

  const data = await res.json()

  if (!res.ok || data.code !== 0) {
    return NextResponse.json(
      { error: data.message ?? 'Kling API error' },
      { status: res.status >= 400 ? res.status : 500 }
    )
  }

  return NextResponse.json({ taskId: data.data.task_id })
}
