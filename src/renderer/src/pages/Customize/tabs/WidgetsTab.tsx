import React, { useEffect, useRef, useState } from 'react'

import Switch from '@/components/Switch/Switch.js'

import type { WeatherLocation } from '@/types/Config.js'

import styles from '../Customize.module.css'

interface CalendarSource {
  url: string
  name?: string
  color?: string
}

const CAL_COLORS = ['#4f8cff', '#ff7a59', '#2ec27e', '#c061cb', '#f5c211']

/** YouTube likes go through a small browser extension that ships with VibeThing */
const BrowserCard: React.FC = () => {
  const [state, setState] = useState<{ connected: boolean; folder: string | null } | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => window.api.getBrowserBridge().then(s => alive && setState(s))
    load()
    const id = setInterval(load, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  if (!state) return null

  return (
    <section className={styles.card}>
      <h3>
        <span className="material-icons">thumb_up</span>YouTube likes
      </h3>
      <p className={styles.help}>
        Lets the like button on the CarThing like and unlike what’s playing on YouTube and
        YouTube Music in Chrome or Edge. It needs the VibeThing browser extension.
      </p>
      {state.connected ? (
        <p className={styles.okNote}>
          <span className="material-icons">check_circle</span>
          Extension connected
        </p>
      ) : (
        <>
          <ol className={styles.steps}>
            <li className={styles.helpStep}>
              Open <b>chrome://extensions</b> (or <b>edge://extensions</b>) and turn on{' '}
              <b>Developer mode</b>.
            </li>
            <li className={styles.helpStep}>
              Click <b>Load unpacked</b> and choose the extension folder.
            </li>
            <li className={styles.helpStep}>Reload any YouTube tabs that are already open.</li>
          </ol>
          <div className={styles.inline}>
            <button
              className={styles.primaryBtn}
              disabled={!state.folder}
              onClick={() => window.api.openExtensionFolder()}
            >
              <span className="material-icons">folder_open</span>
              Show extension folder
            </button>
            <span className={styles.muted}>Not connected yet</span>
          </div>
        </>
      )}
    </section>
  )
}

const VlcCard: React.FC = () => {
  const [enabled, setEnabled] = useState(false)
  const [port, setPort] = useState('8080')
  const [password, setPassword] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [status, setStatus] = useState<'ok' | 'auth' | 'offline' | 'testing' | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.getVlcSettings().then(s => {
      setEnabled(s.enabled)
      setPort(String(s.port))
      setHasPassword(s.hasPassword)
      setLoaded(true)
    })
  }, [])

  function save(patch: { enabled?: boolean; port?: string; password?: string }) {
    const next = { enabled: patch.enabled ?? enabled, port: Number(patch.port ?? port) || 8080 }
    window.api.saveVlcSettings({ ...next, ...(patch.password !== undefined ? { password: patch.password } : {}) })
    if (patch.password !== undefined) setHasPassword(patch.password.length > 0)
  }

  async function test() {
    setStatus('testing')
    const res = await window.api.testVlc({ port: Number(port) || 8080, ...(password ? { password } : {}) })
    if (password) save({ password })
    setStatus(res)
  }

  if (!loaded) return null

  return (
    <section className={styles.card}>
      <div className={styles.field}>
        <h3>
          <span className="material-icons">smart_display</span>VLC
        </h3>
        <Switch
          value={enabled}
          onChange={v => {
            setEnabled(v)
            save({ enabled: v })
          }}
        />
      </div>
      <p className={styles.help}>
        Reads VLC directly, no plugin needed. While VLC is playing it takes over
        Now playing, with seek, volume, shuffle and repeat.
      </p>
      <div className={styles.dimmable} data-off={!enabled}>
        <ol className={styles.steps}>
          <li className={styles.helpStep}>
            In VLC: <b>Tools → Preferences</b>, then <b>Show settings: All</b> (bottom left).
          </li>
          <li className={styles.helpStep}>
            <b>Interface → Main interfaces</b>: tick <b>Web</b>.
          </li>
          <li className={styles.helpStep}>
            <b>Main interfaces → Lua</b>: set a <b>password</b> and enter it below. Save, then restart VLC.
          </li>
        </ol>
        <div className={styles.calRow}>
          <input
            type="text"
            className={styles.calName}
            value={port}
            placeholder="8080"
            onChange={e => setPort(e.target.value.replace(/\D/g, ''))}
            onBlur={() => save({ port })}
          />
          <input
            type="password"
            className={styles.grow}
            value={password}
            placeholder={hasPassword ? 'Password saved (type to change)' : 'VLC Lua password'}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => password && save({ password })}
          />
          <button className={styles.primaryBtn} onClick={test} disabled={status === 'testing'}>
            <span className="material-icons">wifi_tethering</span>
            {status === 'testing' ? 'Testing…' : 'Test'}
          </button>
        </div>
        {status && status !== 'testing' && (
          <p className={status === 'ok' ? styles.okNote : styles.warn}>
            <span className="material-icons">{status === 'ok' ? 'check_circle' : 'error'}</span>
            {status === 'ok'
              ? 'Connected to VLC.'
              : status === 'auth'
                ? 'VLC answered, but the password is wrong.'
                : 'Couldn’t reach VLC. Is it open, with the Web interface on and restarted?'}
          </p>
        )}
      </div>
    </section>
  )
}

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

      <VlcCard />
      <BrowserCard />

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
