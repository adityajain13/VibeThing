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
