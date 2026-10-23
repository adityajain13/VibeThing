import { useContext, useEffect, useRef } from 'react'

import { AppBlurContext } from '@/contexts/AppBlurContext.tsx'
import { ConfigContext } from '@/contexts/ConfigContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import { UIContext } from '@/contexts/UIContext.tsx'

import FullscreenPlayer from '@/components/FullscreenPlayer/FullscreenPlayer.tsx'
import InputController from '@/components/InputController.tsx'
import LoadingScreen from '@/components/LoadingScreen/LoadingScreen.tsx'
import UpdateScreen from '@/components/UpdateScreen/UpdateScreen.tsx'
import VolumeOverlay from '@/components/VolumeOverlay/VolumeOverlay.tsx'
import Statusbar from '@/components/Statusbar/Statusbar.tsx'
import Screens from '@/components/Screens/Screens.tsx'
import Toast from '@/components/Toast/Toast.tsx'
import Menu from '@/components/Menu/Menu.tsx'

import { textStyleVars } from '@/lib/textSlots.ts'

import styles from './App.module.css'

const App: React.FC = () => {
  const { blurred } = useContext(AppBlurContext)
  const { ready } = useContext(SocketContext)
  const config = useContext(ConfigContext)
  const { screens } = config

  // text sizes / weights from the desktop app become CSS variables on :root
  const appliedVars = useRef<string[]>([])
  useEffect(() => {
    const vars = textStyleVars(config.text, config.player.textScale)
    const root = document.documentElement.style
    for (const k of appliedVars.current) if (!(k in vars)) root.removeProperty(k)
    for (const [k, v] of Object.entries(vars)) root.setProperty(k, v)
    appliedVars.current = Object.keys(vars)
  }, [config.text, config.player.textScale])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme ?? 'dark')
  }, [config.theme])
  const { screen, fullscreen } = useContext(UIContext)

  // the player widget has its own volume readout; elsewhere show a floating one
  const playerVisible = screens[screen]?.columns.some(c => c.includes('player'))

  return (
    <>
      <div className={styles.app} data-blurred={blurred || !ready}>
        <Statusbar />
        <Screens />
        <FullscreenPlayer />
        {!playerVisible && !fullscreen && <VolumeOverlay fixed />}
      </div>
      <InputController />
      <Toast />
      <LoadingScreen />
      <UpdateScreen />
      <Menu />
    </>
  )
}

export default App
