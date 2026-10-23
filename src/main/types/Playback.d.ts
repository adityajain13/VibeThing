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

export type PlaybackData = {
  isPlaying: boolean
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  track: {
    /** Stable identifier for the item, e.g. a Spotify URI */
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
} | null

export type PlaybackHandlerEvents = {
  playback: (data: PlaybackData) => void
  image: (data: string) => void
  open: (handlerName?: string) => void
  close: () => void
  error: (err: Error) => void
}

export interface QueueItem {
  name: string
  artists: string[]
  image?: string
}
