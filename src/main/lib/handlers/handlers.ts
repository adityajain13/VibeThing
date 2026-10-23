import { Handler } from '../../types/WebSocketHandler.js'

import * as apps from './apps.js'
import * as config from './config.js'
import * as lock from './lock.js'
import * as lyrics from './lyrics.js'
import * as macros from './macros.js'
import * as mixer from './mixer.js'
import * as night from './night.js'
import * as ping from './ping.js'
import * as playback from './playback.js'
import * as reboot from './reboot.js'
import * as restore from './restore.js'
import * as screensaver from './screensaver.js'
import * as sleep from './sleep.js'
import * as subscribe from './subscribe.js'
import * as time from './time.js'
import * as update from './update.js'
import * as version from './version.js'
import * as wake from './wake.js'

export const handlers: Handler[] = [
  apps,
  config,
  lock,
  lyrics,
  macros,
  mixer,
  night,
  ping,
  playback,
  reboot,
  restore,
  screensaver,
  sleep,
  subscribe,
  time,
  update,
  version,
  wake
]
