import { nightMessage } from '../night.js'

import { HandlerFunction } from '../../types/WebSocketHandler.js'

export const name = 'night'

export const hasActions = false

export const handle: HandlerFunction = async ws => {
  ws.send(JSON.stringify({ type: 'night', data: nightMessage() }))
}
