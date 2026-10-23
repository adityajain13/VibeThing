// Shared shape of the configuration that is pushed to the CarThing client.
// Keep in sync with client/src/types/Config.d.ts

export type WidgetId =
  | 'player'
  | 'apps'
  | 'controls'
  | 'lyrics'
  | 'weather'
  | 'system'
  | 'calendar'
  | 'mixer'
  | 'macros'
  | 'clock'

export interface Screen {
  id: string
  name: string
  /** Each inner array is a column, rendered top to bottom */
  columns: WidgetId[][]
}

export type PlaybackButtonAction =
  | 'playPause'
  | 'next'
  | 'previous'
  | 'shuffle'
  | 'repeat'
  | 'like'
  | 'volumeUp'
  | 'volumeDown'
  | 'seekForward'
  | 'seekBackward'

export type ButtonAction =
  | { type: 'none' }
  | { type: 'screen'; index: number }
  | { type: 'nextScreen' }
  | { type: 'prevScreen' }
  | { type: 'focus'; widget: number }
  | { type: 'playback'; action: PlaybackButtonAction }
  | { type: 'fullscreen'; view?: 'cover' | 'lyrics' | 'queue' }
  | { type: 'macro'; id: string }
  | { type: 'app'; id: string }
  | { type: 'lock' }

export type PresetKey = '1' | '2' | '3' | '4'

export interface ButtonMapping {
  press: ButtonAction
  hold: ButtonAction
}

export interface PlayerLayout {
  /** auto picks by widget height; stacked = cover above text; side = cover left */
  layout: 'auto' | 'stacked' | 'side'
  /** Cover size as a percentage of the space available to it (40-100) */
  coverSize: number
  /** Horizontal placement of the cover in the stacked layout */
  coverAlign: 'left' | 'center' | 'right'
  textAlign: 'left' | 'center'
  /** Percent scale for track title / artist / lyric line (70-150) */
  textScale: number
  /** Percent scale for the playback buttons (70-150) */
  controlsScale: number
  showProgress: boolean
  showTimes: boolean
  showControls: boolean
  showLike: boolean
  /** Blurred album-art glow behind the widget */
  glow: boolean
}

export interface ClientConfig {
  screens: Screen[]
  buttons: Record<PresetKey, ButtonMapping>
  knob: {
    /** What turning the knob does when no widget is focused */
    idle: 'volume' | 'screens' | 'none'
    /** What pressing the knob does when no widget is focused */
    press: ButtonAction
  }
  /** Volume change per knob tick, in percent */
  volumeStep: number
  /** Seek step for seekForward/seekBackward, in seconds */
  seekStep: number
  /** 'album' derives the accent from the cover art, otherwise a hex colour */
  accent: string
  /** Show the synced lyric line under the track on the home player */
  playerLyricsLine: boolean
  player: PlayerLayout
  /** Text styles keyed "group" (whole-widget size %) or "group.slot" */
  text: Record<string, { size?: number; weight?: number }>
  /** Show/hide options per widget group, e.g. options.calendar.showLocation */
  options: Record<string, Record<string, boolean>>
  /** dark = grey panels; black = pure black with hairlines; black-flat = no hairlines */
  theme: 'dark' | 'black' | 'black-flat'
}

export type MacroStep =
  | { type: 'keys'; keys: string }
  | { type: 'command'; command: string }
  | { type: 'url'; url: string }
  | { type: 'delay'; ms: number }
  | { type: 'playback'; action: PlaybackButtonAction }
  | { type: 'app'; id: string }
  | { type: 'mute'; target: string }

export interface Macro {
  id: string
  name: string
  icon: string
  color: string
  steps: MacroStep[]
}

export type PublicMacro = Pick<Macro, 'id' | 'name' | 'icon' | 'color'>

export interface WeatherLocation {
  name: string
  latitude: number
  longitude: number
}
