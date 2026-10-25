import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'

import { SocketContext } from './SocketContext.tsx'
import { ConfigContext } from './ConfigContext.tsx'

import { applyAccent, extractAccent, FALLBACK_ACCENT, hexToRgb } from '@/lib/accent.ts'

import { Action, Lyrics, PlaybackData, QueueItem, RepeatMode } from '@/types/Playback.js'

interface MediaContextProps {
  image: string | null
  playerData: PlaybackData | null
  playerDataRef: React.MutableRefObject<PlaybackData | null>
  /** Wall-clock time the current position was reported, for local ticking */
  anchorRef: React.MutableRefObject<number>
  lyrics: Lyrics | null
  queue: QueueItem[] | null
  volume: number
  volumeChangedAt: number
  supports: (action: Action) => boolean
  actions: {
    playPause: () => void
    skipForward: () => void
    skipBackward: () => void
    setVolume: (volume: number) => void
    changeVolume: (direction: 1 | -1) => void
    shuffle: (state: boolean) => void
    repeat: (state: RepeatMode) => void
    seek: (positionMs: number) => void
    seekBy: (deltaMs: number) => void
    toggleLike: () => void
    requestQueue: () => void
  }
}

const noop = () => {}

const MediaContext = createContext<MediaContextProps>({
  image: null,
  playerData: null,
  playerDataRef: { current: null },
  anchorRef: { current: 0 },
  lyrics: null,
  queue: null,
  volume: 0,
  volumeChangedAt: 0,
  supports: () => false,
  actions: {
    playPause: noop,
    skipForward: noop,
    skipBackward: noop,
    setVolume: noop,
    changeVolume: noop,
    shuffle: noop,
    repeat: noop,
    seek: noop,
    seekBy: noop,
    toggleLike: noop,
    requestQueue: noop
  }
})

function trackKey(d: PlaybackData | null) {
  if (!d) return null
  return d.track.id ?? `${d.track.name}::${d.track.artists.join(',')}`
}

export function currentPosition(
  data: PlaybackData | null,
  anchor: number
): number {
  if (!data) return 0
  const { current, total } = data.track.duration
  if (!data.isPlaying) return current
  const pos = current + (Date.now() - anchor)
  // Only clamp to a believable length. Browser video often reports no length,
  // or a stale one (e.g. a pre-roll ad), and clamping froze the elapsed time.
  if (total > 0 && pos <= total + 3000) return Math.min(total, pos)
  return pos
}

/** Whether the reported length can be trusted at this position */
export function hasKnownLength(data: PlaybackData | null, position: number) {
  const total = data?.track.duration.total ?? 0
  return total > 0 && position <= total + 3000
}

const MediaContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { ready, socket } = useContext(SocketContext)
  const config = useContext(ConfigContext)

  const [playerData, setPlayerDataState] = useState<PlaybackData | null>(null)
  const playerDataRef = useRef<PlaybackData | null>(null)
  const anchorRef = useRef(Date.now())
  const [image, setImage] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [queue, setQueue] = useState<QueueItem[] | null>(null)

  const [volume, setVolumeState] = useState(0)
  const volumeRef = useRef(0)
  const [volumeChangedAt, setVolumeChangedAt] = useState(0)
  const lastLocalVolume = useRef(0)
  const volumeSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ignore stale server echoes for a moment after an optimistic change
  const lockUntil = useRef(0)
  // covers can arrive a moment after the song (browsers load them late), so retry a few times
  const hasImage = useRef(false)
  const imageTries = useRef({ count: 0, at: 0 })

  function setPlayerData(d: PlaybackData | null) {
    playerDataRef.current = d
    anchorRef.current = Date.now()
    setPlayerDataState(d)
  }

  function send(msg: object) {
    socket?.send(JSON.stringify(msg))
  }

  useEffect(() => {
    if (ready !== true || !socket) return

    const listener = (e: MessageEvent) => {
      const { type, action, data } = JSON.parse(e.data)

      if (type === 'lyrics') {
        setLyrics(data)
        return
      }
      if (type !== 'playback') return

      if (action === 'image') {
        hasImage.current = !!data
        setImage(data ? `data:image/png;base64,${data}` : null)
        return
      }
      if (action === 'queue') {
        setQueue(Array.isArray(data) ? data : [])
        return
      }
      if (action) return

      const next = data as PlaybackData | null
      const prevKey = trackKey(playerDataRef.current)

      if (!next) {
        setPlayerData(null)
        return
      }

      if (Date.now() < lockUntil.current && trackKey(next) === prevKey) {
        // keep optimistic play state but accept a fresh position
        next.isPlaying = playerDataRef.current?.isPlaying ?? next.isPlaying
      }

      setPlayerData(next)

      if (Date.now() - lastLocalVolume.current > 1500) {
        volumeRef.current = next.volume
        setVolumeState(next.volume)
      }

      if (trackKey(next) !== prevKey) {
        setLyrics(null)
        imageTries.current = { count: 1, at: Date.now() }
        send({ type: 'playback', action: 'image' })
        send({ type: 'lyrics' })
      }
    }

    socket.addEventListener('message', listener)
    send({ type: 'playback' })

    return () => socket.removeEventListener('message', listener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, socket])

  // no cover yet for this song: ask again a few times in case it was still loading
  const currentKey = trackKey(playerData)
  const canImage = !!playerData?.supportedActions.includes('image')
  useEffect(() => {
    if (image || !canImage || !currentKey) return
    const id = setInterval(() => {
      if (hasImage.current || imageTries.current.count >= 6) return clearInterval(id)
      imageTries.current = { count: imageTries.current.count + 1, at: Date.now() }
      send({ type: 'playback', action: 'image' })
    }, 3000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, canImage, currentKey])

  // Accent colour follows the album art unless a fixed colour is configured
  useEffect(() => {
    let cancelled = false
    const fixed = config.accent !== 'album' ? hexToRgb(config.accent) : null
    if (fixed) {
      applyAccent(fixed)
      return
    }
    if (!image) {
      applyAccent(FALLBACK_ACCENT)
      return
    }
    extractAccent(image).then(rgb => {
      if (!cancelled) applyAccent(rgb ?? FALLBACK_ACCENT)
    })
    return () => {
      cancelled = true
    }
  }, [image, config.accent])

  const supports = (action: Action) =>
    Boolean(playerDataRef.current?.supportedActions.includes(action))

  function patch(p: Partial<PlaybackData>) {
    const cur = playerDataRef.current
    if (!cur) return
    // re-anchor position so the progress bar doesn't jump
    const position = currentPosition(cur, anchorRef.current)
    setPlayerData({
      ...cur,
      ...p,
      track: {
        ...cur.track,
        ...(p.track ?? {}),
        duration: { ...cur.track.duration, current: p.track?.duration?.current ?? position }
      }
    })
  }

  function seek(positionMs: number) {
    const cur = playerDataRef.current
    if (!cur || !supports('seek')) return
    const pos = Math.max(0, Math.min(cur.track.duration.total - 500, positionMs))
    send({ type: 'playback', action: 'seek', data: { position: pos } })
    patch({ track: { ...cur.track, duration: { ...cur.track.duration, current: pos } } })
  }

  function setVolume(v: number) {
    if (!supports('volume')) return
    const clamped = Math.max(0, Math.min(100, Math.round(v)))
    volumeRef.current = clamped
    setVolumeState(clamped)
    lastLocalVolume.current = Date.now()
    setVolumeChangedAt(Date.now())
    // knob spins fire many events; send the latest value at most every 120ms
    if (volumeSendTimer.current) return
    volumeSendTimer.current = setTimeout(() => {
      volumeSendTimer.current = null
      send({ type: 'playback', action: 'volume', data: { volume: volumeRef.current } })
    }, 120)
  }

  const actions: MediaContextProps['actions'] = {
    playPause: () => {
      const cur = playerDataRef.current
      if (!cur) return
      send({ type: 'playback', action: cur.isPlaying ? 'pause' : 'play' })
      lockUntil.current = Date.now() + 1500
      patch({ isPlaying: !cur.isPlaying })
    },
    skipForward: () => {
      if (!playerDataRef.current) return
      send({ type: 'playback', action: 'next' })
    },
    skipBackward: () => {
      if (!playerDataRef.current) return
      send({ type: 'playback', action: 'previous' })
    },
    setVolume,
    changeVolume: direction =>
      setVolume(volumeRef.current + direction * config.volumeStep),
    shuffle: state => {
      if (!playerDataRef.current) return
      send({ type: 'playback', action: 'shuffle', data: { state } })
      patch({ shuffle: state })
    },
    repeat: state => {
      if (!playerDataRef.current) return
      send({ type: 'playback', action: 'repeat', data: { state } })
      patch({ repeat: state })
    },
    seek,
    seekBy: delta =>
      seek(currentPosition(playerDataRef.current, anchorRef.current) + delta),
    toggleLike: () => {
      const cur = playerDataRef.current
      if (!cur || !supports('like')) return
      const liked = !cur.track.liked
      send({ type: 'playback', action: 'like', data: { state: liked } })
      patch({ track: { ...cur.track, liked } })
    },
    requestQueue: () => {
      if (!supports('queue')) return setQueue([])
      send({ type: 'playback', action: 'queue' })
    }
  }

  return (
    <MediaContext.Provider
      value={{
        image,
        playerData,
        playerDataRef,
        anchorRef,
        lyrics,
        queue,
        volume,
        volumeChangedAt,
        supports,
        actions
      }}
    >
      {children}
    </MediaContext.Provider>
  )
}

/** Current playback position, ticking locally without touching global state */
export function usePosition(intervalMs = 250) {
  const { playerData, anchorRef } = useContext(MediaContext)
  const [pos, setPos] = useState(() => currentPosition(playerData, anchorRef.current))

  useEffect(() => {
    setPos(currentPosition(playerData, anchorRef.current))
    if (!playerData?.isPlaying) return
    const t = setInterval(
      () => setPos(currentPosition(playerData, anchorRef.current)),
      intervalMs
    )
    return () => clearInterval(t)
  }, [playerData, anchorRef, intervalMs])

  return pos
}

/** Index of the active synced lyric line */
export function activeLyricIndex(lyrics: Lyrics | null, positionMs: number) {
  const lines = lyrics?.synced
  if (!lines || lines.length === 0) return -1
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  // small lead so the line appears as it's sung, not after
  const p = positionMs + 250
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].t <= p) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

export { MediaContext, MediaContextProvider }
