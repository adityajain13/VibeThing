import { BasePlaybackHandler } from './BasePlaybackHandler.js'
import { log, LogLevel } from '../utils.js'
import { windowsHelper } from '../windowsHelper.js'
import {
  getVlcSettings,
  vlcArt,
  vlcCommand,
  vlcHasMedia,
  vlcStatus,
  vlcToPlayback,
  type VlcStatus
} from './vlc.js'

import { PlaybackData, RepeatMode } from '../../types/Playback.js'
import { createRequire } from 'node:module'
import axios from 'axios'

declare class NowPlaying {
  constructor(
    callback: (event: NowPlayingMessage) => void,
    options?: NowPlayingOptions
  )
  subscribe(): Promise<void>
  unsubscribe(): Promise<void>
  sendCommand(command: PlayerCommand): Promise<void>
  play(to?: string | undefined | null): Promise<void>
  pause(to?: string | undefined | null): Promise<void>
  playPause(to?: string | undefined | null): Promise<void>
  nextTrack(to?: string | undefined | null): Promise<void>
  previousTrack(to?: string | undefined | null): Promise<void>
  seekTo(positionMs: number, to?: string | undefined | null): Promise<void>
  setVolume(volume: number, to?: string | undefined | null): Promise<void>
  setShuffle(
    shuffle: boolean,
    to?: string | undefined | null
  ): Promise<void>
}

interface LogMessage {
  /** log level (TRACE, DEBUG, INFO, WARN, ERROR) */
  level: string
  /** log target */
  target: string
  /** log message */
  message: string
  /** timestamp in ISO 8601 format */
  timestamp: string
}

/** now playing info */
interface NowPlayingMessage {
  album?: string
  artist?: Array<string>
  playlist?: string
  playlistId?: string
  trackName: string
  shuffleState?: boolean
  /** "off", "all", "track" */
  repeatState?: string
  isPlaying: boolean
  canFastForward: boolean
  canSkip: boolean
  canLike: boolean
  canChangeVolume: boolean
  canSetOutput: boolean
  trackDuration?: number
  trackProgress?: number
  /** 1.0 = normal speed, 0.5 = half speed, 2.0 = double speed */
  playbackRate?: number
  /** percentage 0-100 */
  volume: number
  /** Name of device that is playing the audio */
  device?: string
  /** A way to identify the current song (if possible - doesn't work on macos) */
  id?: string
  /** a way to identify the current device if needed */
  deviceId?: string
  /** the url of the current song */
  url?: string
  /** either a path on disk or a base64 encoding that includes data:image/png;base64, at the beginning */
  thumbnail?: string
}

interface NowPlayingOptions {
  logLevelDirective?: string
  logCallback?: (event: LogMessage) => void
}

/** Command to send to the player */
interface PlayerCommand {
  /**
   * the id of the device to send the command to
   *
   * if None, the command is sent to all devices; ignored on macos
   */
  to?: string
  data: PlayerCommandData
}

type PlayerCommandData =
  | { type: 'Play' }
  | { type: 'Pause' }
  | { type: 'PlayPause' }
  | { type: 'NextTrack' }
  | { type: 'PreviousTrack' }
  | { type: 'SeekTo'; positionMs: number }
  | { type: 'SetVolume'; volume: number }
  | { type: 'SetShuffle'; shuffle: boolean }

function importAddon() {
  const require = createRequire(import.meta.url)

  if (process.platform === 'win32') {
    if (process.arch === 'x64') {
      try {
        return require('node-nowplaying-win32-x64-msvc')
      } catch {
        log('Failed to import native addon', 'Native')
        return null
      }
    }
  } else if (process.platform === 'darwin') {
    try {
      return require('node-nowplaying-darwin-universal')
    } catch {
      log('Failed to import native addon', 'Native')
      return null
    }
  } else if (process.platform === 'linux') {
    if (process.arch === 'x64') {
      try {
        return require('node-nowplaying-linux-x64-gnu')
      } catch {
        log('Failed to import native addon', 'Native')
        return null
      }
    }
  }

  log('No native addon available for this platform', 'Native')
  return null
}

