import axios from 'axios'

import { log, LogLevel } from './utils.js'

export interface LyricLine {
  /** Start time in ms */
  t: number
  text: string
}

export interface Lyrics {
  key: string
  synced: LyricLine[] | null
  plain: string | null
  instrumental: boolean
}

interface LrclibRecord {
  trackName: string
  artistName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

const cache = new Map<string, Lyrics>()

const client = axios.create({
  baseURL: 'https://lrclib.net/api',
  timeout: 8000,
  headers: {
    'User-Agent': 'GlanceThing-Plus (https://github.com/BluDood/GlanceThing fork)'
  },
  validateStatus: () => true
})

export function lyricsKey(name: string, artists: string[]) {
  return `${name}::${artists.join(',')}`.toLowerCase()
}

export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  const tag = /\[(\d+):(\d+(?:\.\d+)?)\]/g

  for (const raw of lrc.split(/\r?\n/)) {
    const stamps: number[] = []
    let match: RegExpExecArray | null
    let lastIndex = 0
    tag.lastIndex = 0
    while ((match = tag.exec(raw))) {
      stamps.push(
        Math.round((parseInt(match[1]) * 60 + parseFloat(match[2])) * 1000)
      )
      lastIndex = tag.lastIndex
    }
    if (stamps.length === 0) continue
    const text = raw.slice(lastIndex).trim()
    for (const t of stamps) lines.push({ t, text })
  }

  return lines.sort((a, b) => a.t - b.t)
}

/** Strip "(feat. X)", "- Remastered 2011" etc. which often break matching */
function cleanTitle(name: string) {
  return name
    .replace(/\s*[([](feat|ft|with)\.?[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+.*(remaster|version|edit|mix|live|mono|stereo).*$/i, '')
    .trim()
}

function toLyrics(key: string, rec: LrclibRecord | null): Lyrics {
  if (!rec) return { key, synced: null, plain: null, instrumental: false }
  return {
    key,
    synced: rec.syncedLyrics ? parseLrc(rec.syncedLyrics) : null,
    plain: rec.plainLyrics ?? null,
    instrumental: Boolean(rec.instrumental)
  }
}

export async function getLyrics(track: {
  name: string
  artists: string[]
  album: string
  durationMs: number
}): Promise<Lyrics> {
  const key = lyricsKey(track.name, track.artists)
  const cached = cache.get(key)
  if (cached) return cached

  const artist = track.artists[0] ?? ''
  const duration = Math.round(track.durationMs / 1000)
  let record: LrclibRecord | null = null

  try {
    const exact = await client.get('/get', {
      params: {
        track_name: track.name,
        artist_name: artist,
        album_name: track.album,
        duration
      }
    })
    if (exact.status === 200) record = exact.data

    if (!record || (!record.syncedLyrics && !record.instrumental)) {
      const search = await client.get('/search', {
        params: { track_name: cleanTitle(track.name), artist_name: artist }
      })
      if (search.status === 200 && Array.isArray(search.data)) {
        const candidates = (search.data as LrclibRecord[])
          .filter(r => Math.abs(r.duration - duration) <= 5)
          .sort(
            (a, b) =>
              Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics))
          )
        if (candidates[0]) record = candidates[0]
      }
    }
  } catch (err) {
    log(`Lyrics lookup failed: ${err}`, 'Lyrics', LogLevel.WARN)
    // Don't cache network failures, so the next request retries
    return toLyrics(key, null)
  }

  const lyrics = toLyrics(key, record)
  if (cache.size > 300) cache.clear()
  cache.set(key, lyrics)
  return lyrics
}
