import { useContext, useEffect, useRef, useState } from 'react'

import { SocketContext } from '@/contexts/SocketContext.tsx'
import { useServerTime } from '@/lib/useServerTime.ts'

import styles from './NightClock.module.css'

/** How long a tap shows the normal screens before the clock comes back */
const PEEK_MS = 60 * 1000

/** Night mode's dim, clock-only view. The PC decides when it's night. */
const NightClock: React.FC = () => {
  const { ready, socket } = useContext(SocketContext)
  const time = useServerTime()
  const [night, setNight] = useState({ active: false, clockOnly: true })
  const [peeking, setPeeking] = useState(false)
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function peek() {
    setPeeking(true)
    if (peekTimer.current) clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS)
  }

  useEffect(() => () => {
    if (peekTimer.current) clearTimeout(peekTimer.current)
  }, [])

  useEffect(() => {
    if (!ready || !socket) return
    const listener = (e: MessageEvent) => {
      const { type, data } = JSON.parse(e.data)
      if (type === 'night' && data) setNight(data)
    }
    socket.addEventListener('message', listener)
    socket.send(JSON.stringify({ type: 'night' }))
    return () => socket.removeEventListener('message', listener)
  }, [ready, socket])

  // any button press also peeks
  useEffect(() => {
    if (!night.active || !night.clockOnly || peeking) return
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      e.preventDefault()
      peek()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [night.active, night.clockOnly, peeking])

  if (!night.active || !night.clockOnly || peeking) return null

  return (
    <div className={styles.night} onPointerDown={peek}>
      <p className={`${styles.time} tnum`}>{time?.time}</p>
      <p className={styles.date}>{time?.date}</p>
    </div>
  )
}

export default NightClock
