import axios from 'axios'

import { getStorageValue } from '../storage.js'
import { publish, TopicProvider } from '../topics.js'
import { log, LogLevel } from '../utils.js'

import { WeatherLocation } from '../../types/Config.js'

export interface WeatherData {
  location: string
  units: 'metric' | 'imperial'
  current: {
    temperature: number
    feelsLike: number
    code: number
    isDay: boolean
    wind: number
    humidity: number
  }
  today: { min: number; max: number; precipitationChance: number }
  hourly: { time: string; temperature: number; code: number; isDay: boolean }[]
  daily: { date: string; min: number; max: number; code: number }[]
  updatedAt: number
}

const REFRESH_MS = 15 * 60 * 1000

let latest: WeatherData | { error: string } | null = null
let timer: NodeJS.Timeout | null = null

export function getWeatherLocation(): WeatherLocation | null {
  const loc = getStorageValue('weatherLocation') as WeatherLocation | null
  if (!loc || typeof loc.latitude !== 'number') return null
  return loc
}

export async function geocode(query: string): Promise<WeatherLocation[]> {
  const res = await axios.get(
    'https://geocoding-api.open-meteo.com/v1/search',
    { params: { name: query, count: 6, format: 'json' }, timeout: 8000 }
  )
  const results = (res.data?.results ?? []) as {
    name: string
    admin1?: string
    country?: string
    latitude: number
    longitude: number
  }[]
  return results.map(r => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    latitude: r.latitude,
    longitude: r.longitude
  }))
}

async function fetchWeather(): Promise<WeatherData | { error: string }> {
  const location = getWeatherLocation()
  if (!location)
    return { error: 'Set a weather location in the desktop app' }

  const units =
    (getStorageValue('weatherUnits') as 'metric' | 'imperial') ?? 'metric'

  const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
    timeout: 10000,
    params: {
      latitude: location.latitude,
      longitude: location.longitude,
      current:
        'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m',
      hourly: 'temperature_2m,weather_code,is_day',
      daily:
        'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
      forecast_days: 5,
      timezone: 'auto',
      temperature_unit: units === 'imperial' ? 'fahrenheit' : 'celsius',
      wind_speed_unit: units === 'imperial' ? 'mph' : 'kmh'
    }
  })

  const d = res.data
  const nowIso: string = d.current.time
  const startIdx = Math.max(
    0,
    (d.hourly.time as string[]).findIndex(t => t >= nowIso)
  )

  const hourly = (d.hourly.time as string[])
    .slice(startIdx + 1, startIdx + 7)
    .map((time, i) => ({
      time,
      temperature: Math.round(d.hourly.temperature_2m[startIdx + 1 + i]),
      code: d.hourly.weather_code[startIdx + 1 + i],
      isDay: d.hourly.is_day[startIdx + 1 + i] === 1
    }))

  const daily = (d.daily.time as string[]).slice(1, 5).map((date, i) => ({
    date,
    min: Math.round(d.daily.temperature_2m_min[i + 1]),
    max: Math.round(d.daily.temperature_2m_max[i + 1]),
    code: d.daily.weather_code[i + 1]
  }))

  return {
    location: location.name.split(',')[0],
    units,
    current: {
      temperature: Math.round(d.current.temperature_2m),
      feelsLike: Math.round(d.current.apparent_temperature),
      code: d.current.weather_code,
      isDay: d.current.is_day === 1,
      wind: Math.round(d.current.wind_speed_10m),
      humidity: Math.round(d.current.relative_humidity_2m)
    },
    today: {
      min: Math.round(d.daily.temperature_2m_min[0]),
      max: Math.round(d.daily.temperature_2m_max[0]),
      precipitationChance: d.daily.precipitation_probability_max[0] ?? 0
    },
    hourly,
    daily,
    updatedAt: Date.now()
  }
}

async function update() {
  try {
    latest = await fetchWeather()
  } catch (err) {
    log(`Failed to fetch weather: ${err}`, 'Weather', LogLevel.WARN)
    // keep showing stale data if we have some
    if (!latest || 'error' in latest) latest = { error: 'Weather unavailable' }
  }
  publish('weather', latest)
}

export const weatherProvider: TopicProvider = {
  topic: 'weather',
  start() {
    const stale =
      !latest || 'error' in latest || Date.now() - latest.updatedAt > REFRESH_MS
    if (stale) update()
    timer = setInterval(update, REFRESH_MS)
  },
  stop() {
    if (timer) clearInterval(timer)
    timer = null
  },
  latest: () => latest
}

/** Called when the location or units change */
export function invalidateWeather() {
  latest = null
  if (timer) update()
}
