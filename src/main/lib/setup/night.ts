import { checkNight, endNight } from '../night.js'

import { SetupFunction } from '../../types/WebSocketSetup.js'

export const name = 'night'

export const setup: SetupFunction = async () => {
  const timer = setInterval(() => checkNight(), 30 * 1000)
  const first = setTimeout(() => checkNight(), 2000)

  return async () => {
    clearInterval(timer)
    clearTimeout(first)
    await endNight()
  }
}
