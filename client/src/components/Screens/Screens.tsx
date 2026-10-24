import { useContext, useEffect, useRef } from 'react'

import { ConfigContext } from '@/contexts/ConfigContext.tsx'
import { TopicsContext, Topic } from '@/contexts/TopicsContext.tsx'
import { UIContext } from '@/contexts/UIContext.tsx'

import { widgets } from './registry.tsx'

import styles from './Screens.module.css'

const SWIPE_PX = 70

const Screens: React.FC = () => {
  const { screens } = useContext(ConfigContext)
  const { screen, stepScreen } = useContext(UIContext)
  const { setWanted } = useContext(TopicsContext)

  // only stream data for widgets on the visible screen
  useEffect(() => {
    const topics = new Set<Topic>()
    screens[screen]?.columns.forEach(col =>
      col.forEach(w => {
        const t = widgets[w]?.topic
        if (t) topics.add(t)
      })
    )
    setWanted([...topics])
  }, [screens, screen, setWanted])

  // horizontal swipe between screens; widgets with sliders opt out
  const start = useRef<{ x: number; y: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('[data-noswipe]')) return
    start.current = { x: e.clientX, y: e.clientY }
  }

  function onPointerUp(e: React.PointerEvent) {
    const s = start.current
    start.current = null
    if (!s || screens.length < 2) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) stepScreen(dx < 0 ? 1 : -1)
  }

  return (
    <div
      className={styles.viewport}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (start.current = null)}
    >
      <div
        className={styles.track}
        style={{
          width: `${screens.length * 100}%`,
          transform: `translateX(-${(screen * 100) / screens.length}%)`
        }}
      >
        {screens.map((s, i) => (
          <div
            key={s.id}
            className={styles.screen}
            style={{ width: `${100 / screens.length}%` }}
            data-screen-active={i === screen}
            aria-hidden={i !== screen}
          >
            {/* only mount neighbours, keeps the CarThing's CPU free */}
            {Math.abs(i - screen) <= 1 &&
              s.columns.map((col, ci) => (
                <div
                  key={ci}
                  className={styles.column}
                  style={{
                    flex: Math.max(...col.map(w => widgets[w]?.weight ?? 1))
                  }}
                >
                  {col.map(w => {
                    const W = widgets[w]?.component
                    return W ? <W key={w} /> : null
                  })}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Screens
