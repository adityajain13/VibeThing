import { getClientConfig, getPublicMacros } from '../config.js'

import { HandlerFunction } from '../../types/WebSocketHandler.js'

export const name = 'config'

export const hasActions = false

export function buildConfigMessage() {
  return { ...getClientConfig(), macros: getPublicMacros() }
}

export const handle: HandlerFunction = async ws => {
  ws.send(JSON.stringify({ type: 'config', data: buildConfigMessage() }))
}
