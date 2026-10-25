import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import WebSocket, { WebSocketServer } from 'ws'

import { log, LogLevel, safeParse } from './utils.js'

/** Port the VibeThing browser extension connects to (localhost only) */
export const BRIDGE_PORT = 47321

/** What the extension reports about the tab that's playing */
export interface BrowserMedia {
  site: 'youtube' | 'ytmusic'
  title: string
  videoId: string | null
  playing: boolean
  /** null when the page has no like button (e.g. signed out, ads) */
  liked: boolean | null
}

const norm = (t: string | undefined | null) => (t ?? '').trim().toLowerCase()

class BrowserBridge extends (EventEmitter as new () => TypedEmitter<{
  change: (media: BrowserMedia | null) => void
}>) {
  private wss: WebSocketServer | null = null
  private sockets = new Set<WebSocket>()
  private media: BrowserMedia | null = null
  private mediaAt = 0

  start() {
    if (this.wss) return
    const wss = new WebSocketServer({
      host: '127.0.0.1',
      port: BRIDGE_PORT,
      // websites can't fake their origin, so this keeps it to browser extensions
      verifyClient: ({ origin }) =>
        typeof origin === 'string' && /^(chrome|moz)-extension:\/\//.test(origin)
    })
    wss.on('error', err => {
      log(`Browser extension bridge unavailable: ${err.message}`, 'BrowserBridge', LogLevel.WARN)
      this.wss = null
    })
    wss.on('listening', () => log(`Listening for the browser extension on ${BRIDGE_PORT}`, 'BrowserBridge'))
    wss.on('connection', ws => {
      this.sockets.add(ws)
      log('Browser extension connected', 'BrowserBridge')
      ws.on('message', raw => {
        const msg = safeParse(raw.toString())
        if (msg?.type !== 'media') return
        this.update(msg.data ? (msg.data as BrowserMedia) : null)
      })
      ws.on('close', () => {
        this.sockets.delete(ws)
        if (this.sockets.size === 0) this.update(null)
      })
    })
    this.wss = wss
  }

  stop() {
    for (const ws of this.sockets) ws.terminate()
    this.sockets.clear()
    this.wss?.close()
    this.wss = null
    this.media = null
  }

  get connected() {
    return this.sockets.size > 0
  }

  private update(media: BrowserMedia | null) {
    const before = JSON.stringify(this.media)
    this.media = media
    this.mediaAt = Date.now()
    if (JSON.stringify(media) !== before) this.emit('change', media)
  }

  /** The browser's media, if it's the same thing Windows says is playing */
  matching(title: string | undefined): BrowserMedia | null {
    const m = this.media
    if (!m || !this.connected || Date.now() - this.mediaAt > 20000) return null
    const a = norm(m.title)
    const b = norm(title)
    if (!a || !b) return null
    // YouTube sometimes appends " - YouTube" or trims long titles differently
    return a === b || a.startsWith(b) || b.startsWith(a) ? m : null
  }

  /** Ask the extension to set the like state; resolves once the page confirms */
  async setLiked(liked: boolean): Promise<boolean> {
    if (!this.media || !this.connected) return false
    const videoId = this.media.videoId
    const payload = JSON.stringify({ type: 'like', data: { liked, videoId } })
    for (const ws of this.sockets) ws.send(payload)
    return new Promise(resolve => {
      const done = (ok: boolean) => {
        clearTimeout(timer)
        this.off('change', onChange)
        resolve(ok)
      }
      const onChange = (m: BrowserMedia | null) => {
        if (m?.liked === liked) done(true)
      }
      const timer = setTimeout(() => done(this.media?.liked === liked), 2500)
      this.on('change', onChange)
    })
  }
}

export const browserBridge = new BrowserBridge()
