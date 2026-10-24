import { timer } from '@/lib/timerStore.ts'
import { useContext, useEffect, useRef } from 'react'

import { AppBlurContext } from '@/contexts/AppBlurContext.tsx'
import { ConfigContext } from '@/contexts/ConfigContext.tsx'
import { MediaContext } from '@/contexts/MediaContext.tsx'
import { UIContext } from '@/contexts/UIContext.tsx'

import { useRunAction } from '@/lib/useRunAction.ts'

import { PresetKey } from '@/types/Config.js'

const HOLD_MS = 500
const PRESETS: PresetKey[] = ['1', '2', '3', '4']

function isIdle() {
  const el = document.activeElement
  return !el || el === document.body
}

/**
 * Maps the CarThing hardware to actions:
 *  - preset buttons 1-4 (press and hold, both configurable)
 *  - knob turn / press when nothing is focused
 *  - back button: leave a widget, or toggle the full screen player
 */
const InputController: React.FC = () => {
  const config = useContext(ConfigContext)
  const ui = useContext(UIContext)
  const { blurred } = useContext(AppBlurContext)
  const { actions } = useContext(MediaContext)
  const run = useRunAction()

  // handlers change every render; keep the latest in a ref for the listeners
  const latest = useRef({ config, ui, blurred, actions, run })
  latest.current = { config, ui, blurred, actions, run }

  useEffect(() => {
    const holdTimers: Partial<Record<string, ReturnType<typeof setTimeout>>> = {}
    const held: Partial<Record<string, boolean>> = {}
    let lastScreenStep = 0

    function onKeyDown(e: KeyboardEvent) {
      const { config, ui, blurred, run } = latest.current
      if (blurred) return

      if (PRESETS.includes(e.key as PresetKey)) {
        e.preventDefault()
        if (e.repeat || holdTimers[e.key] !== undefined) return
        held[e.key] = false
        holdTimers[e.key] = setTimeout(() => {
          held[e.key] = true
          run(config.buttons[e.key as PresetKey].hold)
        }, HOLD_MS)
        return
      }

      if (e.key === 'Escape') {
        if (ui.fullscreen) return ui.setFullscreen(null)
        if (!isIdle()) return (document.activeElement as HTMLElement).blur()
        return ui.setFullscreen('cover')
      }

      if (ui.fullscreen || !isIdle()) return

      if (e.key === 'Enter') return run(config.knob.press)
      if (e.key === 'ArrowLeft') return onWheel({ deltaX: -1, preventDefault() {} } as WheelEvent)
      if (e.key === 'ArrowRight') return onWheel({ deltaX: 1, preventDefault() {} } as WheelEvent)
    }

    function onKeyUp(e: KeyboardEvent) {
      if (!PRESETS.includes(e.key as PresetKey)) return
      const timer = holdTimers[e.key]
      if (timer === undefined) return
      clearTimeout(timer)
      delete holdTimers[e.key]
      if (!held[e.key]) {
        const mapping = latest.current.config.buttons[e.key as PresetKey]
        // if nothing is mapped to press, a short press shouldn't feel dead
        latest.current.run(mapping.press.type === 'none' ? mapping.hold : mapping.press)
      }
    }

    function onWheel(e: WheelEvent) {
      const { config, ui, blurred, actions } = latest.current
      if (blurred || ui.fullscreen || !isIdle() || e.deltaX === 0) return
      e.preventDefault()
      const dir = e.deltaX > 0 ? 1 : -1

      // on a screen with the Timer, the dial sets it while it's stopped
      const onTimerScreen = config.screens[ui.screen]?.columns.some(c => c.includes('timer'))
      if (onTimerScreen && timer.dialTick(dir)) return

      if (config.knob.idle === 'volume') actions.changeVolume(dir)
      else if (config.knob.idle === 'screens') {
        if (Date.now() - lastScreenStep < 250) return
        lastScreenStep = Date.now()
        ui.stepScreen(dir)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('wheel', onWheel)
      Object.values(holdTimers).forEach(t => t && clearTimeout(t))
    }
  }, [])

  return null
}

export default InputController
