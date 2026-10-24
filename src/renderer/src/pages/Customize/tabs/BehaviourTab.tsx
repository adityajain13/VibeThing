import React from 'react'

import Switch from '@/components/Switch/Switch.js'

import type { Behaviour, ClientConfig } from '@/types/Config.js'

import type { Updater } from '../Customize.js'

import styles from '../Customize.module.css'

interface Props {
  config: ClientConfig
  update: Updater<ClientConfig>
}

const DEFAULTS: Behaviour = {
  autoSwitch: { enabled: false, playScreen: 'auto', idleScreen: 'none', idleMinutes: 5 },
  night: { enabled: false, start: '23:00', end: '07:00', brightness: 8, clockOnly: true }
}

const BehaviourTab: React.FC<Props> = ({ config, update }) => {
  const b: Behaviour = {
    autoSwitch: { ...DEFAULTS.autoSwitch, ...(config.behaviour?.autoSwitch ?? {}) },
    night: { ...DEFAULTS.night, ...(config.behaviour?.night ?? {}) }
  }
  const screens = config.screens.filter(s => s.columns.some(c => c.length))

  function setAuto(patch: Partial<Behaviour['autoSwitch']>) {
    update(c => ({ ...c, behaviour: { ...b, ...c.behaviour, autoSwitch: { ...b.autoSwitch, ...patch } } }))
  }
  function setNight(patch: Partial<Behaviour['night']>) {
    update(c => ({ ...c, behaviour: { ...b, ...c.behaviour, night: { ...b.night, ...patch } } }))
  }

  return (
    <div className={styles.scrollTab}>
      <section className={styles.card}>
        <div className={styles.field}>
          <h3>
            <span className="material-icons">swap_horiz</span>Auto-switch screens
          </h3>
          <Switch value={b.autoSwitch.enabled} onChange={v => setAuto({ enabled: v })} />
        </div>
        <p className={styles.help}>
          Changes screens for you based on what’s playing. It won’t switch for 20
          seconds after you’ve touched the CarThing.
        </p>
        <div className={styles.dimmable} data-off={!b.autoSwitch.enabled}>
          <div className={styles.field}>
            <label>When music starts, go to</label>
            <select
              className={styles.select}
              value={b.autoSwitch.playScreen}
              onChange={e => setAuto({ playScreen: e.target.value })}
            >
              <option value="auto">The screen with Now playing</option>
              <option value="fullscreen">Fullscreen player</option>
              {screens.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>After it’s been paused, go to</label>
            <select
              className={styles.select}
              value={b.autoSwitch.idleScreen}
              onChange={e => setAuto({ idleScreen: e.target.value })}
            >
              <option value="none">Stay where it is</option>
              {screens.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {b.autoSwitch.idleScreen !== 'none' && (
            <div className={styles.field}>
              <label>
                Wait <b>{b.autoSwitch.idleMinutes} min</b>
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={b.autoSwitch.idleMinutes}
                onChange={e => setAuto({ idleMinutes: Number(e.target.value) })}
              />
            </div>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.field}>
          <h3>
            <span className="material-icons">bedtime</span>Night mode
          </h3>
          <Switch value={b.night.enabled} onChange={v => setNight({ enabled: v })} />
        </div>
        <p className={styles.help}>
          Dims the CarThing on a schedule. Tap it or press any button to see your
          screens for a minute.
        </p>
        <div className={styles.dimmable} data-off={!b.night.enabled}>
          <div className={styles.field}>
            <label>From</label>
            <div className={styles.inline}>
              <input
                type="time"
                className={styles.time}
                value={b.night.start}
                onChange={e => setNight({ start: e.target.value })}
              />
              <span className={styles.muted}>to</span>
              <input
                type="time"
                className={styles.time}
                value={b.night.end}
                onChange={e => setNight({ end: e.target.value })}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label>
              Brightness <b>{b.night.brightness}%</b>
            </label>
            <input
              type="range"
              min={1}
              max={60}
              value={b.night.brightness}
              onChange={e => setNight({ brightness: Number(e.target.value) })}
            />
          </div>
          <div className={styles.field}>
            <label>
              Show only a dim clock
              <small>Otherwise your screens stay, just dimmer</small>
            </label>
            <Switch value={b.night.clockOnly} onChange={v => setNight({ clockOnly: v })} />
          </div>
        </div>
      </section>
    </div>
  )
}

export default BehaviourTab
