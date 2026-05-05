import { NextRequest, NextResponse } from 'next/server'
import { generateKlingToken } from '@/lib/kling/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  let token: string
  try {
    token = await generateKlingToken()
  } catch {
    return NextResponse.json({ error: 'Kling not configured' }, { status: 503 })
  }

  const res = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  const data = await res.json()

  if (!res.ok || data.code !== 0) {
    return NextResponse.json({ error: data.message ?? 'Kling API error' }, { status: 500 })
  }

  const taskData = data.data
  const status: string = taskData.task_status // 'submitted' | 'processing' | 'succeed' | 'failed'
  const videoUrl: string | null = taskData.task_result?.videos?.[0]?.url ?? null
  const failReason: string | null = taskData.task_status_msg ?? null

  return NextResponse.json({ status, videoUrl, taskId, failReason })
}
