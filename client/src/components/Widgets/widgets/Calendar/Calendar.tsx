import { useOption } from '@/lib/useOption.ts'
import { useEffect, useRef, useState } from 'react'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { useTopic } from '@/contexts/TopicsContext.tsx'

import { CalendarData, CalendarEvent } from '@/types/Widgets.js'

import styles from './Calendar.module.css'

const COUNTDOWN_WINDOW_MS = 3 * 60 * 60 * 1000

/** "in 25 min", "in 1 h 20", "now" — only for timed events within 3 hours */
function countdown(ev: CalendarEvent, now: number) {
  if (ev.allDay) return null
  if (now >= ev.start && now < ev.end) return 'now'
  const ms = ev.start - now
  if (ms <= 0 || ms > COUNTDOWN_WINDOW_MS) return null
  const mins = Math.max(1, Math.round(ms / 60000))
  if (mins < 60) return `in ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `in ${h} h ${m}` : `in ${h} h`
}

/** End time in the same style the PC formatted the start ("6:00 PM" or "18:00") */
function formatLike(sample: string, ms: number) {
  const d = new Date(ms)
  const twelve = /am|pm/i.test(sample)
  const m = String(d.getMinutes()).padStart(2, '0')
  if (!twelve) return `${String(d.getHours()).padStart(2, '0')}:${m}`
  const h = d.getHours() % 12 || 12
  return `${h}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

const Calendar: React.FC = () => {
  const data = useTopic<CalendarData>('calendar')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const listener = (e: WheelEvent) => {
      const el = listRef.current
      if (!el || !el.closest(':focus-within') || e.deltaX === 0) return
      e.preventDefault()
      el.scrollTop += e.deltaX > 0 ? 70 : -70
    }
    document.addEventListener('wheel', listener, { passive: false })
    return () => document.removeEventListener('wheel', listener)
  }, [])

  const showLocation = useOption('calendar', 'showLocation')
  const showTime = useOption('calendar', 'showTime')
  const showDayLabels = useOption('calendar', 'showDayLabels')
  const showColor = useOption('calendar', 'showColor')
  const showCountdown = useOption('calendar', 'showCountdown')
  const tapDetails = useOption('calendar', 'tapDetails')

  const [detail, setDetail] = useState<CalendarEvent | null>(null)
  // the back button closes the detail card instead of opening the player
  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return
      e.stopImmediatePropagation()
      e.preventDefault()
      setDetail(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [detail])
  // re-render every half minute so countdowns stay current
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!showCountdown) return
    const t = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(t)
  }, [showCountdown])

  let body: React.ReactNode
  if (!data) body = <p className={styles.empty}>Loading your calendar…</p>
  else if (data.error) body = <p className={styles.empty}>{data.error}</p>
  else if (!data.days?.length) body = <p className={styles.empty}>Nothing on the calendar this week</p>
  else
    body = data.days.map(day => (
      <div key={day.label} className={styles.day}>
        {showDayLabels && <p className={styles.dayLabel}>{day.label}</p>}
        {day.events.map((ev, i) => (
          <div
            key={i}
            className={styles.event}
            data-tappable={tapDetails}
            onClick={tapDetails ? () => setDetail(ev) : undefined}
          >
            {showColor && <span className={styles.dot} style={{ background: ev.color }} />}
            <div className={styles.eventText}>
              <p className={styles.title}>{ev.title}</p>
              {showLocation && ev.location && <p className={styles.location}>{ev.location}</p>}
            </div>
            {(showTime || showCountdown) && (
              <div className={styles.when}>
                {showTime && <p className={`${styles.time} tnum`}>{ev.time}</p>}
                {showCountdown && countdown(ev, now) && (
                  <p className={styles.countdown} data-now={countdown(ev, now) === 'now'}>
                    {countdown(ev, now)}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    ))

  return (
    <BaseWidget className={styles.calendar}>
      <div className={styles.list} ref={listRef} data-noswipe>
        {body}
      </div>
      {detail && (
        <div className={styles.detail} onClick={() => setDetail(null)} data-noswipe>
          <span className={styles.detailBar} style={{ background: detail.color }} />
          <p className={styles.detailTitle}>{detail.title}</p>
          <p className={`${styles.detailTime} tnum`}>
            {detail.allDay ? 'All day' : `${detail.time} – ${formatLike(detail.time, detail.end)}`}
          </p>
          {detail.location && (
            <p className={styles.detailLocation}>
              <span className="material-icons">place</span>
              {detail.location}
            </p>
          )}
          <p className={styles.detailHint}>Tap to close</p>
        </div>
      )}
    </BaseWidget>
  )
}

export default Calendar
