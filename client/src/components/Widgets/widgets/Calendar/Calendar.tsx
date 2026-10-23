import { useEffect, useRef } from 'react'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { useTopic } from '@/contexts/TopicsContext.tsx'

import { CalendarData } from '@/types/Widgets.js'

import styles from './Calendar.module.css'

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

  let body: React.ReactNode
  if (!data) body = <p className={styles.empty}>Loading your calendar…</p>
  else if (data.error) body = <p className={styles.empty}>{data.error}</p>
  else if (!data.days?.length) body = <p className={styles.empty}>Nothing on the calendar this week</p>
  else
    body = data.days.map(day => (
      <div key={day.label} className={styles.day}>
        <p className={styles.dayLabel}>{day.label}</p>
        {day.events.map((ev, i) => (
          <div key={i} className={styles.event}>
            <span className={styles.dot} style={{ background: ev.color }} />
            <div className={styles.eventText}>
              <p className={styles.title}>{ev.title}</p>
              {ev.location && <p className={styles.location}>{ev.location}</p>}
            </div>
            <p className={`${styles.time} tnum`}>{ev.time}</p>
          </div>
        ))}
      </div>
    ))

  return (
    <BaseWidget className={styles.calendar}>
      <div className={styles.list} ref={listRef} data-noswipe>
        {body}
      </div>
    </BaseWidget>
  )
}

export default Calendar
