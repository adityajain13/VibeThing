import { useContext, useEffect, useRef } from 'react'

import { ConfigContext } from '@/contexts/ConfigContext.tsx'
import { MediaContext } from '@/contexts/MediaContext.tsx'
import { UIContext } from '@/contexts/UIContext.tsx'

/** After the user touches anything, leave the screen alone for this long */
const HANDS_OFF_MS = 20 * 1000

/**
 * Optional (Customize > Behaviour): jump to the music screen when playback
 * starts, and to another screen after being paused/idle for a while.
 */
const AutoSwitch: React.FC = () => {
  const { screens, behaviour } = useContext(ConfigContext)
  const { playerData } = useContext(MediaContext)
  const { screen, setScreen, fullscreen, setFullscreen } = useContext(UIContext)
  // fullscreen we opened ourselves, so idle can close it again
  const openedFullscreen = useRef(false)
  const lastTouch = useRef(0)
  const wasPlaying = useRef<boolean | null>(null)
  const stoppedAt = useRef<number | null>(null)

  const cfg = behaviour.autoSwitch

  useEffect(() => {
    const mark = () => (lastTouch.current = Date.now())
    const evs = ['keydown', 'pointerdown', 'wheel'] as const
    evs.forEach(e => window.addEventListener(e, mark, { passive: true }))
    return () => evs.forEach(e => window.removeEventListener(e, mark))
  }, [])

  const indexOf = (id: string) => screens.findIndex(s => s.id === id)
  const playIndex =
    cfg.playScreen === 'auto'
      ? screens.findIndex(s => s.columns.some(c => c.includes('player')))
      : indexOf(cfg.playScreen)
  const idleIndex = cfg.idleScreen === 'none' ? -1 : indexOf(cfg.idleScreen)

  // playback started
  const playing = Boolean(playerData?.isPlaying)
  useEffect(() => {
    if (playing) stoppedAt.current = null
    else if (stoppedAt.current === null) stoppedAt.current = Date.now()
    const started = wasPlaying.current === false && playing
    wasPlaying.current = playing
    if (!cfg.enabled || !started || fullscreen) return
    if (Date.now() - lastTouch.current < HANDS_OFF_MS) return
    if (cfg.playScreen === 'fullscreen') {
      openedFullscreen.current = true
      return setFullscreen('cover')
    }
    if (playIndex >= 0 && playIndex !== screen) setScreen(playIndex)
    // only react to play/pause changes, not to every screen or config change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  // idle for a while
  useEffect(() => {
    if (!cfg.enabled || idleIndex < 0) return
    const t = setInterval(() => {
      const idleMs = cfg.idleMinutes * 60 * 1000
      if (stoppedAt.current === null || Date.now() - stoppedAt.current < idleMs) return
      if (Date.now() - lastTouch.current < idleMs) return
      // close the fullscreen player only if auto-switch opened it
      if (fullscreen) {
        if (!openedFullscreen.current) return
        openedFullscreen.current = false
        setFullscreen(null)
      }
      if (screen !== idleIndex) setScreen(idleIndex)
    }, 15 * 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.enabled, cfg.idleMinutes, idleIndex, screen, fullscreen])

  return null
}

export default AutoSwitch
