import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { activeLyricIndex, MediaContext, usePosition } from '@/contexts/MediaContext.tsx'

import styles from './LyricsView.module.css'

interface LyricsViewProps {
  size: 'small' | 'large'
}

/** Synced lyrics that keep the current line centred; tap a line to jump to it */
const LyricsView: React.FC<LyricsViewProps> = ({ size }) => {
  const { lyrics, playerData, actions, supports } = useContext(MediaContext)
  const position = usePosition(200)
  const containerRef = useRef<HTMLDivElement>(null)
  const linesRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  const idx = activeLyricIndex(lyrics, position)

  useLayoutEffect(() => {
    const container = containerRef.current
    const lines = linesRef.current
    if (!container || !lines) return
    const el = lines.children[Math.max(0, idx)] as HTMLElement | undefined
    if (!el) return
    const target = el.offsetTop + el.offsetHeight / 2 - container.clientHeight * (size === 'large' ? 0.4 : 0.42)
    setOffset(Math.max(0, target))
  }, [idx, size, lyrics])

  // plain lyrics scroll with the knob when focused
  const plainRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const listener = (e: WheelEvent) => {
      const el = plainRef.current
      if (!el || !el.closest(':focus-within') || e.deltaX === 0) return
      e.preventDefault()
      el.scrollTop += e.deltaX > 0 ? 60 : -60
    }
    document.addEventListener('wheel', listener, { passive: false })
    return () => document.removeEventListener('wheel', listener)
  }, [])

  if (!playerData) return <p className={styles.empty}>Nothing playing</p>
  if (!lyrics) return <p className={styles.empty}>Looking for lyrics…</p>
  if (lyrics.instrumental) return <p className={styles.empty}>Instrumental</p>

  if (!lyrics.synced?.length) {
    if (!lyrics.plain) return <p className={styles.empty}>No lyrics found for this track</p>
    return (
      <div className={styles.plain} ref={plainRef} data-size={size} data-noswipe>
        {lyrics.plain.split('\n').map((l, i) => (
          <p key={i}>{l || ' '}</p>
        ))}
      </div>
    )
  }

  const canSeek = supports('seek')

  return (
    <div className={styles.container} ref={containerRef} data-size={size}>
      <div
        className={styles.lines}
        ref={linesRef}
        style={{ transform: `translateY(${-offset}px)` }}
      >
        {lyrics.synced.map((line, i) => (
          <p
            key={i}
            className={styles.line}
            data-state={i === idx ? 'active' : i < idx ? 'past' : 'future'}
            onClick={canSeek ? () => actions.seek(line.t) : undefined}
          >
            {line.text || '♪'}
          </p>
        ))}
      </div>
    </div>
  )
}

export default LyricsView
