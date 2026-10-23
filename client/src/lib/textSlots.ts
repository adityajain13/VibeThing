/**
 * Every piece of text you can restyle, grouped by the widget it lives in,
 * plus each widget's show/hide options. Shared with the desktop app (it
 * imports this file directly), so keep it free of client-only imports.
 *
 * Styles become CSS variables on :root:
 *   --t-<group>-s          master size multiplier for the whole group
 *   --t-<group>-<slot>-s   size multiplier for one element
 *   --t-<group>-<slot>-w   font weight for one element
 * and the widget CSS uses calc(<base>px * master * slot) / var(weight, base).
 */

export interface TextSlot {
  key: string
  label: string
  /** px at 100% and the design's weight */
  size: number
  weight: number
}

export interface TextGroup {
  id: string
  label: string
  icon: string
  /** widget id on screens, if this group is a widget */
  widget?: string
  slots: TextSlot[]
  options?: { key: string; label: string; default?: boolean }[]
}

export const TEXT_GROUPS: TextGroup[] = [
  {
    id: 'statusbar',
    label: 'Status bar',
    icon: 'horizontal_rule',
    slots: [
      { key: 'time', label: 'Time', size: 22, weight: 700 },
      { key: 'date', label: 'Date', size: 17, weight: 500 },
      { key: 'page', label: 'Screen names', size: 15, weight: 600 }
    ],
    options: [
      { key: 'showDate', label: 'Date' },
      { key: 'showPages', label: 'Screen names' }
    ]
  },
  {
    id: 'player',
    label: 'Now playing',
    icon: 'album',
    widget: 'player',
    slots: [
      { key: 'title', label: 'Track title', size: 23, weight: 800 },
      { key: 'artist', label: 'Artist', size: 17, weight: 500 },
      { key: 'lyric', label: 'Lyric line', size: 16, weight: 600 },
      { key: 'times', label: 'Elapsed / total time', size: 14, weight: 600 }
    ]
  },
  {
    id: 'fullscreen',
    label: 'Fullscreen player',
    icon: 'fullscreen',
    slots: [
      { key: 'title', label: 'Track title', size: 38, weight: 800 },
      { key: 'artist', label: 'Artist', size: 22, weight: 600 },
      { key: 'album', label: 'Album', size: 17, weight: 500 },
      { key: 'times', label: 'Elapsed / total time', size: 14, weight: 600 },
      { key: 'tabs', label: 'View tabs', size: 17, weight: 700 },
      { key: 'queueTitle', label: 'Up next: track', size: 19, weight: 700 },
      { key: 'queueArtist', label: 'Up next: artist', size: 15, weight: 500 },
      { key: 'miniTitle', label: 'Mini player: track', size: 17, weight: 700 },
      { key: 'miniArtist', label: 'Mini player: artist', size: 14, weight: 500 }
    ],
    options: [{ key: 'showAlbum', label: 'Album name' }]
  },
  {
    id: 'lyrics',
    label: 'Lyrics',
    icon: 'lyrics',
    slots: [{ key: 'line', label: 'Lyric lines', size: 34, weight: 750 }]
  },
  {
    id: 'clock',
    label: 'Clock',
    icon: 'schedule',
    widget: 'clock',
    slots: [
      { key: 'time', label: 'Time', size: 84, weight: 800 },
      { key: 'date', label: 'Date', size: 21, weight: 600 }
    ],
    options: [{ key: 'showDate', label: 'Date' }]
  },
  {
    id: 'weather',
    label: 'Weather',
    icon: 'wb_sunny',
    widget: 'weather',
    slots: [
      { key: 'temp', label: 'Temperature', size: 52, weight: 800 },
      { key: 'condition', label: 'Condition', size: 16, weight: 600 },
      { key: 'place', label: 'Location', size: 17, weight: 700 },
      { key: 'details', label: 'High / low, rain, feels like', size: 15, weight: 600 },
      { key: 'hourTemp', label: 'Hourly temperatures', size: 16, weight: 700 },
      { key: 'hourTime', label: 'Hourly times', size: 13, weight: 700 }
    ],
    options: [
      { key: 'showCondition', label: 'Condition' },
      { key: 'showPlace', label: 'Location name' },
      { key: 'showDetails', label: 'High / low, rain, feels like' },
      { key: 'showHourly', label: 'Hourly forecast' }
    ]
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: 'event',
    widget: 'calendar',
    slots: [
      { key: 'day', label: 'Day headings', size: 15, weight: 800 },
      { key: 'title', label: 'Event names', size: 18, weight: 700 },
      { key: 'location', label: 'Locations', size: 14, weight: 500 },
      { key: 'time', label: 'Times', size: 15, weight: 700 }
    ],
    options: [
      { key: 'showLocation', label: 'Event locations' },
      { key: 'showTime', label: 'Event times' },
      { key: 'showDayLabels', label: 'Day headings' },
      { key: 'showColor', label: 'Calendar colour bar' },
      { key: 'showCountdown', label: 'Countdown ("in 25 min")', default: false },
      { key: 'tapDetails', label: 'Tap an event for details', default: false }
    ]
  },
  {
    id: 'system',
    label: 'PC stats',
    icon: 'memory',
    widget: 'system',
    slots: [
      { key: 'cpu', label: 'CPU %', size: 58, weight: 800 },
      { key: 'label', label: 'Labels', size: 15, weight: 700 },
      { key: 'sub', label: 'Temperatures', size: 15, weight: 600 },
      { key: 'net', label: 'Network speed', size: 15, weight: 700 }
    ],
    options: [
      { key: 'showGraph', label: 'CPU graph' },
      { key: 'showGpu', label: 'GPU' },
      { key: 'showNetwork', label: 'Network speed' }
    ]
  },
  {
    id: 'mixer',
    label: 'Volume mixer',
    icon: 'volume_up',
    widget: 'mixer',
    slots: [
      { key: 'heading', label: 'Heading', size: 17, weight: 800 },
      { key: 'app', label: 'App names and levels', size: 15, weight: 700 }
    ]
  },
  {
    id: 'timer',
    label: 'Timer',
    icon: 'timer',
    widget: 'timer',
    slots: [
      { key: 'digits', label: 'Time', size: 64, weight: 800 },
      { key: 'label', label: 'Buttons and labels', size: 14, weight: 700 }
    ]
  },
  {
    id: 'macros',
    label: 'Macros',
    icon: 'bolt',
    widget: 'macros',
    slots: [{ key: 'name', label: 'Macro names', size: 14, weight: 700 }],
    options: [{ key: 'showNames', label: 'Names under icons' }]
  }
]

