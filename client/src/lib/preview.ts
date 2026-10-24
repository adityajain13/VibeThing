/**
 * Preview mode: the desktop app embeds this client in an iframe with
 * `?preview` to show a live, true-to-device preview while you customise it.
 * There's no server, so a fake socket answers with sample data, and the
 * parent window pushes config / screen changes via postMessage.
 */

export const isPreview =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('preview')

export const PREVIEW_MESSAGE = 'glancething-preview'

export interface PreviewMessage {
  source: typeof PREVIEW_MESSAGE
  config?: unknown
  screen?: number
  fullscreen?: 'cover' | 'lyrics' | 'queue' | null
}

/** Original placeholder lyrics, written for previews */
const LINES = [
  'Streetlights hum along the water',
  'Every window holds a song',
  'We trade our maps for paper boats',
  'And drift where we belong',
  'Neon on the harbour',
  'Painting all the waves in blue',
  'Hold the night a little longer',
  'I’ll keep the lights on for you',
  'Ferry horns and quiet thunder',
  'Counting stars we never knew'
]

function drawCover(hueA: number, hueB: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 300
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 300, 300)
  grad.addColorStop(0, `hsl(${hueA}, 80%, 62%)`)
  grad.addColorStop(1, `hsl(${hueB}, 70%, 45%)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 300, 300)
  g.fillStyle = 'hsl(38, 100%, 68%)'
  g.beginPath()
  g.arc(150, 150, 78, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = `hsl(${hueB}, 60%, 22%)`
  for (let i = 0; i < 8; i++) g.fillRect(0, 186 + i * 10, 300, 4)
  return c.toDataURL('image/png').split(',')[1]
}

type Listener = (e: MessageEvent) => void

export class PreviewSocket {
  readyState = 1
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  private listeners = new Set<Listener>()
  private config: unknown = null
  private cover = ''
  private started = Date.now() - 78000
  private state = {
    isPlaying: true,
    liked: true,
    shuffle: true,
    repeat: 'off' as 'off' | 'on' | 'one',
    volume: 62
  }

  /**
   * Live data: when the desktop app passes its server port + password in the
   * URL hash, connect to it as a read-only guest. Anything that would change
   * state on the PC is dropped, and config always comes from the parent so
   * unsaved edits show. With nothing playing, the sample song stands in.
   */
  private real: WebSocket | null = null
  private realReady = false
  private sample = true

  constructor() {
    window.addEventListener('message', e => {
      const msg = e.data as PreviewMessage
      if (!msg || msg.source !== PREVIEW_MESSAGE || !msg.config) return
      this.config = msg.config
      this.emit({ type: 'config', data: msg.config })
    })
    this.connectReal()
    setTimeout(() => this.onopen?.(), 0)
  }

  private connectReal() {
    const hash = new URLSearchParams(location.hash.slice(1))
    const port = hash.get('port')
    const pw = hash.get('pw')
    if (!port) return
    try {
      const ws = new WebSocket(`ws://localhost:${port}`)
      ws.onopen = () => {
        if (pw) ws.send(JSON.stringify({ type: 'auth', data: pw }))
        this.realReady = true
        this.real = ws
        // refresh everything from the real source
        ws.send(JSON.stringify({ type: 'playback' }))
        ws.send(JSON.stringify({ type: 'apps' }))
        ws.send(JSON.stringify({ type: 'time' }))
      }
      ws.onmessage = e => this.fromReal(e.data as string)
      ws.onclose = () => {
        this.realReady = false
        this.real = null
        this.toSample()
      }
    } catch {
      /* stay on sample data */
    }
  }

  private static DROP_IN = ['config', 'version', 'sleep', 'wake', 'screensaver', 'restore', 'update', 'auth', 'error', 'pong']

  private fromReal(raw: string) {
    let msg: { type: string; action?: string; data?: unknown }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (PreviewSocket.DROP_IN.includes(msg.type)) return
    if (msg.type === 'playback' && !msg.action) {
      if (!msg.data) return this.toSample()
      this.sample = false
    }
    // while showing the sample song, ignore real art/lyrics/queue answers
    if (this.sample && (msg.type === 'lyrics' || (msg.type === 'playback' && msg.action))) return
    const e = new MessageEvent('message', { data: raw })
    this.listeners.forEach(l => l(e))
  }

  private toSample() {
    if (this.sample && this.cover) return
    this.sample = true
    this.emit({ type: 'playback', data: this.playback() })
  }

  /** requests that only read data; everything else stays inside the preview */
  private forwardable(type: string, action?: string) {
    if (type === 'time' || type === 'subscribe') return true
    if (type === 'apps') return !action || action === 'image'
    if (this.sample) return false
    if (type === 'lyrics') return true
    if (type === 'playback') return !action || action === 'image' || action === 'queue'
    return false
  }

  addEventListener(_type: 'message', l: Listener) {
    this.listeners.add(l)
  }

  removeEventListener(_type: 'message', l: Listener) {
    this.listeners.delete(l)
  }

  close() {}

  private emit(msg: object) {
    const e = new MessageEvent('message', { data: JSON.stringify(msg) })
    setTimeout(() => this.listeners.forEach(l => l(e)), 0)
  }

  private playback() {
    const total = 214000
    return {
      isPlaying: this.state.isPlaying,
      volume: this.state.volume,
      shuffle: this.state.shuffle,
      repeat: this.state.repeat,
      track: {
        id: 'preview',
        liked: this.state.liked,
        name: 'Neon Harbour',
        artists: ['The Lowlights'],
        album: 'Night Ferry',
        duration: { current: (Date.now() - this.started) % total, total }
      },
      supportedActions: ['play', 'pause', 'next', 'previous', 'shuffle', 'repeat', 'volume', 'image', 'seek', 'queue', 'like']
    }
  }

  send(raw: string) {
    const { type, action, data } = JSON.parse(raw)
    if (this.realReady && this.real && this.forwardable(type, action)) return this.real.send(raw)
    // playback controls never reach the PC from the preview
    if (!this.sample && type === 'playback' && action) return
    switch (type) {
      case 'ping':
        return this.emit({ type: 'pong' })
      case 'version':
        return this.emit({ type: 'version', data: __VERSION__ })
      case 'config':
        return this.config && this.emit({ type: 'config', data: this.config })
      case 'time': {
        const d = new Date()
        const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
        const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        return this.emit({ type: 'time', data: { time, date } })
      }
      case 'lyrics':
        return this.emit({
          type: 'lyrics',
          data: {
            key: 'preview',
            instrumental: false,
            plain: LINES.join('\n'),
            synced: LINES.map((text, i) => ({ t: 60000 + i * 4500, text }))
          }
        })
      case 'apps':
        return action ? undefined : this.emit({ type: 'apps', data: [] })
      case 'playback':
        return this.playbackAction(action, data)
      case 'subscribe':
        return this.topics(data ?? [])
    }
  }

  private playbackAction(action: string | undefined, data: Record<string, unknown> | undefined) {
    if (action === 'image') {
      this.cover ||= drawCover(320, 265)
      return this.emit({ type: 'playback', action: 'image', data: this.cover })
    }
    if (action === 'queue') {
      const hues = [[20, 340], [190, 230], [140, 200], [270, 300], [50, 20]]
      const names = ['Paper Lanterns', 'Low Tide Static', 'Afterglow Avenue', 'Slow Satellites', 'Glass Weather']
      return this.emit({
        type: 'playback',
        action: 'queue',
        data: names.map((name, i) => ({
          name,
          artists: ['Preview Artist'],
          image: `data:image/png;base64,${drawCover(hues[i][0], hues[i][1])}`
        }))
      })
    }
    if (action === 'play' || action === 'pause') this.state.isPlaying = action === 'play'
    if (action === 'like') this.state.liked = Boolean(data?.state)
    if (action === 'shuffle') this.state.shuffle = Boolean(data?.state)
    if (action === 'repeat') this.state.repeat = data?.state as 'off' | 'on' | 'one'
    if (action === 'volume') this.state.volume = Number(data?.volume ?? this.state.volume)
    if (action === 'next' || action === 'previous') this.started = Date.now()
    this.emit({ type: 'playback', data: this.playback() })
  }

  private topics(topics: string[]) {
    const now = Date.now()
    const samples: Record<string, unknown> = {
      weather: {
        location: 'Preview City',
        units: 'metric',
        current: { temperature: 9, feelsLike: 6, code: 2, isDay: true, wind: 14, humidity: 71 },
        today: { min: 4, max: 11, precipitationChance: 20 },
        hourly: [10, 11, 11, 9, 8, 7].map((temperature, i) => ({
          time: new Date(now + (i + 1) * 3600e3).toISOString(),
          temperature,
          code: [2, 3, 3, 61, 61, 3][i],
          isDay: i < 4
        })),
        daily: [],
        updatedAt: now
      },
      calendar: {
        days: [
          {
            label: 'Today',
            events: [
              { title: 'Team sync', time: '2:00 PM', allDay: false, location: 'Teams', color: '#4f8cff', start: now + 3600e3, end: now + 7200e3 },
              { title: 'Dinner reservation', time: '6:00 PM', allDay: false, location: '25 Main St, Mississauga', color: '#ff7a59', start: now + 5 * 3600e3, end: now + 7 * 3600e3 }
            ]
          },
          {
            label: 'Monday, Oct 26',
            events: [
              { title: 'Gym', time: '7:30 AM', allDay: false, location: 'Community Centre', color: '#2ec27e', start: now + 66 * 3600e3, end: now + 67 * 3600e3 }
            ]
          }
        ]
      },
      system: {
        cpu: { load: 23, temperature: 54, history: Array.from({ length: 30 }, (_, i) => 15 + Math.round(12 * Math.abs(Math.sin(i / 3)))) },
        memory: { used: 17.8e9, total: 32e9, percent: 56 },
        gpu: null,
        network: { down: 2.4e6, up: 180e3 }
      },
      mixer: {
        master: { volume: 64, muted: false },
        mic: { muted: false },
        sessions: [{ id: 'Spotify.exe', name: 'Spotify', volume: 80, muted: false, active: true, icon: null }]
      }
    }
    for (const t of topics) if (samples[t]) this.emit({ type: t, data: samples[t] })
  }
}
