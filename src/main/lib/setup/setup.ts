import {
  CleanupFunction,
  SetupHandler
} from '../../types/WebSocketSetup.js'

import * as time from './time.js'
import * as playback from './playback.js'
import * as widgets from './widgets.js'

const setupHandlers: SetupHandler[] = [time, playback, widgets]

export async function runServerSetup() {
  const cleanupFunctions: CleanupFunction[] = []
  for (const handler of setupHandlers) {
    const cleanup = await handler.setup()
    cleanupFunctions.push(cleanup)
  }

  return async () => {
    for (const cleanup of cleanupFunctions) {
      await cleanup()
    }
  }
}
