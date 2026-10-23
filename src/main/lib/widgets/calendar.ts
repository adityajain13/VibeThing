import axios from 'axios'
import moment from 'moment'
import ical, { VEvent } from 'node-ical'

import { getStorageValue } from '../storage.js'
import { publish, TopicProvider } from '../topics.js'
import { log, LogLevel } from '../utils.js'

export interface CalendarSource {
  url: string
  name?: string
  color?: string
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

export interface CalendarDay {
  label: string
  events: CalendarEvent[]
}

export type CalendarData = { days: CalendarDay[] } | { error: string }

const REFRESH_MS = 10 * 60 * 1000
const LOOKAHEAD_DAYS = 7
const DEFAULT_COLORS = ['#4f8cff', '#ff7a59', '#2ec27e', '#c061cb', '#f5c211']

let latest: CalendarData | null = null
let timer: NodeJS.Timeout | null = null
let rawEvents: CalendarEvent[] = []

export function getCalendarSources(): CalendarSource[] {
  const stored = getStorageValue('calendars')
  if (!Array.isArray(stored)) return []
  return (stored as CalendarSource[]).filter(c => c && c.url)
}

function text(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'val' in (value as object))
    return String((value as { val: unknown }).val)
  return String(value)
}

async function fetchSource(
  source: CalendarSource,
  color: string,
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  const url = source.url.trim().replace(/^webcal:\/\//i, 'https://')
  const res = await axios.get(url, { timeout: 15000, responseType: 'text' })
  const parsed = ical.parseICS(res.data as string)
  const events: CalendarEvent[] = []

  for (const item of Object.values(parsed)) {
    if (!item || item.type !== 'VEVENT') continue
    const event = item as VEvent
    if (event.status === 'CANCELLED') continue

    const instances = event.rrule
      ? ical.expandRecurringEvent(event, { from, to, expandOngoing: true })
      : [
          {
            start: event.start,
            end: event.end ?? event.start,
            summary: event.summary,
            isFullDay: event.datetype === 'date',
            event
          }
        ]

    for (const inst of instances) {
      const start = new Date(inst.start).getTime()
      const end = new Date(inst.end ?? inst.start).getTime()
      if (end < from.getTime() || start > to.getTime()) continue

      events.push({
        title: text(inst.summary) || '(No title)',
        time: '',
        allDay: inst.isFullDay,
        location: text(inst.event?.location) || undefined,
        color,
        start,
        end
      })
    }
  }

  return events
}

function timeFormat() {
  const fmt = (getStorageValue('timeFormat') as string) || 'HH:mm'
  // reuse the user's clock format but drop seconds
  return fmt.replace(/:ss/, '')
}

/** Group into days relative to *now*, so labels stay correct between fetches */
function group(events: CalendarEvent[]): CalendarDay[] {
  const now = moment()
  const fmt = timeFormat()
  const days: CalendarDay[] = []

  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const day = now.clone().startOf('day').add(i, 'days')
    const dayEnd = day.clone().endOf('day')

    const dayEvents = events
      .filter(e => {
        if (e.allDay) {
          // all-day end dates are exclusive
          return e.start <= dayEnd.valueOf() && e.end > day.valueOf()
        }
        if (i === 0 && e.end < now.valueOf()) return false
        return e.start <= dayEnd.valueOf() && e.end >= day.valueOf()
      })
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start)
      .map(e => ({
        ...e,
        time: e.allDay
          ? 'All day'
          : e.start < day.valueOf()
            ? `until ${moment(e.end).format(fmt)}`
            : moment(e.start).format(fmt)
      }))

    if (dayEvents.length === 0) continue

    const label =
      i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : day.format('dddd, MMM D')
    days.push({ label, events: dayEvents })
  }

  return days
}

async function update() {
  const sources = getCalendarSources()
  if (sources.length === 0) {
    latest = { error: 'Add a calendar link in the desktop app' }
    publish('calendar', latest)
    return
  }

  const from = moment().startOf('day').toDate()
  const to = moment().add(LOOKAHEAD_DAYS, 'days').endOf('day').toDate()

  const results = await Promise.allSettled(
    sources.map((s, i) =>
      fetchSource(s, s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length], from, to)
    )
  )

  const events: CalendarEvent[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') events.push(...r.value)
    else
      log(
        `Failed to load calendar ${sources[i].name ?? i}: ${r.reason}`,
        'Calendar',
        LogLevel.WARN
      )
  })

  if (events.length === 0 && results.every(r => r.status === 'rejected')) {
    if (rawEvents.length === 0) {
      latest = { error: "Couldn't load your calendars" }
      publish('calendar', latest)
    }
    return
  }

  rawEvents = events
  latest = { days: group(rawEvents) }
  publish('calendar', latest)
}

let regroupTimer: NodeJS.Timeout | null = null

export const calendarProvider: TopicProvider = {
  topic: 'calendar',
  start() {
    update()
    timer = setInterval(update, REFRESH_MS)
    // Re-label every minute so finished events drop off and "Today" rolls over
    regroupTimer = setInterval(() => {
      if (rawEvents.length === 0) return
      latest = { days: group(rawEvents) }
      publish('calendar', latest)
    }, 60 * 1000)
  },
  stop() {
    if (timer) clearInterval(timer)
    if (regroupTimer) clearInterval(regroupTimer)
    timer = null
    regroupTimer = null
  },
  latest: () => latest
}

export function invalidateCalendar() {
  rawEvents = []
  latest = null
  if (timer) update()
}