export function filterData(data: NowPlayingMessage): PlaybackData | null {
  const {
    isPlaying,
    volume,
    shuffleState,
    repeatState,
    trackName,
    artist,
    album,
    trackDuration,
    trackProgress,
    canChangeVolume,
    canSkip,
    canFastForward
  } = data

  if (!trackName) {
    return null
  }

  const repeatStateMap: Record<string, RepeatMode> = {
    off: 'off',
    all: 'on',
    track: 'one'
  }

  const playbackData: PlaybackData = {
    isPlaying,
    volume,
    shuffle: shuffleState ?? false,
    repeat: repeatStateMap[repeatState ?? 'off'],
    track: {
      id: data.id ?? `${trackName}::${(artist ?? []).join(',')}`,
      name: trackName,
      artists: artist ?? [],
      album: album ?? '',
      duration: {
        current: (trackProgress ?? 0) / 10000,
        total: (trackDuration ?? 0) / 10000
      }
    },
    supportedActions: ['play', 'pause']
  }

  if (canChangeVolume) playbackData.supportedActions.push('volume')
  if (canSkip) playbackData.supportedActions.push('next', 'previous')
  if (data.thumbnail) playbackData.supportedActions.push('image')
  if (canFastForward && trackDuration) playbackData.supportedActions.push('seek')

  return playbackData
}

/** What Windows itself reports for the current media session (see windowsHelper) */
interface WindowsTimeline {
  ok: boolean
  session?: boolean
  error?: string
  app?: string
  title?: string
  status?: string
  rate?: number
  start?: number
  end?: number
  position?: number
  updated?: number
  now?: number
}

const norm = (t: string | undefined) => (t ?? '').trim().toLowerCase()

class NativeHandler extends BasePlaybackHandler {
  name: string = 'native'
  requiresInternet: boolean = false

  instance: NowPlaying | null = null
  current: NowPlayingMessage | null = null
  /** when `current` arrived, so later reads can report the live position */
  receivedAt = 0

  /**
   * Length/position read straight from Windows. The addon's values can be
   * missing or stale for browser video (YouTube), so this corrects them.
   */
  timeline: { title: string; duration: number; position: number; at: number; playing: boolean } | null = null
  private timelineTimer: NodeJS.Timeout | null = null
  private lastSent: { duration: number; position: number; at: number } | null = null

  /** VLC via its web interface takes over while it's playing (optional) */
  private vlc: VlcStatus | null = null
  private vlcAt = 0
  private vlcActive = false
  private vlcSig = ''
  private vlcTimer: NodeJS.Timeout | null = null

  private vlcData(): PlaybackData | null {
    if (!this.vlc) return null
    const data = vlcToPlayback(this.vlc)
    if (data.isPlaying) {
      const t = data.track.duration
      t.current = Math.min(t.total || Infinity, t.current + (Date.now() - this.vlcAt))
    }
    return data
  }

  private async pollVlc() {
    if (!getVlcSettings().enabled) {
      if (this.vlcActive) {
        this.vlcActive = false
        this.emit('playback', await this.getPlayback())
      }
      return
    }
    const s = await vlcStatus()
    const nativePlaying = !!this.current?.isPlaying
    const active = vlcHasMedia(s) && (s.state === 'playing' || (!nativePlaying && (this.vlcActive || !this.current)))
    if (!active) {
      if (this.vlcActive) {
        this.vlcActive = false
        this.vlc = null
        log('VLC stopped; back to Windows media', 'Native')
        this.emit('playback', await this.getPlayback())
      }
      return
    }
    const before = this.vlcData()
    this.vlc = s
    this.vlcAt = Date.now()
    const data = this.vlcData()!
    const sig = [data.track.id, data.isPlaying, data.volume, data.shuffle, data.repeat, Math.round(data.track.duration.total / 1000)].join('|')
    const drift = before ? Math.abs(before.track.duration.current - data.track.duration.current) : Infinity
    if (!this.vlcActive) log(`Using VLC: ${data.track.name}`, 'Native')
    if (!this.vlcActive || sig !== this.vlcSig || drift > 2000) {
      this.vlcActive = true
      this.vlcSig = sig
      this.emit('playback', data)
    }
  }

