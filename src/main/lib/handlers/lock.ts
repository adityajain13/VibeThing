import { exec } from 'child_process'

import { getLockPlatformCommand } from '../utils.js'

import { HandlerFunction } from '../../types/WebSocketHandler.js'

export const name = 'lock'

export const hasActions = false

export const handle: HandlerFunction = async () => {
  const parsed = getLockPlatformCommand()
  if (!parsed) return

  exec(parsed.cmd, {
    shell: parsed.shell
  })
}
