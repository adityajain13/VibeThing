import { registerProvider } from '../topics.js'
import { weatherProvider } from '../widgets/weather.js'
import { systemProvider } from '../widgets/system.js'
import { calendarProvider } from '../widgets/calendar.js'
import { mixerProvider } from '../widgets/mixer.js'
import { windowsHelper } from '../windowsHelper.js'

import { SetupFunction } from '../../types/WebSocketSetup.js'

export const name = 'widgets'

export const setup: SetupFunction = async () => {
  registerProvider(weatherProvider)
  registerProvider(systemProvider)
  registerProvider(calendarProvider)
  registerProvider(mixerProvider)

  return async () => {
    windowsHelper.stop()
  }
}
