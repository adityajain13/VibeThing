import { app } from 'electron'
import path from 'path'
import fs from 'fs'

/**
 * VibeThing used to be "GlanceThing" and shared that app's settings folder.
 * On first run under the new name, copy (not move) the old folder's settings
 * so nothing has to be set up again and the official app is left untouched.
 * Runs before storage is loaded, so it can't use the logger.
 */
export function migrateFromGlanceThing() {
  try {
    const target = app.getPath('userData')
    if (fs.existsSync(path.join(target, 'storage.json'))) return

    const appData = app.getPath('appData')
    const candidates = ['GlanceThing', 'glancething'].map(n => path.join(appData, n))
    // the most recently used one, if several exist (case-sensitive filesystems)
    const source = candidates
      .filter(dir => path.resolve(dir) !== path.resolve(target) && fs.existsSync(path.join(dir, 'storage.json')))
      .sort((a, b) => fs.statSync(path.join(b, 'storage.json')).mtimeMs - fs.statSync(path.join(a, 'storage.json')).mtimeMs)[0]
    if (!source) return

    fs.mkdirSync(target, { recursive: true })
    fs.copyFileSync(path.join(source, 'storage.json'), path.join(target, 'storage.json'))
    // shortcut icons, screensaver image and the downloaded adb tools
    for (const dir of ['shortcuts', 'screensaver', 'platform-tools']) {
      const from = path.join(source, dir)
      if (fs.existsSync(from)) fs.cpSync(from, path.join(target, dir), { recursive: true })
    }
    fs.writeFileSync(
      path.join(target, 'migrated-from-glancething.txt'),
      `Settings copied from ${source} on ${new Date().toISOString()}\n`
    )
    console.log(`[Migrate] Copied settings from ${source}`)
  } catch (err) {
    console.error(`[Migrate] Couldn't copy GlanceThing settings: ${err}`)
  }
}
