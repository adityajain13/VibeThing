export type RepeatMode = 'off' | 'on' | 'one'

export type Action =
  | 'play'
  | 'pause'
  | 'next'
  | 'previous'
  | 'shuffle'
  | 'repeat'
  | 'volume'
  | 'image'
  | 'seek'
  | 'queue'
  | 'like'

export interface PlaybackData {
  isPlaying: boolean
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  track: {
    id?: string
    liked?: boolean
    name: string
    artists: string[]
    album: string
    duration: {
      current: number
      total: number
    }
  }
  supportedActions: Action[]
}

export interface QueueItem {
  name: string
  artists: string[]
  image?: string
}

export interface LyricLine {
  t: number
  text: string
}

export interface Lyrics {
  key: string
  synced: LyricLine[] | null
  plain: string | null
  instrumental: boolean
}
