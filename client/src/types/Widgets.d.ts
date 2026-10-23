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

export interface SystemData {
  cpu: { load: number; temperature: number | null; history: number[] }
  memory: { used: number; total: number; percent: number }
  gpu: {
    name: string
    load: number | null
    temperature: number | null
    memoryPercent: number | null
  } | null
  network: { down: number; up: number }
}

export interface CalendarEvent {
  title: string
  time: string
  allDay: boolean
  location?: string
  color: string
  start: number
  end: number
}

export interface CalendarData {
  days?: { label: string; events: CalendarEvent[] }[]
  error?: string
}

export interface MixerSession {
  id: string
  name: string
  volume: number
  muted: boolean
  active: boolean
  icon: string | null
}

export interface MixerData {
  unsupported?: true
  master?: { volume: number; muted: boolean } | null
  mic?: { muted: boolean } | null
  sessions?: MixerSession[]
}

export type TopicError = { error: string }
