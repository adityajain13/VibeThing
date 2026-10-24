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
    // Encrypted values (connection password, Spotify login) use a key tied to
    // the app's own folder, so VibeThing can't read GlanceThing's. Leave them
    // out; fresh ones are made and pushed to the CarThing on install.
    const data = JSON.parse(fs.readFileSync(path.join(source, 'storage.json'), 'utf8'))
    for (const key of Object.keys(data))
      if (key === 'socketPassword' || key.startsWith('playbackConfig.')) delete data[key]
    delete data.installedClientVersion
    fs.writeFileSync(path.join(target, 'storage.json'), JSON.stringify(data, null, 2), 'utf8')
    // shortcut icons and screensaver image (adb is downloaded fresh: a copy of
    // another app's adb can be incomplete or locked by its running server)
    for (const dir of ['shortcuts', 'screensaver']) {
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
