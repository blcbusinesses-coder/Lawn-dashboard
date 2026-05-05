import { NextResponse } from 'next/server'

const LAT = 41.4456
const LON = -85.2650

export async function GET() {
  const key = process.env.OPENWEATHER_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'not_configured' })
  }

  const [currentRes, forecastRes] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${key}&units=imperial`),
    fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&appid=${key}&units=imperial&cnt=40`),
  ])

  if (!currentRes.ok) return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 502 })

  const current = await currentRes.json()
  const forecast = forecastRes.ok ? await forecastRes.json() : null

  // Collapse 3hr forecast into daily (noon reading per day)
  const dailyMap = new Map<string, { high: number; low: number; icon: string; desc: string; date: string; pop: number }>()
  for (const item of forecast?.list ?? []) {
    const date = item.dt_txt.split(' ')[0]
    const existing = dailyMap.get(date)
    const temp = item.main.temp
    const pop = item.pop ?? 0
    if (!existing) {
      dailyMap.set(date, { high: temp, low: temp, icon: item.weather[0].icon, desc: item.weather[0].description, date, pop })
    } else {
      existing.high = Math.max(existing.high, temp)
      existing.low = Math.min(existing.low, temp)
      existing.pop = Math.max(existing.pop, pop)
      if (item.dt_txt.includes('12:00:00')) {
        existing.icon = item.weather[0].icon
        existing.desc = item.weather[0].description
      }
    }
  }

  const daily = Array.from(dailyMap.values()).slice(0, 7)

  return NextResponse.json({
    current: {
      temp: Math.round(current.main.temp),
      feels_like: Math.round(current.main.feels_like),
      humidity: current.main.humidity,
      wind_speed: Math.round(current.wind.speed),
      desc: current.weather[0].description,
      icon: current.weather[0].icon,
      visibility: Math.round((current.visibility ?? 10000) / 1609), // meters to miles
    },
    daily,
  })
}
