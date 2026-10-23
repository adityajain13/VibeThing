import React, { useEffect, useRef, useState } from 'react'

import type { WeatherLocation } from '@/types/Config.js'

import styles from '../Customize.module.css'

interface CalendarSource {
  url: string
  name?: string
  color?: string
}

const CAL_COLORS = ['#4f8cff', '#ff7a59', '#2ec27e', '#c061cb', '#f5c211']

const WidgetsTab: React.FC = () => {
  const [location, setLocation] = useState<WeatherLocation | null>(null)
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WeatherLocation[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [calendars, setCalendars] = useState<CalendarSource[]>([])
  const [loaded, setLoaded] = useState(false)
  const calTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    Promise.all([
      window.api.getStorageValue('weatherLocation'),
      window.api.getStorageValue('weatherUnits'),
      window.api.getStorageValue('calendars')
    ]).then(([l, u, c]) => {
      setLocation((l as WeatherLocation) ?? null)
      setUnits(u === 'imperial' ? 'imperial' : 'metric')
      setCalendars(Array.isArray(c) ? (c as CalendarSource[]) : [])
      setLoaded(true)
    })
  }, [])

  async function search(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    const r = await window.api.geocodeLocation(query.trim()).catch(() => [])
    setResults(r)
    setSearching(false)
  }

  function pick(l: WeatherLocation) {
    setLocation(l)
    setResults(null)
    setQuery('')
    window.api.setStorageValue('weatherLocation', l)
  }

  function changeCalendars(next: CalendarSource[]) {
    setCalendars(next)
    // feeds are fetched on save, so don't hammer them while typing a URL
    clearTimeout(calTimer.current)
    calTimer.current = setTimeout(
      () =>
        window.api.setStorageValue(
          'calendars',
          next.filter(c => c.url.trim())
        ),
      800
    )
  }

  if (!loaded) return null

  return (
    <div className={styles.scrollTab}>
      <section className={styles.card}>
        <h3>
          <span className="material-icons">wb_sunny</span>Weather
        </h3>
        <p className={styles.help}>Forecasts come from Open-Meteo. No account needed.</p>
        <div className={styles.field}>
          <label>Location</label>
          <span className={location ? '' : styles.muted}>
            {location?.name ?? 'Not set'}
          </span>
        </div>
        <form className={styles.searchRow} onSubmit={search}>
          <input
            type="text"
            className={styles.grow}
            value={query}
            placeholder="Search a city, e.g. Mississauga"
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className={styles.primaryBtn} disabled={searching}>
            <span className="material-icons">search</span>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {results && (
          <ul className={styles.results}>
            {results.length === 0 ? (
              <li className={styles.muted}>No places found</li>
            ) : (
              results.map(r => (
                <li key={`${r.latitude},${r.longitude}`}>
                  <button onClick={() => pick(r)}>
                    <span className="material-icons">place</span>
                    {r.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        <div className={styles.field}>
          <label>Units</label>
          <div className={styles.segmented}>
            {(['metric', 'imperial'] as const).map(u => (
              <button
                key={u}
                data-active={units === u}
                onClick={() => {
                  setUnits(u)
                  window.api.setStorageValue('weatherUnits', u)
                }}
              >
                {u === 'metric' ? '°C, km/h' : '°F, mph'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <h3>
          <span className="material-icons">event</span>Calendars
        </h3>
        <p className={styles.help}>
          Paste a private ICS / iCal link. In Google Calendar: Settings → your
          calendar → “Secret address in iCal format”. Outlook: Settings →
          Shared calendars → Publish → ICS.
        </p>
        {calendars.map((c, i) => (
          <div key={i} className={styles.calRow}>
            <input
              type="color"
              className={styles.color}
              value={c.color ?? CAL_COLORS[i % CAL_COLORS.length]}
              onChange={e =>
                changeCalendars(calendars.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))
              }
            />
            <input
              type="text"
              className={styles.calName}
              placeholder="Name"
              value={c.name ?? ''}
              onChange={e =>
                changeCalendars(calendars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
            />
            <input
              type="text"
              className={styles.grow}
              placeholder="https://calendar.google.com/…/basic.ics"
              value={c.url}
              onChange={e =>
                changeCalendars(calendars.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
              }
            />
            <button
              className={styles.iconBtn}
              onClick={() => changeCalendars(calendars.filter((_, j) => j !== i))}
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        ))}
        <button
          className={styles.ghostBtn}
          onClick={() =>
            changeCalendars([
              ...calendars,
              { url: '', name: '', color: CAL_COLORS[calendars.length % CAL_COLORS.length] }
            ])
          }
        >
          <span className="material-icons">add</span>Add calendar
        </button>
      </section>

      <section className={styles.card}>
        <h3>
          <span className="material-icons">memory</span>PC stats & mixer
        </h3>
        <p className={styles.help}>
          Nothing to set up. They only collect data while they’re on the
          screen you’re looking at on the CarThing. The mixer needs Windows;
          GPU load shows up when your graphics driver reports it.
        </p>
      </section>
    </div>
  )
}

export default WidgetsTab
