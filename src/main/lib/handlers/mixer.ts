import { setMixerMute, setMixerVolume } from '../widgets/mixer.js'

import { HandlerAction } from '../../types/WebSocketHandler.js'

export const name = 'mixer'

export const hasActions = true

export const actions: HandlerAction[] = [
  {
    action: 'volume',
    handle: async (_, data) => {
      const { id, volume } = data as { id: string; volume: number }
      if (typeof id !== 'string' || typeof volume !== 'number') return
      await setMixerVolume(id, volume)
    }
  },
  {
    action: 'mute',
    handle: async (_, data) => {
      const { id, muted } = data as { id: string; muted: boolean | 'toggle' }
      if (typeof id !== 'string') return
      await setMixerMute(id, muted)
    }
  }
]
