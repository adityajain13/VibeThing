import { useContext } from 'react'

import { ConfigContext } from '@/contexts/ConfigContext.tsx'
import { MediaContext } from '@/contexts/MediaContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import { UIContext } from '@/contexts/UIContext.tsx'

import { ButtonAction } from '@/types/Config.js'

export function focusWidget(index: number) {
  const widgets = document.querySelectorAll<HTMLElement>(
    '[data-screen-active="true"] [data-widget]'
  )
  widgets[index]?.focus()
}

/** Executes a configured button action on the device */
export function useRunAction() {
  const { socket } = useContext(SocketContext)
  const { actions, playerDataRef } = useContext(MediaContext)
  const ui = useContext(UIContext)
  const config = useContext(ConfigContext)

  return (action: ButtonAction) => {
    switch (action.type) {
      case 'none':
        return
      case 'screen':
        ui.setFullscreen(null)
        return ui.setScreen(action.index)
      case 'nextScreen':
        ui.setFullscreen(null)
        return ui.stepScreen(1)
      case 'prevScreen':
        ui.setFullscreen(null)
        return ui.stepScreen(-1)
      case 'focus':
        ui.setFullscreen(null)
        return focusWidget(action.widget)
      case 'fullscreen': {
        const view = action.view ?? 'cover'
        return ui.setFullscreen(ui.fullscreen === view ? null : view)
      }
      case 'lock':
        socket?.send(JSON.stringify({ type: 'lock' }))
        return ui.toast('lock', 'Locked')
      case 'app':
        return socket?.send(JSON.stringify({ type: 'apps', action: 'open', data: action.id }))
      case 'macro': {
        const macro = config.macros.find(m => m.id === action.id)
        socket?.send(JSON.stringify({ type: 'macros', action: 'run', data: action.id }))
        return ui.toast(macro?.icon ?? 'bolt', macro?.name ?? 'Macro')
      }
      case 'playback': {
        const cur = playerDataRef.current
        switch (action.action) {
          case 'playPause':
            return actions.playPause()
          case 'next':
            return actions.skipForward()
          case 'previous':
            return actions.skipBackward()
          case 'shuffle':
            if (!cur) return
            ui.toast('shuffle', cur.shuffle ? 'Shuffle off' : 'Shuffle on')
            return actions.shuffle(!cur.shuffle)
          case 'repeat': {
            if (!cur) return
            const next = cur.repeat === 'off' ? 'on' : cur.repeat === 'on' ? 'one' : 'off'
            ui.toast(next === 'one' ? 'repeat_one' : 'repeat', next === 'off' ? 'Repeat off' : next === 'on' ? 'Repeat all' : 'Repeat one')
            return actions.repeat(next)
          }
          case 'like':
            if (!cur?.supportedActions.includes('like')) return ui.toast('favorite_border', "Can't like this")
            ui.toast(cur.track.liked ? 'favorite_border' : 'favorite', cur.track.liked ? 'Removed from Liked Songs' : 'Added to Liked Songs')
            return actions.toggleLike()
          case 'volumeUp':
            return actions.changeVolume(1)
          case 'volumeDown':
            return actions.changeVolume(-1)
          case 'seekForward':
            return actions.seekBy(config.seekStep * 1000)
          case 'seekBackward':
            return actions.seekBy(-config.seekStep * 1000)
        }
      }
    }
  }
}
