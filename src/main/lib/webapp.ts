import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

import {
  buildUnzipCommand,
  execAsync,
  isDev,
  log,
  LogLevel
} from './utils.js'

export async function getWebAppDir() {
  if (isDev() && hasCustomWebApp()) {
    log('Using custom client webapp', 'Client Webapp')
    return path.join(app.getPath('userData'), 'customClient')
  }

  // this fork ships its own client inside the installer (extraResources)
  const bundled = path.join(process.resourcesPath ?? '', 'client')
  if (app.isPackaged && fs.existsSync(path.join(bundled, 'index.html'))) {
    log('Using bundled client webapp', 'Client Webapp')
    return bundled
  }

  if (isDev() && fs.existsSync(path.join(process.cwd(), 'client/dist'))) {
    log('Using local client webapp', 'Client Webapp')
    return path.join(process.cwd(), 'client/dist')
  }

  // this fork always ships its own client; never fall back to the official one
  log('No bundled client webapp found', 'Client Webapp', LogLevel.ERROR)
  throw new Error('webapp_not_bundled')
}

/** A client build available on this PC without downloading (for previews) */
export function getLocalClientDir(): string | null {
  const candidates = [
    app.isPackaged ? path.join(process.resourcesPath, 'client') : null,
    path.join(process.cwd(), 'client/dist'),
    hasCustomWebApp() ? path.join(app.getPath('userData'), 'customClient') : null
  ]
  for (const dir of candidates)
    if (dir && fs.existsSync(path.join(dir, 'index.html'))) return dir
  return null
}

export function hasCustomWebApp() {
  const userData = app.getPath('userData')
  const clientFolder = path.join(userData, 'customClient')

  if (fs.existsSync(clientFolder)) return true

  return false
}

export async function importCustomWebApp() {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'GlanceThing Client', extensions: ['zip'] }]
  })

  if (res.canceled) return false

  const imagePath = res.filePaths[0]

  const userData = app.getPath('userData')
  const clientFolder = path.join(userData, 'customClient')
  const target = path.join(clientFolder, `client.zip`)

  if (!fs.existsSync(`${userData}/customClient`))
    fs.mkdirSync(`${userData}/customClient`)

  fs.copyFileSync(imagePath, target)

  log('Extracting custom client', 'Client Webapp')

  const unzipCommand = buildUnzipCommand(target, clientFolder)
  if (!unzipCommand) {
    log('Failed to find unzip command for platform', 'adb', LogLevel.ERROR)
    throw new Error('adb_platform_not_found')
  }

  const extract = await execAsync(unzipCommand).catch(() => null)

  fs.rmSync(target)

  if (extract === null) {
    log('Failed to extract custom client', 'Client Webapp', LogLevel.ERROR)
    throw new Error('extract_failed')
  }

  if (!fs.existsSync(path.join(clientFolder, 'index.html'))) {
    fs.rmSync(clientFolder, { recursive: true })
    log('Invalid custom client uploaded', 'Client Webapp', LogLevel.ERROR)
    throw new Error('invalid_custom_client')
  }

  log('Extracted custom client', 'Client Webapp')

  return true
}

export async function removeCustomWebApp() {
  const userData = app.getPath('userData')
  const clientFolder = path.join(userData, 'customClient')

  if (fs.existsSync(clientFolder))
    fs.rmSync(clientFolder, { recursive: true })

  return true
}
