import { Notification } from 'electron'

import { HandlerAction } from '../../types/WebSocketHandler.js'

export const name = 'timer'

export const hasActions = true

export const actions: HandlerAction[] = [
  {
    action: 'done',
    handle: async (_ws, data) => {
      const mins = typeof data === 'number' ? Math.round(data / 60000) : null
      if (!Notification.isSupported()) return
      new Notification({
        title: "Time's up",
        body: mins ? `Your ${mins}-minute timer on the CarThing finished.` : 'Your CarThing timer finished.',
        silent: false
      }).show()
    }
  }
]
