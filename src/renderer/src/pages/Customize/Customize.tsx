import React, { useContext, useEffect, useRef, useState } from 'react'

import { ModalContext } from '@/contexts/ModalContext.js'

import type { ClientConfig, Macro } from '@/types/Config.js'

import ScreensTab from './tabs/ScreensTab.js'
import AppearanceTab from './tabs/AppearanceTab.js'
import ControlsTab from './tabs/ControlsTab.js'
import MacrosTab from './tabs/MacrosTab.js'
import WidgetsTab from './tabs/WidgetsTab.js'
import BehaviourTab from './tabs/BehaviourTab.js'
import DeviceTab from './tabs/DeviceTab.js'

import styles from './Customize.module.css'

type Tab = 'screens' | 'appearance' | 'behaviour' | 'controls' | 'macros' | 'widgets' | 'device'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'screens', label: 'Screens', icon: 'dashboard' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'behaviour', label: 'Behaviour', icon: 'auto_mode' },
  { id: 'controls', label: 'Buttons & knob', icon: 'gamepad' },
  { id: 'macros', label: 'Macros', icon: 'bolt' },
  { id: 'widgets', label: 'Widget data', icon: 'tune' },
  { id: 'device', label: 'Device', icon: 'tablet' }
]

export interface Shortcut {
  id: string
  command: string
}

export type Updater<T> = (fn: (prev: T) => T) => void

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Debounced write of one storage key. Writing `clientConfig` or `macros`
 * makes the main process broadcast the new config to the CarThing.
 */
function useAutosave<T>(
  key: string,
  value: T | null,
  dirty: React.MutableRefObject<boolean>,
  setState: (s: SaveState) => void,
  serialize: (v: T) => unknown = v => v
) {
  useEffect(() => {
    if (value === null || !dirty.current) return
    setState('saving')
    const t = setTimeout(() => {
      window.api
        .setStorageValue(key, serialize(value))
        .then(() => setState('saved'))
        .catch(() => setState('error'))
    }, 450)
    return () => clearTimeout(t)
  }, [value])
}

/** Empty columns and screens are dropped by the server; strip them on save */
function cleanConfig(config: ClientConfig): ClientConfig {
  const screens = config.screens
    .map(s => ({ ...s, columns: s.columns.filter(c => c.length > 0) }))
    .filter(s => s.columns.length > 0)
  return { ...config, screens }
}

/**
 * As a modal (opened from the titlebar) or, with `embedded`, as the app's
 * main page whenever the CarThing is ready.
 */
const Customize: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { openModals, setModalOpen } = useContext(ModalContext)
  const open = embedded || openModals.includes('customize')

  const [tab, setTab] = useState<Tab>('screens')
  const [config, setConfig] = useState<ClientConfig | null>(null)
  const [macros, setMacros] = useState<Macro[] | null>(null)
  const [apps, setApps] = useState<Shortcut[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const configDirty = useRef(false)
  const macrosDirty = useRef(false)

  // embedded: pick up shortcut changes made in the Shortcuts modal
  const otherModalOpen = embedded && openModals.length > 0
  useEffect(() => {
    if (!embedded || otherModalOpen) return
    window.api.getShortcuts().then(a => setApps((a as Shortcut[]) ?? []))
  }, [embedded, otherModalOpen])

  useEffect(() => {
    if (!open) return
    configDirty.current = false
    macrosDirty.current = false
    setSaveState('idle')
    Promise.all([
      window.api.getClientConfig(),
      window.api.getMacros(),
      window.api.getShortcuts()
    ]).then(([c, m, a]) => {
      setConfig(c as ClientConfig)
      setMacros(m as Macro[])
      setApps((a as Shortcut[]) ?? [])
    })
  }, [open])

  useAutosave('clientConfig', config, configDirty, setSaveState, cleanConfig)
  useAutosave('macros', macros, macrosDirty, setSaveState)

  const updateConfig: Updater<ClientConfig> = fn => {
    configDirty.current = true
    setConfig(prev => (prev ? fn(prev) : prev))
  }

  const updateMacros: Updater<Macro[]> = fn => {
    macrosDirty.current = true
    setMacros(prev => (prev ? fn(prev) : prev))
  }

  function onClickBackground(e: React.MouseEvent<HTMLDivElement>) {
    if (!embedded && e.target === e.currentTarget) setModalOpen('customize', false)
  }

  return (
    <div
      className={styles.customize}
      data-open={open}
      data-embedded={embedded}
      onClick={onClickBackground}
    >
      <div className={styles.box}>
        <header className={styles.header}>
          <h2>Customize CarThing</h2>
          <div className={styles.saveState} data-state={saveState}>
            {saveState === 'saving' ? (
              <>
                <span className="material-icons">sync</span>Saving…
              </>
            ) : saveState === 'saved' ? (
              <>
                <span className="material-icons">check_circle</span>
                Saved and sent to CarThing
              </>
            ) : saveState === 'error' ? (
              <>
                <span className="material-icons">error</span>Couldn’t save
              </>
            ) : (
              <>
                <span className="material-icons">bolt</span>
                Changes apply instantly
              </>
            )}
          </div>
          {!embedded && (
            <button
              className={styles.close}
              onClick={() => setModalOpen('customize', false)}
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </header>

        <nav className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <span className="material-icons">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className={styles.body}>
          {!config || !macros ? null : tab === 'screens' ? (
            <ScreensTab config={config} update={updateConfig} />
          ) : tab === 'appearance' ? (
            <AppearanceTab config={config} macros={macros} update={updateConfig} />
          ) : tab === 'behaviour' ? (
            <BehaviourTab config={config} update={updateConfig} />
          ) : tab === 'controls' ? (
            <ControlsTab
              config={config}
              update={updateConfig}
              macros={macros}
              apps={apps}
            />
          ) : tab === 'macros' ? (
            <MacrosTab macros={macros} update={updateMacros} apps={apps} />
          ) : tab === 'device' ? (
            <DeviceTab />
          ) : (
            <WidgetsTab />
          )}
        </div>
      </div>
    </div>
  )
}

export default Customize
