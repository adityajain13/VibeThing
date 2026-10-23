import type {
  ButtonAction,
  PlaybackButtonAction,
  Screen,
  WidgetId
} from '@/types/Config.js'

export const WIDGETS: Record<
  WidgetId,
  { label: string; icon: string; hint: string; weight?: number }
> = {
  player: {
    label: 'Now playing',
    icon: 'album',
    hint: 'Cover, track, progress and volume',
    weight: 1.15
  },
  controls: {
    label: 'Lock PC',
    icon: 'lock',
    hint: 'One big button that locks your computer'
  },
  lyrics: { label: 'Lyrics', icon: 'lyrics', hint: 'Synced lyrics' },
  apps: {
    label: 'App shortcuts',
    icon: 'apps',
    hint: 'Launch apps on your PC'
  },
  macros: {
    label: 'Macros',
    icon: 'bolt',
    hint: 'Your custom multi-step actions'
  },
  clock: { label: 'Clock', icon: 'schedule', hint: 'Large time and date' },
  weather: {
    label: 'Weather',
    icon: 'wb_sunny',
    hint: 'Current, hourly and daily forecast'
  },
  calendar: {
    label: 'Calendar',
    icon: 'event',
    hint: 'Upcoming events from ICS feeds'
  },
  system: {
    label: 'PC stats',
    icon: 'memory',
    hint: 'CPU, RAM, GPU and network'
  },
  mixer: {
    label: 'Volume mixer',
    icon: 'volume_up',
    hint: 'Per-app volume (Windows)'
  }
}

export const WIDGET_ORDER = Object.keys(WIDGETS) as WidgetId[]

export const PLAYBACK_ACTIONS: Record<PlaybackButtonAction, string> = {
  playPause: 'Play / pause',
  next: 'Next track',
  previous: 'Previous track',
  shuffle: 'Toggle shuffle',
  repeat: 'Cycle repeat',
  like: 'Like / unlike',
  volumeUp: 'Volume up',
  volumeDown: 'Volume down',
  seekForward: 'Seek forward',
  seekBackward: 'Seek backward'
}

export const MAX_COLUMNS = 3

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

/** Flatten a ButtonAction into a <select> value and back */
export function encodeAction(a: ButtonAction): string {
  switch (a.type) {
    case 'screen':
      return `screen:${a.index}`
    case 'focus':
      return `focus:${a.widget}`
    case 'playback':
      return `playback:${a.action}`
    case 'fullscreen':
      return `fullscreen:${a.view ?? 'cover'}`
    case 'macro':
      return `macro:${a.id}`
    case 'app':
      return `app:${a.id}`
    default:
      return a.type
  }
}

export function decodeAction(v: string): ButtonAction {
  const [type, ...rest] = v.split(':')
  const arg = rest.join(':')
  switch (type) {
    case 'screen':
      return { type: 'screen', index: Number(arg) }
    case 'focus':
      return { type: 'focus', widget: Number(arg) }
    case 'playback':
      return { type: 'playback', action: arg as PlaybackButtonAction }
    case 'fullscreen':
      return {
        type: 'fullscreen',
        view: arg as 'cover' | 'lyrics' | 'queue'
      }
    case 'macro':
      return { type: 'macro', id: arg }
    case 'app':
      return { type: 'app', id: arg }
    case 'nextScreen':
    case 'prevScreen':
    case 'lock':
      return { type }
    default:
      return { type: 'none' }
  }
}

export interface ActionContext {
  screens: Screen[]
  macros: { id: string; name: string }[]
  apps: { id: string; command: string }[]
}

export function actionGroups(ctx: ActionContext) {
  return [
    { label: 'General', options: [{ value: 'none', label: 'Do nothing' }] },
    {
      label: 'Screens',
      options: [
        ...ctx.screens.map((s, i) => ({
          value: `screen:${i}`,
          label: `Go to “${s.name}”`
        })),
        { value: 'nextScreen', label: 'Next screen' },
        { value: 'prevScreen', label: 'Previous screen' },
        ...[0, 1, 2].map(i => ({
          value: `focus:${i}`,
          label: `Focus widget ${i + 1} on current screen`
        }))
      ]
    },
    {
      label: 'Playback',
      options: Object.entries(PLAYBACK_ACTIONS).map(([k, label]) => ({
        value: `playback:${k}`,
        label
      }))
    },
    {
      label: 'Fullscreen player',
      options: [
        { value: 'fullscreen:cover', label: 'Open cover view' },
        { value: 'fullscreen:lyrics', label: 'Open lyrics view' },
        { value: 'fullscreen:queue', label: 'Open queue view' }
      ]
    },
    {
      label: 'Macros',
      options: ctx.macros.map(m => ({
        value: `macro:${m.id}`,
        label: `Run “${m.name}”`
      }))
    },
    {
      label: 'Apps',
      options: ctx.apps.map(a => ({
        value: `app:${a.id}`,
        label: `Open ${appLabel(a.command)}`
      }))
    },
    {
      label: 'PC',
      options: [{ value: 'lock', label: 'Lock computer' }]
    }
  ].filter(g => g.options.length > 0)
}

/** Shortcuts only store a command, so make something readable out of it */
export function appLabel(command: string) {
  const first = command.split('\n')[0].trim()
  const m = first.match(/^"([^"]+)"|^'([^']+)'|^(\S+)/)
  const exe = m ? (m[1] ?? m[2] ?? m[3]) : first
  const file = exe.split(/[\\/]/).pop() ?? exe
  return file.replace(/\.(exe|lnk|app|bat|cmd)$/i, '') || 'app'
}
