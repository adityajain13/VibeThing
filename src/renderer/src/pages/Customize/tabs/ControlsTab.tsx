import React from 'react'

import type {
  ButtonAction,
  ClientConfig,
  Macro,
  PresetKey
} from '@/types/Config.js'

import type { Shortcut, Updater } from '../Customize.js'
import { actionGroups, decodeAction, encodeAction } from '../meta.js'

import styles from '../Customize.module.css'

interface Props {
  config: ClientConfig
  update: Updater<ClientConfig>
  macros: Macro[]
  apps: Shortcut[]
}

const ActionSelect: React.FC<{
  value: ButtonAction
  groups: ReturnType<typeof actionGroups>
  onChange: (a: ButtonAction) => void
}> = ({ value, groups, onChange }) => {
  const encoded = encodeAction(value)
  const known = groups.some(g => g.options.some(o => o.value === encoded))
  return (
    <select
      className={styles.select}
      value={known ? encoded : 'none'}
      onChange={e => onChange(decodeAction(e.target.value))}
    >
      {groups.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

const KEYS: PresetKey[] = ['1', '2', '3', '4']

const ControlsTab: React.FC<Props> = ({ config, update, macros, apps }) => {
  const groups = actionGroups({ screens: config.screens, macros, apps })

  function setButton(key: PresetKey, kind: 'press' | 'hold', a: ButtonAction) {
    update(c => ({
      ...c,
      buttons: { ...c.buttons, [key]: { ...c.buttons[key], [kind]: a } }
    }))
  }

  return (
    <div className={styles.scrollTab}>
      <section className={styles.card}>
        <h3>Preset buttons</h3>
        <p className={styles.help}>
          The four buttons along the top edge of the CarThing, left to right.
          Hold means pressing for about half a second.
        </p>
        <div className={styles.buttonGrid}>
          <span />
          <span className={styles.colHead}>Press</span>
          <span className={styles.colHead}>Hold</span>
          {KEYS.map(k => (
            <React.Fragment key={k}>
              <span className={styles.keyCap}>{k}</span>
              <ActionSelect
                value={config.buttons[k].press}
                groups={groups}
                onChange={a => setButton(k, 'press', a)}
              />
              <ActionSelect
                value={config.buttons[k].hold}
                groups={groups}
                onChange={a => setButton(k, 'hold', a)}
              />
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h3>Dial</h3>
        <p className={styles.help}>
          What the dial does when no widget is focused. Focused widgets
          (lists, mixer, player) always get the dial first.
        </p>
        <div className={styles.field}>
          <label>Turn</label>
          <select
            className={styles.select}
            value={config.knob.idle}
            onChange={e =>
              update(c => ({
                ...c,
                knob: { ...c.knob, idle: e.target.value as ClientConfig['knob']['idle'] }
              }))
            }
          >
            <option value="volume">Change volume</option>
            <option value="screens">Switch screens</option>
            <option value="none">Nothing</option>
          </select>
        </div>
        <div className={styles.field}>
          <label>Press</label>
          <ActionSelect
            value={config.knob.press}
            groups={groups}
            onChange={a => update(c => ({ ...c, knob: { ...c.knob, press: a } }))}
          />
        </div>
        <div className={styles.field}>
          <label>
            Volume step <b>{config.volumeStep}%</b>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={config.volumeStep}
            onChange={e => update(c => ({ ...c, volumeStep: Number(e.target.value) }))}
          />
        </div>
        <div className={styles.field}>
          <label>
            Seek step <b>{config.seekStep}s</b>
          </label>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={config.seekStep}
            onChange={e => update(c => ({ ...c, seekStep: Number(e.target.value) }))}
          />
        </div>
      </section>

    </div>
  )
}

export default ControlsTab
