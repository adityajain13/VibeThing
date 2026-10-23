import { app, dialog, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

import { getStorageValue, setStorageValue } from './storage.js'
import { log, LogLevel } from './utils.js'

/**
 * Settings worth carrying between installs or PCs. Deliberately excluded:
 * secrets (socketPassword, playbackConfig.* with Spotify credentials) and
 * machine-specific state (port, setupComplete, devMode, logLevel, ...).
 */
const EXPORTED_KEYS = [
  'clientConfig',
  'macros',
  'shortcuts',
  'calendars',
  'weatherLocation',
  'weatherUnits',
  'timeFormat',
  'dateFormat',
  'sleepMethod',
  'autoBrightness',
  'brightness',
  'installAutomatically',
  'launchOnStartup',
  'launchMinimized'
]

const FORMAT = 'glancething-custom-settings'

interface BackupFile {
  format: typeof FORMAT
  version: number
  appVersion: string
  exportedAt: string
  settings: Record<string, unknown>
  /** shortcut id -> base64 png */
  shortcutImages: Record<string, string>
  /** base64 png */
  screensaverImage: string | null
}

function userPath(...parts: string[]) {
  return path.join(app.getPath('userData'), ...parts)
}

function readBase64(file: string) {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file).toString('base64') : null
  } catch {
    return null
  }
}

export async function exportSettings(): Promise<
  { ok: true; path: string; count: number } | { ok: false; canceled?: boolean; error?: string }
> {
  const settings: Record<string, unknown> = {}
  for (const key of EXPORTED_KEYS) {
    const value = getStorageValue(key)
    if (value !== null && value !== undefined) settings[key] = value
  }

  const shortcutImages: Record<string, string> = {}
  const shortcuts = Array.isArray(settings.shortcuts) ? (settings.shortcuts as { id: string }[]) : []
  for (const s of shortcuts) {
    const img = readBase64(userPath('shortcuts', `${s.id}.png`))
    if (img) shortcutImages[s.id] = img
  }

  const backup: BackupFile = {
    format: FORMAT,
    version: 1,
    appVersion: app.getVersion(),
    exportedAt: new Date().toISOString(),
    settings,
    shortcutImages,
    screensaverImage: readBase64(userPath('screensaver', 'image.png'))
  }

  const date = new Date().toISOString().slice(0, 10)
  const win = BrowserWindow.getFocusedWindow()
  const opts = {
    title: 'Export GlanceThing settings',
    defaultPath: path.join(app.getPath('documents'), `glancething-settings-${date}.json`),
    filters: [{ name: 'GlanceThing settings', extensions: ['json'] }]
  }
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (res.canceled || !res.filePath) return { ok: false, canceled: true }

  try {
    fs.writeFileSync(res.filePath, JSON.stringify(backup, null, 2), 'utf8')
  } catch (err) {
    log(`Export failed: ${err}`, 'Backup', LogLevel.ERROR)
    return { ok: false, error: 'Couldn’t write the file.' }
  }
  log(`Exported settings to ${res.filePath}`, 'Backup')
  return { ok: true, path: res.filePath, count: Object.keys(settings).length }
}

export async function importSettings(): Promise<
  { ok: true; count: number } | { ok: false; canceled?: boolean; error?: string }
> {
  const win = BrowserWindow.getFocusedWindow()
  const opts = {
    title: 'Import GlanceThing settings',
    properties: ['openFile' as const],
    filters: [{ name: 'GlanceThing settings', extensions: ['json'] }]
  }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true }

  let backup: BackupFile
  try {
    backup = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'))
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' }
  }
  if (backup?.format !== FORMAT || typeof backup.settings !== 'object' || !backup.settings) {
    return { ok: false, error: 'That isn’t a GlanceThing settings export.' }
  }

  // images first, so shortcuts/screensaver are ready when their settings land
  const images = backup.shortcutImages && typeof backup.shortcutImages === 'object' ? backup.shortcutImages : {}
  for (const [id, b64] of Object.entries(images)) {
    if (!/^[\w-]+$/.test(id) || typeof b64 !== 'string') continue
    fs.mkdirSync(userPath('shortcuts'), { recursive: true })
    fs.writeFileSync(userPath('shortcuts', `${id}.png`), Buffer.from(b64, 'base64'))
  }
  if (typeof backup.screensaverImage === 'string') {
    fs.mkdirSync(userPath('screensaver'), { recursive: true })
    fs.writeFileSync(userPath('screensaver', 'image.png'), Buffer.from(backup.screensaverImage, 'base64'))
  }

  let count = 0
  for (const key of EXPORTED_KEYS) {
    if (!(key in backup.settings)) continue
    // setStorageValue runs each key's handler, e.g. pushing config to the CarThing
    setStorageValue(key, backup.settings[key])
    count++
  }
  log(`Imported ${count} settings from ${res.filePaths[0]}`, 'Backup')
  return { ok: true, count }
}