  private async afterVlcCommand() {
    await new Promise(r => setTimeout(r, 150))
    this.vlcSig = ''
    await this.pollVlc()
  }
  private loggedFor = ''
  private timelineErrors = 0
  private timelineSkips = 0

  private async pollTimeline() {
    const cur = this.current
    // VLC owns the card, or nothing is playing: no need to ask Windows every second
    if (!cur || this.vlcActive) return
    if (!cur.isPlaying && this.timeline && this.timelineSkips++ % 5 !== 0) return
    const t = await windowsHelper.call<WindowsTimeline>('timeline')
    if (!t || !t.ok) {
      if (t?.error && this.timelineErrors++ < 3)
        log(`Windows timeline unavailable: ${t.error}`, 'Native', LogLevel.WARN)
      return
    }
    if (!t.session || norm(t.title) !== norm(cur.trackName) || !t.end || t.end <= (t.start ?? 0)) {
      this.timeline = null
      return
    }
    const start = t.start ?? 0
    const duration = t.end - start
    const playing = t.status === 'Playing'
    let position = (t.position ?? 0) - start
    // Windows gives the position as of `updated`; advance it to now
    if (playing && t.updated && t.now) position += Math.max(0, t.now - t.updated) * (t.rate || 1)
    position = Math.max(0, Math.min(duration, position))
    this.timeline = { title: cur.trackName, duration, position, at: Date.now(), playing }

    if (this.loggedFor !== cur.trackName) {
      this.loggedFor = cur.trackName
      log(
        `Timeline for "${cur.trackName}" (${t.app}): Windows ${Math.round(position / 1000)}s / ${Math.round(duration / 1000)}s, ` +
          `addon ${Math.round((cur.trackProgress ?? 0) / 10000 / 1000)}s / ${Math.round((cur.trackDuration ?? 0) / 10000 / 1000)}s`,
        'Native'
      )
    }

    // only push to the CarThing when it would otherwise be visibly wrong
    const last = this.lastSent
    const predicted = last ? last.position + (playing ? Date.now() - last.at : 0) : -1
    if (!last || Math.abs(last.duration - duration) > 1000 || Math.abs(predicted - position) > 2000) {
      const data = await this.getPlayback()
      if (data) this.emit('playback', data)
    }
  }

  /** Overlay the Windows timeline onto addon data for the same track */
  private applyTimeline(data: PlaybackData) {
    const tl = this.timeline
    if (!data || !tl || norm(tl.title) !== norm(data.track.name) || Date.now() - tl.at > 5000) return data
    data.track.duration.total = tl.duration
    data.track.duration.current = Math.min(tl.duration, tl.position + (tl.playing && data.isPlaying ? Date.now() - tl.at : 0))
    this.lastSent = { duration: tl.duration, position: data.track.duration.current, at: Date.now() }
    return data
  }

  async setup(): Promise<void> {
    log('Setting up', 'Native')

    this.vlcTimer = setInterval(() => {
      this.pollVlc().catch(err => log(`VLC poll failed: ${err}`, 'Native', LogLevel.WARN))
    }, 1000)

    const addon = importAddon()
    if (!addon) return

    const instance = new addon.NowPlaying(
      async (event: NowPlayingMessage) => {
        const data = filterData(event)
        if (data) {
          if (this.current && norm(this.current.trackName) !== norm(event.trackName)) this.timeline = null
          this.current = event
          this.receivedAt = Date.now()
          // VLC is showing; Windows updates would make the card flicker
          if (this.vlcActive) return
          this.emit('playback', this.applyTimeline(data))
        }
      }
    ) as NowPlaying

    await instance.subscribe()

    this.instance = instance

    if (windowsHelper.supported) {
      this.timelineTimer = setInterval(() => {
        this.pollTimeline().catch(err => log(`Timeline poll failed: ${err}`, 'Native', LogLevel.WARN))
      }, 1000)
    }
  }

