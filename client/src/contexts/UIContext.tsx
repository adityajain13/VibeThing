import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

import { ConfigContext } from './ConfigContext.tsx'

export type FullscreenView = 'cover' | 'lyrics' | 'queue'

interface UIContextProps {
  screen: number
  setScreen: (index: number) => void
  stepScreen: (delta: number) => void
  fullscreen: FullscreenView | null
  setFullscreen: (view: FullscreenView | null) => void
  toast: (icon: string, text: string) => void
  toastState: { id: number; icon: string; text: string } | null
}

const UIContext = createContext<UIContextProps>({
  screen: 0,
  setScreen: () => {},
  stepScreen: () => {},
  fullscreen: null,
  setFullscreen: () => {},
  toast: () => {},
  toastState: null
})

const UIContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { screens } = useContext(ConfigContext)
  const [screen, setScreenState] = useState(0)
  const [fullscreen, setFullscreen] = useState<FullscreenView | null>(null)
  const [toastState, setToastState] = useState<UIContextProps['toastState']>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const count = screens.length

  useEffect(() => {
    if (screen >= count) setScreenState(0)
  }, [screen, count])

  function setScreen(index: number) {
    if (index < 0 || index >= count) return
    ;(document.activeElement as HTMLElement | null)?.blur()
    setScreenState(index)
  }

  function stepScreen(delta: number) {
    ;(document.activeElement as HTMLElement | null)?.blur()
    setScreenState(s => (s + delta + count) % count)
  }

  function toast(icon: string, text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastState({ id: Date.now(), icon, text })
    toastTimer.current = setTimeout(() => setToastState(null), 1600)
  }

  return (
    <UIContext.Provider
      value={{ screen, setScreen, stepScreen, fullscreen, setFullscreen, toast, toastState }}
    >
      {children}
    </UIContext.Provider>
  )
}

export { UIContext, UIContextProvider }
