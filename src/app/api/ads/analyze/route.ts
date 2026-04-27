import { openai } from '@/lib/openai/client'
import { NextRequest, NextResponse } from 'next/server'

interface AnalyzePayload {
  account: {
    spend: number
    cpl: number
    leads: number
    frequency: number
    cpm: number
    todaySpend: number
  }
  prior: {
    cpl: number
    cpm: number
    leads: number
  }
  daily: Array<{ date: string; cpl: number; frequency: number; cpm: number; leads: number }>
  ads: Array<{ name: string; cpl: number; spend: number; leads: number }>
  settings: {
    baselineCpl: number
    baselineCpm: number
    creativeStartDate?: string
  }
}

function determineUrgency(
  cpl: number,
  frequency: number,
  baselineCpl: number,
  cpmDelta: number,
  baselineCpm: number
): 'green' | 'yellow' | 'red' {
  if (cpl > baselineCpl * 2 || frequency > 3.5) return 'red'
  if (cpl > baselineCpl * 1.5 || frequency > 2.5 || cpmDelta > 0.4) return 'yellow'
  return 'green'
}

export async function POST(request: NextRequest) {
  const body: AnalyzePayload = await request.json()
  const { account, prior, daily, ads, settings } = body

  const { baselineCpl, baselineCpm, creativeStartDate } = settings

  // Last 7 days trend
  const last7 = daily.slice(-7)
  const prev7 = daily.slice(-14, -7)
  const avg7Cpl = last7.length ? last7.reduce((s, d) => s + d.cpl, 0) / last7.length : account.cpl
  const avgPrev7Cpl = prev7.length ? prev7.reduce((s, d) => s + d.cpl, 0) / prev7.length : prior.cpl
  const cplTrend = avg7Cpl > avgPrev7Cpl * 1.05 ? 'up' : avg7Cpl < avgPrev7Cpl * 0.95 ? 'down' : 'flat'

  const leadsThisWeek = last7.reduce((s, d) => s + d.leads, 0)
  const leadsPrevWeek = prev7.reduce((s, d) => s + d.leads, 0)

  const winningAd = ads[0] // already sorted lowest CPL first
  const cpmDelta = prior.cpm > 0 ? (account.cpm - prior.cpm) / prior.cpm : 0

  const daysRunning = creativeStartDate
    ? Math.floor((Date.now() - new Date(creativeStartDate).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const urgency = determineUrgency(account.cpl, account.frequency, baselineCpl, cpmDelta, baselineCpm)

  const prompt = `You are an AI advertising analyst for a small lawn care business running Facebook ads in a small Indiana town. You have access to the current ad performance data. Your job is to give one clear, specific, actionable recommendation in 2–3 sentences max. Be direct. Tell the user exactly what to do — whether to scale spend, pause an ad, swap a creative, expand the audience radius, or hold steady. Reference specific numbers from the data in your recommendation. Do not be vague. Do not say "consider" or "you might want to." Tell them what to do.

Current data:
- Daily spend: $${account.todaySpend.toFixed(2)}
- CPL: $${account.cpl.toFixed(2)} (baseline: $${baselineCpl}) — trending ${cplTrend} over last 7 days
- Frequency: ${account.frequency.toFixed(2)} (${account.frequency > 3.5 ? 'CRITICAL — above 3.5' : account.frequency > 2.5 ? 'WARNING — above 2.5' : 'healthy'})
- CPM: $${account.cpm.toFixed(2)} (${cpmDelta >= 0 ? '+' : ''}${(cpmDelta * 100).toFixed(1)}% vs prior period, baseline: $${baselineCpm})
- Leads this week: ${leadsThisWeek} (prev week: ${leadsPrevWeek})
- Winning ad: "${winningAd?.name ?? 'N/A'}" at $${winningAd?.cpl.toFixed(2) ?? 'N/A'} CPL with ${winningAd?.leads ?? 0} leads
${daysRunning !== null ? `- Current creative has been running ${daysRunning} days` : ''}
- Total spend this period: $${account.spend.toFixed(2)}`

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    })
    const insight = res.choices[0].message.content?.trim() ?? ''
    return NextResponse.json({ insight, urgency })
  } catch {
    return NextResponse.json({
      insight: `CPL is $${account.cpl.toFixed(2)} against a $${baselineCpl} baseline with frequency at ${account.frequency.toFixed(2)}. Monitor performance closely.`,
      urgency,
    })
  }
}
