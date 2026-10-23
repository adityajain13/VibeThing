import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { formatDuration, timer, TimerMode } from '@/lib/timerStore.ts'

import styles from './Timer.module.css'

const PRESETS = [1, 5, 10, 25]
const MIN = 60 * 1000

/**
 * Timer and stopwatch. Focus it (tap or a preset button), then the dial sets
 * the timer in 1-minute steps and the dial press starts / pauses.
 */
const Timer: React.FC = () => {
  const state = useSyncExternalStore(timer.subscribe, timer.get)
  const ref = useRef<HTMLDivElement>(null)
  const running = timer.running()
  const [, tick] = useState(0)

  // repaint while running (tenths for the stopwatch)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => tick(n => n + 1), state.mode === 'stopwatch' ? 100 : 250)
    return () => clearInterval(t)
  }, [running, state.mode])

  // dial turns while focused
  useEffect(() => {
    const listener = (e: WheelEvent) => {
      if (!ref.current?.matches(':focus-within') || e.deltaX === 0) return
      e.preventDefault()
      timer.adjust((e.deltaX > 0 ? 1 : -1) * MIN)
    }
    document.addEventListener('wheel', listener, { passive: false })
    return () => document.removeEventListener('wheel', listener)
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      e.stopPropagation()
      timer.toggle()
    } else if (e.key === 'ArrowLeft') timer.adjust(-MIN)
    else if (e.key === 'ArrowRight') timer.adjust(MIN)
  }

  const value = timer.value()
  // a countdown reads naturally rounded up: 4:59.2 left shows as 5:00
  const shown =
    state.mode === 'timer' ? formatDuration(value > 0 ? value + 999 : 0) : formatDuration(value, true)
  const progress = state.mode === 'timer' && state.setMs ? 1 - value / state.setMs : 0

  return (
    <BaseWidget className={styles.timer} ref={ref} onKeyDown={onKeyDown}>
      <div className={styles.modes} data-noswipe>
        {(['timer', 'stopwatch'] as TimerMode[]).map(m => (
          <button key={m} data-active={state.mode === m} onClick={() => timer.setMode(m)}>
            {m === 'timer' ? 'Timer' : 'Stopwatch'}
          </button>
        ))}
      </div>

      <div
        className={styles.face}
        data-done={state.mode === 'timer' && state.done}
        onClick={() => (state.done ? timer.dismiss() : timer.toggle())}
      >
        <p className={`${styles.digits} tnum`}>{state.mode === 'timer' && state.done ? "Time's up" : shown}</p>
        {state.mode === 'timer' && !state.done && (
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
          </div>
        )}
      </div>

      <div className={styles.row} data-noswipe>
        {state.mode === 'timer' && !running && !state.done ? (
          PRESETS.map(m => (
            <button key={m} className={styles.chip} onClick={() => timer.setLength(m * MIN)}>
              {m}m
            </button>
          ))
        ) : (
          <span className={styles.hint}>{running ? 'Tap to pause' : state.done ? 'Tap to dismiss' : ''}</span>
        )}
        <div className={styles.spacer} />
        <button className={styles.round} onClick={() => timer.reset()} aria-label="Reset">
          <span className="material-icons">restart_alt</span>
        </button>
        <button className={`${styles.round} ${styles.primary}`} onClick={() => timer.toggle()} aria-label={running ? 'Pause' : 'Start'}>
          <span className="material-icons">{running ? 'pause' : 'play_arrow'}</span>
        </button>
      </div>
    </BaseWidget>
  )
}

export default Timer
