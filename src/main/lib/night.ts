import { getClientConfig } from './config.js'
import { getStorageValue } from './storage.js'
import { serverManager } from './server.js'
import { setAutoBrightness, setBrightnessSmooth } from './adb.js'
import { log, LogLevel } from './utils.js'

/**
 * Night mode: between two times of day the CarThing is dimmed and (optionally)
 * shows only a clock. Decided here because the PC has a reliable clock and
 * adb access to the backlight; the client is told via a 'night' message.
 */

let active = false

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function isNightTime(start: string, end: string, d = new Date()) {
  const now = d.getHours() * 60 + d.getMinutes()
  const s = minutes(start)
  const e = minutes(end)
  if (s === e) return false
  // a window like 23:00-07:00 wraps past midnight
  return s < e ? now >= s && now < e : now >= s || now < e
}

export function nightMessage() {
  const { night } = getClientConfig().behaviour
  return { active, clockOnly: night.clockOnly }
}

async function applyBrightness(on: boolean) {
  const { night } = getClientConfig().behaviour
  try {
    if (on) {
      if (getStorageValue('autoBrightness') === true) await setAutoBrightness(null, false)
      await setBrightnessSmooth(null, Math.max(0.01, night.brightness / 100))
    } else if (getStorageValue('autoBrightness') === true) {
      await setAutoBrightness(null, true)
    } else {
      const b = getStorageValue('brightness')
      await setBrightnessSmooth(null, typeof b === 'number' ? b : 1)
    }
  } catch (err) {
    log(`Couldn't change brightness: ${err}`, 'Night', LogLevel.WARN)
  }
}

/** Re-evaluate now; call on a timer and whenever the config changes */
export async function checkNight() {
  const { night } = getClientConfig().behaviour
  const should = night.enabled && isNightTime(night.start, night.end)
  if (should === active) {
    // still push clockOnly changes while active
    serverManager.broadcast('night', nightMessage())
    return
  }
  active = should
  log(`Night mode ${active ? 'on' : 'off'}`, 'Night')
  serverManager.broadcast('night', nightMessage())
  await applyBrightness(active)
}

/** Restore normal brightness, e.g. when the server stops mid-night */
export async function endNight() {
  if (!active) return
  active = false
  await applyBrightness(false)
}
