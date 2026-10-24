import { publish, TopicProvider } from '../topics.js'
import { windowsHelper } from '../windowsHelper.js'

interface RawSession {
  pid: number
  name: string
  desc: string
  volume: number
  muted: boolean
  active: boolean
}

interface RawList {
  master?: { volume: number; muted: boolean }
  mic?: { muted: boolean }
  sessions: RawSession[]
}

export interface MixerSession {
  id: string
  name: string
  volume: number
  muted: boolean
  active: boolean
  icon: string | null
}

export type MixerData =
  | {
      master: { volume: number; muted: boolean } | null
      mic: { muted: boolean } | null
      sessions: MixerSession[]
    }
  | { unsupported: true }

const POLL_MS = 1500

let latest: MixerData | null = null
let latestJson = ''
let timer: NodeJS.Timeout | null = null
const icons = new Map<string, string | null>()

function prettyName(desc: string, name: string) {
  const d = (desc || name).replace(/\.exe$/i, '').trim()
  return d.charAt(0).toUpperCase() + d.slice(1)
}

async function icon(name: string, pid: number) {
  if (icons.has(name)) return icons.get(name) ?? null
  if (name === 'system') {
    icons.set(name, null)
    return null
  }
  const res = await windowsHelper.call<{ icon: string | null }>(`icon ${pid}`)
  icons.set(name, res?.icon ?? null)
  return res?.icon ?? null
}

export async function pollMixer() {
  if (!windowsHelper.supported) {
    latest = { unsupported: true }
    publish('mixer', latest)
    return
  }

  const raw = await windowsHelper.call<RawList>('list')
  if (!raw || !Array.isArray(raw.sessions)) return

  // A single app (e.g. a browser) often has several sessions; merge by process
  const byName = new Map<string, RawSession[]>()
  for (const s of raw.sessions) {
    byName.set(s.name, [...(byName.get(s.name) ?? []), s])
  }

  const sessions: MixerSession[] = []
  for (const [name, group] of byName) {
    sessions.push({
      id: name,
      name: prettyName(group[0].desc, name),
      volume: Math.max(...group.map(s => s.volume)),
      muted: group.every(s => s.muted),
      active: group.some(s => s.active),
      icon: await icon(name, group[0].pid)
    })
  }

  sessions.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(a.id === 'system') - Number(b.id === 'system') ||
      a.name.localeCompare(b.name)
  )

  const next: MixerData = {
    master: raw.master ?? null,
    mic: raw.mic ?? null,
    sessions
  }

  const json = JSON.stringify(next)
  latest = next
  if (json === latestJson) return
  latestJson = json
  publish('mixer', latest)
}

export async function setMixerVolume(id: string, volume: number) {
  await windowsHelper.call(
    `volume ${id.replace(/\s/g, '')} ${Math.round(Math.max(0, Math.min(100, volume)))}`
  )
  await pollMixer()
}

/** muted: true / false, or 'toggle' */
export async function setMixerMute(id: string, muted: boolean | 'toggle') {
  const mode = muted === 'toggle' ? 't' : muted ? '1' : '0'
  await windowsHelper.call(`mute ${id.replace(/\s/g, '')} ${mode}`)
  if (timer) await pollMixer()
}

/** App names that can be targeted by a macro "mute" step */
export async function listMixerTargets(): Promise<
  { id: string; name: string }[] | null
> {
  if (!windowsHelper.supported) return null
  const raw = await windowsHelper.call<RawList>('list')
  const seen = new Map<string, string>()
  for (const s of raw?.sessions ?? [])
    if (!seen.has(s.name)) seen.set(s.name, prettyName(s.desc, s.name))
  return [
    { id: 'master', name: 'Master volume' },
    { id: 'mic', name: 'Microphone' },
    ...[...seen].map(([id, name]) => ({ id, name }))
  ]
}

export const mixerProvider: TopicProvider = {
  topic: 'mixer',
  start() {
    latestJson = ''
    pollMixer()
    timer = setInterval(pollMixer, POLL_MS)
  },
  stop() {
    if (timer) clearInterval(timer)
    timer = null
  },
  latest: () => latest
}