export const WEIGHTS = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra bold' }
]

export type TextStyles = Record<string, { size?: number; weight?: number }>
export type WidgetOptions = Record<string, Record<string, boolean>>

/** CSS variables for a set of text styles (size in %, weight numeric) */
export function textStyleVars(text: TextStyles | undefined, playerScale = 100) {
  const vars: Record<string, string> = {}
  for (const g of TEXT_GROUPS) {
    const master = g.id === 'player' ? text?.player?.size ?? playerScale : text?.[g.id]?.size
    if (master !== undefined && master !== 100) vars[`--t-${g.id}-s`] = String(master / 100)
    for (const s of g.slots) {
      const st = text?.[`${g.id}.${s.key}`]
      if (st?.size !== undefined && st.size !== 100) vars[`--t-${g.id}-${s.key}-s`] = String(st.size / 100)
      if (st?.weight !== undefined && st.weight !== s.weight) vars[`--t-${g.id}-${s.key}-w`] = String(st.weight)
    }
  }
  return vars
}

export function optionValue(options: WidgetOptions | undefined, group: string, key: string) {
  const v = options?.[group]?.[key]
  if (typeof v === 'boolean') return v
  return TEXT_GROUPS.find(g => g.id === group)?.options?.find(o => o.key === key)?.default ?? true
}
