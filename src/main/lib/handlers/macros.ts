import { runMacro, runPlaybackAction } from '../macros.js'

import { PlaybackButtonAction } from '../../types/Config.js'
import { HandlerAction } from '../../types/WebSocketHandler.js'

export const name = 'macros'

export const hasActions = true

export const actions: HandlerAction[] = [
  {
    action: 'run',
    handle: async (ws, data) => {
      const ok = await runMacro(String(data))
      ws.send(
        JSON.stringify({ type: 'macros', action: 'result', data: { id: data, ok } })
      )
    }
  },
  {
    // Lets the client trigger server-side playback shortcuts (used by button mappings)
    action: 'playback',
    handle: async (_, data) => {
      await runPlaybackAction(data as PlaybackButtonAction)
    }
  }
]
