import { getStorageValue } from './storage.js'

import {
  ButtonAction,
  ClientConfig,
  PlayerLayout,
  Macro,
  PublicMacro,
  Screen,
  WidgetId
} from '../types/Config.js'

export const ALL_WIDGETS: WidgetId[] = [
  'player',
  'apps',
  'controls',
  'lyrics',
  'weather',
  'system',
  'calendar',
  'mixer',
  'macros',
  'clock'
]

export const defaultScreens: Screen[] = [
  { id: 'home', name: 'Home', columns: [['player'], ['apps', 'controls']] },
  {
    id: 'glance',
    name: 'Glance',
    columns: [['clock', 'weather'], ['calendar']]
  },
  { id: 'pc', name: 'PC', columns: [['system'], ['mixer', 'macros']] }
]

const none: ButtonAction = { type: 'none' }

export const defaultPlayerLayout: PlayerLayout = {
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
}

export const defaultClientConfig: ClientConfig = {
  screens: defaultScreens,
  buttons: {
    '1': { press: { type: 'screen', index: 0 }, hold: none },
    '2': { press: { type: 'screen', index: 1 }, hold: none },
    '3': { press: { type: 'screen', index: 2 }, hold: { type: 'lock' } },
    '4': {
      press: { type: 'fullscreen', view: 'lyrics' },
      hold: { type: 'playback', action: 'like' }
    }
  },
  knob: {
    idle: 'volume',
    press: { type: 'playback', action: 'playPause' }
  },
  volumeStep: 5,
  seekStep: 10,
  accent: 'album',
  playerLyricsLine: true,
  player: defaultPlayerLayout
}

export const defaultMacros: Macro[] = [
  {
    id: 'example-discord-mute',
    name: 'Discord mute',
    icon: 'mic_off',
    color: '#5865f2',
    steps: [{ type: 'keys', keys: 'ctrl+shift+m' }]
  }
]

function sanitizeScreens(screens: unknown): Screen[] {
  if (!Array.isArray(screens) || screens.length === 0) return defaultScreens

  const valid = screens
    .filter(
      (s): s is Screen =>
        s && typeof s === 'object' && Array.isArray((s as Screen).columns)
    )
    .map((s, i) => ({
      id: String(s.id ?? `screen-${i}`),
      name: String(s.name ?? `Screen ${i + 1}`),
      columns: s.columns
        .filter(Array.isArray)
        .map(col => col.filter(w => ALL_WIDGETS.includes(w)))
        .filter(col => col.length > 0)
    }))
    .filter(s => s.columns.length > 0)

  return valid.length > 0 ? valid : defaultScreens
}

export function getClientConfig(): ClientConfig {
  const stored = (getStorageValue('clientConfig') ?? {}) as Partial<
    ClientConfig
  >

  return {
    ...defaultClientConfig,
    ...stored,
    screens: sanitizeScreens(stored.screens),
    buttons: {
      ...defaultClientConfig.buttons,
      ...(stored.buttons ?? {})
    },
    knob: {
      ...defaultClientConfig.knob,
      ...(stored.knob ?? {})
    },
    player: {
      ...defaultPlayerLayout,
      ...(stored.player ?? {})
    }
  }
}

export function getMacros(): Macro[] {
  const stored = getStorageValue('macros')
  if (!Array.isArray(stored)) return defaultMacros
  return stored as Macro[]
}

export function getPublicMacros(): PublicMacro[] {
  return getMacros().map(({ id, name, icon, color }) => ({
    id,
    name,
    icon,
    color
  }))
}

/** Widgets that appear on any screen, used to decide what data to collect */
export function getUsedWidgets(): Set<WidgetId> {
  const used = new Set<WidgetId>()
  for (const screen of getClientConfig().screens)
    for (const col of screen.columns) for (const w of col) used.add(w)
  return used
}
