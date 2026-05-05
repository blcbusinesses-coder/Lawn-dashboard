'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { RefreshCw, Wind, Droplets, Eye, Thermometer } from 'lucide-react'

interface CurrentWeather {
  temp: number
  feels_like: number
  humidity: number
  wind_speed: number
  desc: string
  icon: string
  visibility: number
}

interface DayWeather {
  date: string
  high: number
  low: number
  icon: string
  desc: string
  pop: number
}

interface WeatherData {
  current: CurrentWeather
  daily: DayWeather[]
}

function iconUrl(code: string) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function WeatherPage() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function load(refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/weather')
      const data = await res.json()
      if (data.error === 'not_configured') {
        setError('OpenWeatherMap API key not configured. Add OPENWEATHER_API_KEY to your environment variables.')
      } else if (data.error) {
        setError(data.error)
      } else {
        setWeather(data)
      }
    } catch {
      setError('Failed to load weather')
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const mowingRisk = (day: DayWeather) => {
    if (day.pop >= 0.6) return { label: 'High rain chance', color: 'text-red-500', bg: 'bg-red-50' }
    if (day.pop >= 0.3) return { label: 'Some rain risk', color: 'text-orange-500', bg: 'bg-orange-50' }
    if (day.high >= 95) return { label: 'Heat advisory', color: 'text-orange-500', bg: 'bg-orange-50' }
    return { label: 'Good mowing day', color: 'text-green-600', bg: 'bg-green-50' }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Weather</h1>
          <p className="text-sm text-zinc-500 mt-1">Kendallville, IN — local forecast for scheduling</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={14} className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">{error}</div>
      )}

      {!loading && weather && (
        <div className="space-y-5">
          {/* Current conditions */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Current Conditions</h2>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconUrl(weather.current.icon)} alt={weather.current.desc} className="w-16 h-16" />
                <div>
                  <p className="text-5xl font-bold text-zinc-900">{weather.current.temp}°</p>
                  <p className="text-sm text-zinc-500 capitalize mt-0.5">{weather.current.desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm ml-auto">
                <div className="flex items-center gap-2 text-zinc-600">
                  <Thermometer size={14} className="text-zinc-400" />
                  <span>Feels like <strong className="text-zinc-800">{weather.current.feels_like}°</strong></span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600">
                  <Wind size={14} className="text-zinc-400" />
                  <span>Wind <strong className="text-zinc-800">{weather.current.wind_speed} mph</strong></span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600">
                  <Droplets size={14} className="text-zinc-400" />
                  <span>Humidity <strong className="text-zinc-800">{weather.current.humidity}%</strong></span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600">
                  <Eye size={14} className="text-zinc-400" />
                  <span>Visibility <strong className="text-zinc-800">{weather.current.visibility} mi</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* 7-day forecast */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-base font-semibold text-zinc-800">7-Day Forecast</h2>
            </div>
            <div className="divide-y divide-zinc-50">
              {weather.daily.map((day) => {
                const risk = mowingRisk(day)
                return (
                  <div key={day.date} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors">
                    <div className="w-28 shrink-0">
                      <p className="text-sm font-semibold text-zinc-800">{dayLabel(day.date)}</p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={iconUrl(day.icon)} alt={day.desc} className="w-10 h-10 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-600 capitalize truncate">{day.desc}</p>
                      {day.pop > 0 && (
                        <p className="text-xs text-blue-500 mt-0.5">{Math.round(day.pop * 100)}% rain</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm shrink-0">
                      <span className="font-semibold text-zinc-900">{Math.round(day.high)}°</span>
                      <span className="text-zinc-400">/</span>
                      <span className="text-zinc-500">{Math.round(day.low)}°</span>
                    </div>
                    <div className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${risk.color} ${risk.bg}`}>
                      {risk.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-zinc-400 text-center">Data from OpenWeatherMap · Updates on page load</p>
        </div>
      )}
    </div>
  )
}
