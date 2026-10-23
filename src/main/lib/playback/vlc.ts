import axios from 'axios'
import fs from 'fs'
import { fileURLToPath } from 'url'

import { getStorageValue } from '../storage.js'

import { PlaybackData } from '../../types/Playback.js'

/**
 * VLC's built-in web interface (Preferences > All > Interface > Main
 * interfaces > Web, password under Lua). Lets VibeThing read and control VLC
 * without the SMTC plugin. https://wiki.videolan.org/VLC_HTTP_requests
 */

export interface VlcSettings {
  enabled: boolean
  port: number
}

interface VlcStatus {
  state: 'playing' | 'paused' | 'stopped'
  time: number
  length: number
  position: number
  volume: number
  random: boolean
  loop: boolean
  repeat: boolean
  information?: { category?: { meta?: Record<string, string> } }
}

export function getVlcSettings(): VlcSettings {
  const s = (getStorageValue('vlc') ?? {}) as Partial<VlcSettings>
  return { enabled: s.enabled === true, port: Number(s.port) || 8080 }
}

function password() {
  return (getStorageValue('vlcPassword', true) as string | null) ?? ''
}

async function request(
  path: string,
  params?: Record<string, string | number>,
  opts: { port?: number; password?: string } = {}
) {
  const { port } = getVlcSettings()
  return axios.get(`http://127.0.0.1:${opts.port ?? port}${path}`, {
    params,
    auth: { username: '', password: opts.password ?? password() },
    timeout: 1500,
    validateStatus: s => s < 500
  })
}

export type { VlcStatus }

export async function vlcStatus(): Promise<VlcStatus | null> {
  try {
    const res = await request('/requests/status.json')
    return res.status === 200 && res.data && typeof res.data === 'object' ? (res.data as VlcStatus) : null
  } catch {
    return null
  }
}

/** For the settings page: 'ok' | 'auth' (wrong password) | 'offline' */
export async function testVlc(port: number, pw: string): Promise<'ok' | 'auth' | 'offline'> {
  try {
    const res = await request('/requests/status.json', undefined, { port, password: pw })
    if (res.status === 401) return 'auth'
    return res.status === 200 ? 'ok' : 'offline'
  } catch {
    return 'offline'
  }
}

export function vlcCommand(command: string, val?: string | number) {
  return request('/requests/status.json', val === undefined ? { command } : { command, val }).catch(() => null)
}

export function vlcHasMedia(s: VlcStatus | null): s is VlcStatus {
  return !!s && s.state !== 'stopped' && (s.length > 0 || !!s.information?.category?.meta)
}

export function vlcToPlayback(s: VlcStatus): NonNullable<PlaybackData> {
  const meta = s.information?.category?.meta ?? {}
  const name = meta.title || (meta.filename ?? 'VLC').replace(/\.[^.]+$/, '')
  const total = Math.max(0, s.length * 1000)
  const current = total > 0 && s.position >= 0 ? s.position * total : s.time * 1000
  return {
    isPlaying: s.state === 'playing',
    // VLC's volume runs 0-512 (256 = 100%)
    volume: Math.min(100, Math.round((s.volume / 256) * 100)),
    shuffle: !!s.random,
    repeat: s.repeat ? 'one' : s.loop ? 'on' : 'off',
    track: {
      id: `vlc::${meta.filename ?? name}`,
      name,
      artists: meta.artist ? [meta.artist] : [],
      album: meta.album ?? '',
      duration: { current, total }
    },
    supportedActions: ['play', 'pause', 'next', 'previous', 'seek', 'volume', 'shuffle', 'repeat', 'image']
  }
}

export async function vlcArt(s: VlcStatus | null): Promise<Buffer | null> {
  try {
    const res = await axios.get(`http://127.0.0.1:${getVlcSettings().port}/art`, {
      auth: { username: '', password: password() },
      responseType: 'arraybuffer',
      timeout: 2000,
      validateStatus: () => true
    })
    if (res.status === 200 && res.data?.byteLength) return Buffer.from(res.data)
  } catch {
    /* fall through to the file path */
  }
  const url = s?.information?.category?.meta?.artwork_url
  if (url?.startsWith('file:')) {
    try {
      return fs.readFileSync(fileURLToPath(url))
    } catch {
      return null
    }
  }
  return null
}
