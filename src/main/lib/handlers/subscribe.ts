import { setSubscriptions } from '../topics.js'

import { HandlerFunction } from '../../types/WebSocketHandler.js'

export const name = 'subscribe'

export const hasActions = false

/** The client sends the list of topics its visible widgets need */
export const handle: HandlerFunction = async (ws, data) => {
  const topics = Array.isArray(data)
    ? data.filter((t): t is string => typeof t === 'string')
    : []
  await setSubscriptions(ws, topics)
}