  async cleanup(): Promise<void> {
    log('Cleaning up', 'Native')

    if (this.timelineTimer) clearInterval(this.timelineTimer)
    this.timelineTimer = null
    if (this.vlcTimer) clearInterval(this.vlcTimer)
    this.vlcTimer = null
    this.vlcActive = false
    this.vlc = null
    this.timeline = null
    this.lastSent = null
    this.instance?.unsubscribe()
    this.instance = null
    this.removeAllListeners()
  }

  async validateConfig(): Promise<boolean> {
    return true
  }

  async getPlayback(): Promise<PlaybackData> {
    if (this.vlcActive) return this.vlcData()
    if (!this.current) return null
    const data = filterData(this.current)
    // the last event's progress is as old as the event; advance it to now,
    // otherwise a client asking later gets a stale elapsed time
    if (data && data.isPlaying) {
      const rate = this.current.playbackRate ?? 1
      const advanced = data.track.duration.current + (Date.now() - this.receivedAt) * rate
      const total = data.track.duration.total
      data.track.duration.current = total > 0 ? Math.min(total, advanced) : advanced
    }
    return this.applyTimeline(data)
  }

  async play(): Promise<void> {
    if (this.vlcActive) return void (await vlcCommand('pl_forceresume'), await this.afterVlcCommand())
    if (!this.instance) return

    await this.instance.play()
  }

  async pause(): Promise<void> {
    if (this.vlcActive) return void (await vlcCommand('pl_forcepause'), await this.afterVlcCommand())
    if (!this.instance) return

    await this.instance.pause()
  }

  async setVolume(volume: number): Promise<void> {
    if (this.vlcActive)
      return void (await vlcCommand('volume', Math.round((volume / 100) * 256)), await this.afterVlcCommand())
    if (!this.instance) return

    await this.instance.setVolume(volume)
  }

  async next(): Promise<void> {
    if (this.vlcActive) return void (await vlcCommand('pl_next'), await this.afterVlcCommand())
    if (!this.instance) return

    await this.instance.nextTrack()
  }

  async previous(): Promise<void> {
    if (this.vlcActive) return void (await vlcCommand('pl_previous'), await this.afterVlcCommand())
    if (!this.instance) return

    await this.instance.previousTrack()
  }

  async seek(positionMs: number): Promise<void> {
    if (this.vlcActive)
      return void (await vlcCommand('seek', Math.max(0, Math.round(positionMs / 1000))), await this.afterVlcCommand())
    if (!this.instance) return

    await this.instance.seekTo(positionMs)
  }

  async shuffle(state: boolean): Promise<void> {
    if (!this.vlcActive || !this.vlc) throw new Error('Not implemented')
    if (!!this.vlc.random !== state) await vlcCommand('pl_random')
    await this.afterVlcCommand()
  }

  async repeat(state: RepeatMode): Promise<void> {
    if (!this.vlcActive || !this.vlc) throw new Error('Not implemented')
    // VLC has two toggles: loop (all) and repeat (one)
    const wantLoop = state === 'on'
    const wantOne = state === 'one'
    if (!!this.vlc.loop !== wantLoop) await vlcCommand('pl_loop')
    if (!!this.vlc.repeat !== wantOne) await vlcCommand('pl_repeat')
    await this.afterVlcCommand()
  }

  async getImage(): Promise<Buffer | null> {
    if (this.vlcActive) return vlcArt(this.vlc)
    const thumb = this.current?.thumbnail
    if (!thumb) return null

    if (thumb.startsWith('data:image')) {
      const base64 = thumb.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64, 'base64')
      return buffer
    } else if (
      thumb.startsWith('https://') ||
      thumb.startsWith('http://')
    ) {
      const res = await axios.get(thumb, {
        responseType: 'arraybuffer'
      })

      return res.data
    } else return null
  }
}

export default new NativeHandler()
