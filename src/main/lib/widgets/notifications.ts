import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'

import { getStorageValue } from '../storage.js'
import { publish, TopicProvider } from '../topics.js'
import { log, LogLevel } from '../utils.js'

export interface CarThingNotification {
  id: number
  title: string
  body: string
  source: string
  at: number
}

const POLL_MS = 2000
const MAX_PER_POLL = 3
const SCOPE = 'Notifications'

let lastId = 0
// false until the database has been read once, so old toasts are never replayed
let baselined = false
let timer: NodeJS.Timeout | null = null
let warned = false

function warnOnce(err: unknown) {
  if (warned) return
  warned = true
  log(`Couldn't read Windows notifications: ${(err as Error).message}`, SCOPE, LogLevel.WARN)
}

function dbPath() {
  return path.join(
    process.env.LOCALAPPDATA ?? '',
    'Microsoft',
    'Windows',
    'Notifications',
    'wpndatabase.db'
  )
}

function copyDir() {
  return path.join(app.getPath('temp'), 'vibething-wpn')
}

/**
 * Windows keeps wpndatabase.db open, so the database (and its WAL file)
 * is copied first and only the copy is opened.
 */
function openCopy(): DatabaseSync {
  const dir = copyDir()
  fs.mkdirSync(dir, { recursive: true })
  for (const f of ['wpn.db', 'wpn.db-wal', 'wpn.db-shm']) {
    try {
      fs.rmSync(path.join(dir, f), { force: true })
    } catch {
      // ignore, the copy below will overwrite or fail
    }
  }

  const src = dbPath()
  const dest = path.join(dir, 'wpn.db')
  fs.copyFileSync(src, dest)
  if (fs.existsSync(`${src}-wal`)) fs.copyFileSync(`${src}-wal`, `${dest}-wal`)

  return new DatabaseSync(dest)
}

function readMaxId(): number {
  const db = openCopy()
  try {
    const row = db.prepare('SELECT MAX(Id) AS id FROM Notification').get() as
      | { id: number | null }
      | undefined
    return Number(row?.id ?? 0)
  } finally {
    db.close()
  }
}

function decodeXml(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Pull the title, body and source out of a toast XML payload */
function parseToast(xml: string) {
  const content: string[] = []
  let source = ''
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const text = decodeXml(m[2].replace(/<[^>]*>/g, '')).trim()
    if (!text) continue
    if (/placement="attribution"/.test(m[1])) {
      source = text.replace(/^via\s+/i, '')
    } else {
      content.push(text)
    }
  }
  return {
    title: content[0] ?? '',
    body: content.slice(1).join(' '),
    source
  }
}

async function poll() {
  if (!baselined) {
    try {
      lastId = readMaxId()
      baselined = true
      warned = false
    } catch (err) {
      warnOnce(err)
    }
    return
  }

  let rows: { id: number; payload: unknown; app: string | null }[]
  try {
    const db = openCopy()
    try {
      rows = db
        .prepare(
          `SELECT n.Id AS id, n.Payload AS payload, h.PrimaryId AS app
           FROM Notification n
           LEFT JOIN NotificationHandler h ON h.RecordId = n.HandlerId
           WHERE n.Type = 'toast' AND n.Id > ?
           ORDER BY n.Id`
        )
        .all(lastId) as typeof rows
    } finally {
      db.close()
    }
    warned = false
  } catch (err) {
    warnOnce(err)
    return
  }

  if (rows.length === 0) return

  const filter = String(getStorageValue('notificationFilter') ?? 'messages.google.com')
    .trim()
    .toLowerCase()

  const kept: CarThingNotification[] = []
  for (const row of rows) {
    lastId = Math.max(lastId, Number(row.id))

    const p = row.payload
    if (p === null || p === undefined) continue
    const xml = typeof p === 'string' ? p : Buffer.from(p as Uint8Array).toString('utf8')

    if (filter && !xml.toLowerCase().includes(filter) && !(row.app ?? '').toLowerCase().includes(filter)) {
      continue
    }

    const { title, body, source } = parseToast(xml)
    if (!title && !body) continue

    kept.push({ id: Number(row.id), title, body, source, at: Date.now() })
  }

  for (const n of kept.slice(-MAX_PER_POLL)) {
    log('Forwarded a notification', SCOPE, LogLevel.DEBUG)
    publish('notifications', n)
  }
}

export const notificationsProvider: TopicProvider = {
  topic: 'notifications',
  async start() {
    if (process.platform !== 'win32') return

    baselined = false
    if (timer) clearInterval(timer)
    timer = setInterval(poll, POLL_MS)
    await poll()
  },
  stop() {
    if (timer) clearInterval(timer)
    timer = null
  },
  latest: () => null
}

/** Checks that the Windows notification database can be read */
export function testNotificationAccess(): { ok: boolean; error?: string } {
  if (process.platform !== 'win32') return { ok: false, error: 'Windows only' }
  try {
    const db = openCopy()
    try {
      db.prepare('SELECT COUNT(*) AS c FROM Notification').get()
    } finally {
      db.close()
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
