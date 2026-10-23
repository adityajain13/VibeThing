import React, { createContext, useContext, useEffect, useState } from 'react'

import { SocketContext } from './SocketContext.tsx'

import { ClientConfig, PublicMacro } from '@/types/Config.js'

export type FullConfig = ClientConfig & { macros: PublicMacro[] }

const none = { type: 'none' } as const

export const defaultConfig: FullConfig = {
  screens: [
    { id: 'home', name: 'Home', columns: [['player'], ['apps', 'controls']] }
  ],
  buttons: {
    '1': { press: { type: 'screen', index: 0 }, hold: none },
    '2': { press: { type: 'screen', index: 1 }, hold: none },
    '3': { press: { type: 'screen', index: 2 }, hold: none },
    '4': { press: { type: 'fullscreen', view: 'lyrics' }, hold: none }
  },
  knob: { idle: 'volume', press: { type: 'playback', action: 'playPause' } },
  volumeStep: 5,
  seekStep: 10,
  accent: 'album',
  playerLyricsLine: true,
  player: {
    layout: 'auto',
    coverSize: 100,
    coverAlign: 'center',
    textAlign: 'left',
    textScale: 100,
    controlsScale: 100,
    showProgress: true,
    showTimes: true,
    showControls: true,
    showLike: true,
    glow: true
  },
  text: {},
  options: {},
  theme: 'dark',
  behaviour: {
    autoSwitch: { enabled: false, playScreen: 'auto', idleScreen: 'none', idleMinutes: 5 },
    night: { enabled: false, start: '23:00', end: '07:00', brightness: 8, clockOnly: true }
  },
  macros: []
}

/** Fill in fields an older desktop app (or cache) might not send */
function withDefaults(data: Partial<FullConfig>): FullConfig {
  return {
    ...defaultConfig,
    ...data,
    player: { ...defaultConfig.player, ...(data.player ?? {}) },
    behaviour: {
      autoSwitch: { ...defaultConfig.behaviour.autoSwitch, ...(data.behaviour?.autoSwitch ?? {}) },
      night: { ...defaultConfig.behaviour.night, ...(data.behaviour?.night ?? {}) }
    }
  }
}

const ConfigContext = createContext<FullConfig>(defaultConfig)

const ConfigContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { ready, socket } = useContext(SocketContext)
  const [config, setConfig] = useState<FullConfig>(() => {
    // last known config survives reloads so the layout doesn't flash
    try {
      const cached = localStorage.getItem('gtp-config')
      if (cached) return withDefaults(JSON.parse(cached))
    } catch {
      /* ignore */
    }
    return defaultConfig
  })

  useEffect(() => {
    if (!ready || !socket) return

    const listener = (e: MessageEvent) => {
      const { type, data } = JSON.parse(e.data)
      if (type !== 'config' || !data) return
      setConfig(withDefaults(data))
      try {
        localStorage.setItem('gtp-config', JSON.stringify(data))
      } catch {
        /* ignore */
      }
    }

    socket.addEventListener('message', listener)
    socket.send(JSON.stringify({ type: 'config' }))

    return () => socket.removeEventListener('message', listener)
  }, [ready, socket])

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

export { ConfigContext, ConfigContextProvider }
