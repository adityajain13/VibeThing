import { exec } from 'child_process'
import { shell } from 'electron'

import { getMacros } from './config.js'
import { playbackManager } from './playback/playback.js'
import { getShortcuts } from './shortcuts.js'
import { getParsedPlatformCommand, log, LogLevel } from './utils.js'
import { sendKeys } from './windowsHelper.js'
import { setMixerMute } from './widgets/mixer.js'

import { MacroStep, PlaybackButtonAction } from '../types/Config.js'

const SEEK_STEP_MS = 10000

export async function runPlaybackAction(action: PlaybackButtonAction) {
  const playback = await playbackManager.getPlayback().catch(() => null)

  switch (action) {
    case 'playPause':
      return playback?.isPlaying ? playbackManager.pause() : playbackManager.play()
    case 'next':
      return playbackManager.next()
    case 'previous':
      return playbackManager.previous()
    case 'shuffle':
      return playbackManager.shuffle(!playback?.shuffle)
    case 'repeat':
      return playbackManager.repeat(
        playback?.repeat === 'off' ? 'on' : playback?.repeat === 'on' ? 'one' : 'off'
      )
    case 'like':
      return void (await playbackManager.setLiked(!playback?.track.liked))
    case 'volumeUp':
      return playbackManager.setVolume(Math.min(100, (playback?.volume ?? 0) + 10))
    case 'volumeDown':
      return playbackManager.setVolume(Math.max(0, (playback?.volume ?? 0) - 10))
    case 'seekForward':
      if (!playback) return
      return playbackManager.seek(
        Math.min(playback.track.duration.total - 1000, playback.track.duration.current + SEEK_STEP_MS)
      )
    case 'seekBackward':
      if (!playback) return
      return playbackManager.seek(playback.track.duration.current - SEEK_STEP_MS)
  }
}

export function openShortcut(id: string) {
  const app = getShortcuts().find(app => app.id === id)
  if (!app) return
  const parsed = getParsedPlatformCommand(app.command)
  if (!parsed) return
  exec(parsed.cmd, { shell: parsed.shell })
}

async function runStep(step: MacroStep) {
  switch (step.type) {
    case 'keys':
      await sendKeys(step.keys)
      break
    case 'command': {
      const parsed = getParsedPlatformCommand(step.command)
      if (parsed) exec(parsed.cmd, { shell: parsed.shell })
      break
    }
    case 'url':
      if (/^[a-z][a-z0-9+.-]*:/i.test(step.url)) await shell.openExternal(step.url)
      break
    case 'delay':
      await new Promise(r => setTimeout(r, Math.min(Math.max(step.ms, 0), 30000)))
      break
    case 'playback':
      await runPlaybackAction(step.action)
      break
    case 'app':
      openShortcut(step.id)
      break
    case 'mute':
      await setMixerMute(step.target, 'toggle')
      break
  }
}

const running = new Set<string>()

export async function runMacro(id: string): Promise<boolean> {
  const macro = getMacros().find(m => m.id === id)
  if (!macro) return false
  if (running.has(id)) return false // ignore double-presses while running

  running.add(id)
  log(`Running macro ${macro.name}`, 'Macros')
  try {
    for (const step of macro.steps) await runStep(step)
    return true
  } catch (err) {
    log(`Macro ${macro.name} failed: ${err}`, 'Macros', LogLevel.ERROR)
    return false
  } finally {
    running.delete(id)
  }
}
