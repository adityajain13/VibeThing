import React, { useEffect, useState } from 'react'

import type { Macro, MacroStep, PlaybackButtonAction } from '@/types/Config.js'

import type { Shortcut, Updater } from '../Customize.js'
import { PLAYBACK_ACTIONS, appLabel, newId } from '../meta.js'

import styles from '../Customize.module.css'

interface Props {
  macros: Macro[]
  update: Updater<Macro[]>
  apps: Shortcut[]
}

const STEP_TYPES: { type: MacroStep['type']; label: string; icon: string }[] = [
  { type: 'keys', label: 'Press keys', icon: 'keyboard' },
  { type: 'playback', label: 'Playback', icon: 'play_arrow' },
  { type: 'mute', label: 'Toggle mute', icon: 'volume_off' },
  { type: 'app', label: 'Open app', icon: 'launch' },
  { type: 'url', label: 'Open URL', icon: 'link' },
  { type: 'command', label: 'Run command', icon: 'terminal' },
  { type: 'delay', label: 'Wait', icon: 'hourglass_empty' }
]

const ICONS = [
  'bolt', 'mic_off', 'videocam_off', 'headset', 'screenshot_monitor',
  'sports_esports', 'lightbulb', 'home', 'work', 'code', 'chat', 'nightlight',
  'volume_off', 'music_note', 'power_settings_new', 'lock'
]

const COLORS = ['#5865f2', '#1ed760', '#ff5c5c', '#ffa63d', '#f5c211', '#2ec2c2', '#c061cb', '#555555']

function defaultStep(type: MacroStep['type'], apps: Shortcut[]): MacroStep {
  switch (type) {
    case 'keys':
      return { type, keys: '' }
    case 'command':
      return { type, command: '' }
    case 'url':
      return { type, url: 'https://' }
    case 'delay':
      return { type, ms: 500 }
    case 'playback':
      return { type, action: 'playPause' }
    case 'app':
      return { type, id: apps[0]?.id ?? '' }
    case 'mute':
      return { type, target: 'mic' }
  }
}

const KeysInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({
  value,
  onChange
}) => {
  const [valid, setValid] = useState<boolean | null>(null)
  useEffect(() => {
    if (!value) return setValid(null)
    let alive = true
    window.api.validateKeys(value).then(v => alive && setValid(v))
    return () => {
      alive = false
    }
  }, [value])

  // capture a real key combo instead of making people type "ctrl+shift+m"
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') return
    e.preventDefault()
    if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey)
      return onChange('')
    const mods = [e.ctrlKey && 'ctrl', e.shiftKey && 'shift', e.altKey && 'alt', e.metaKey && 'win'].filter(
      Boolean
    ) as string[]
    const k = e.key.toLowerCase()
    if (['control', 'shift', 'alt', 'meta'].includes(k)) return
    const named: Record<string, string> = {
      ' ': 'space', arrowup: 'up', arrowdown: 'down', arrowleft: 'left',
      arrowright: 'right', escape: 'esc', mediaplaypause: 'playpause',
      mediatracknext: 'next', mediatrackprevious: 'prev',
      audiovolumemute: 'mute', audiovolumeup: 'volumeup', audiovolumedown: 'volumedown'
    }
    onChange([...mods, named[k] ?? k].join('+'))
  }

  return (
    <div className={styles.keysInput} data-valid={valid}>
      <input
        type="text"
        value={value}
        placeholder="Click, then press the shortcut"
        onKeyDown={onKeyDown}
        onChange={e => onChange(e.target.value)}
      />
      {valid === false && <span className={styles.invalid}>Unknown key</span>}
    </div>
  )
}

const StepEditor: React.FC<{
  step: MacroStep
  apps: Shortcut[]
  mixerTargets: { id: string; name: string }[] | null
  onChange: (s: MacroStep) => void
}> = ({ step, apps, mixerTargets, onChange }) => {
  switch (step.type) {
    case 'keys':
      return <KeysInput value={step.keys} onChange={keys => onChange({ ...step, keys })} />
    case 'command':
      return (
        <input
          type="text"
          className={styles.grow}
          value={step.command}
          placeholder="e.g. start ms-settings:"
          onChange={e => onChange({ ...step, command: e.target.value })}
        />
      )
    case 'url':
      return (
        <input
          type="text"
          className={styles.grow}
          value={step.url}
          placeholder="https://… or spotify:…"
          onChange={e => onChange({ ...step, url: e.target.value })}
        />
      )
    case 'delay':
      return (
        <div className={styles.inline}>
          <input
            type="number"
            className={styles.number}
            min={0}
            max={30000}
            step={100}
            value={step.ms}
            onChange={e => onChange({ ...step, ms: Number(e.target.value) })}
          />
          <span className={styles.muted}>ms</span>
        </div>
      )
    case 'playback':
      return (
        <select
          className={styles.select}
          value={step.action}
          onChange={e => onChange({ ...step, action: e.target.value as PlaybackButtonAction })}
        >
          {Object.entries(PLAYBACK_ACTIONS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      )
    case 'app':
      return apps.length ? (
        <select
          className={styles.select}
          value={step.id}
          onChange={e => onChange({ ...step, id: e.target.value })}
        >
          {apps.map(a => (
            <option key={a.id} value={a.id}>
              {appLabel(a.command)}
            </option>
          ))}
        </select>
      ) : (
        <span className={styles.muted}>Add an app shortcut first (apps icon, top right)</span>
      )
    case 'mute': {
      const targets = mixerTargets ?? [
        { id: 'master', name: 'Master volume' },
        { id: 'mic', name: 'Microphone' }
      ]
      const known = targets.some(t => t.id === step.target)
      return (
        <div className={styles.inline}>
          <select
            className={styles.select}
            value={known ? step.target : '__custom'}
            onChange={e =>
              onChange({ ...step, target: e.target.value === '__custom' ? '' : e.target.value })
            }
          >
            {targets.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="__custom">Other app…</option>
          </select>
          {!known || !mixerTargets ? (
            <input
              type="text"
              className={styles.grow}
              value={known ? '' : step.target}
              placeholder="process name, e.g. Discord.exe"
              onChange={e => onChange({ ...step, target: e.target.value })}
            />
          ) : null}
        </div>
      )
    }
  }
}

const MacrosTab: React.FC<Props> = ({ macros, update, apps }) => {
  const [selectedId, setSelectedId] = useState<string | null>(macros[0]?.id ?? null)
  const [mixerTargets, setMixerTargets] = useState<{ id: string; name: string }[] | null>(null)
  const [testState, setTestState] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    window.api.getMixerTargets().then(setMixerTargets).catch(() => setMixerTargets(null))
  }, [])

  const macro = macros.find(m => m.id === selectedId) ?? macros[0]

  function setMacro(fn: (m: Macro) => Macro) {
    if (!macro) return
    update(ms => ms.map(m => (m.id === macro.id ? fn(m) : m)))
  }

  function setStep(i: number, s: MacroStep) {
    setMacro(m => ({ ...m, steps: m.steps.map((x, j) => (j === i ? s : x)) }))
  }

  function moveStep(i: number, dir: -1 | 1) {
    setMacro(m => {
      const j = i + dir
      if (j < 0 || j >= m.steps.length) return m
      const steps = [...m.steps]
      ;[steps[i], steps[j]] = [steps[j], steps[i]]
      return { ...m, steps }
    })
  }

  function addMacro() {
    const m: Macro = {
      id: newId('macro'),
      name: 'New macro',
      icon: 'bolt',
      color: COLORS[macros.length % COLORS.length],
      steps: [{ type: 'keys', keys: '' }]
    }
    update(ms => [...ms, m])
    setSelectedId(m.id)
  }

  function deleteMacro(id: string) {
    const idx = macros.findIndex(m => m.id === id)
    update(ms => ms.filter(m => m.id !== id))
    const next = macros.filter(m => m.id !== id)
    setSelectedId(next[Math.max(0, idx - 1)]?.id ?? null)
  }

  async function test() {
    if (!macro) return
    setTestState('running')
    const ok = await window.api.testMacro(macro).catch(() => false)
    setTestState(ok ? 'ok' : 'fail')
    setTimeout(() => setTestState('idle'), 2000)
  }

  return (
    <div className={styles.screensTab}>
      <aside className={styles.screenList}>
        <p className={styles.sectionLabel}>Macros</p>
        {macros.map(m => (
          <div
            key={m.id}
            className={styles.screenItem}
            data-active={m.id === macro?.id}
            onClick={() => setSelectedId(m.id)}
          >
            <span className={`material-icons ${styles.macroIcon}`} style={{ background: m.color }}>
              {m.icon}
            </span>
            <span className={styles.screenName}>{m.name}</span>
          </div>
        ))}
        <button className={styles.ghostBtn} onClick={addMacro}>
          <span className="material-icons">add</span>New macro
        </button>
        <p className={styles.help}>
          Macros show up in the Macros widget and can be mapped to any button.
        </p>
      </aside>

      {macro ? (
        <section className={`${styles.editor} ${styles.scrollTab}`}>
          <div className={styles.editorHead}>
            <span className={`material-icons ${styles.macroIconLg}`} style={{ background: macro.color }}>
              {macro.icon}
            </span>
            <input
              type="text"
              className={styles.nameInput}
              value={macro.name}
              maxLength={28}
              onChange={e => setMacro(m => ({ ...m, name: e.target.value }))}
            />
            <button className={styles.primaryBtn} onClick={test} disabled={testState === 'running'}>
              <span className="material-icons">
                {testState === 'ok' ? 'check' : testState === 'fail' ? 'error' : 'play_arrow'}
              </span>
              {testState === 'running' ? 'Running…' : testState === 'ok' ? 'Done' : testState === 'fail' ? 'Failed' : 'Test on PC'}
            </button>
            <button className={styles.dangerGhost} onClick={() => deleteMacro(macro.id)}>
              <span className="material-icons">delete</span>
            </button>
          </div>

          <div className={`${styles.field} ${styles.stacked}`}>
            <label>Icon</label>
            <div className={styles.swatches}>
              {ICONS.map(i => (
                <button
                  key={i}
                  className={styles.iconSwatch}
                  data-active={macro.icon === i}
                  onClick={() => setMacro(m => ({ ...m, icon: i }))}
                >
                  <span className="material-icons">{i}</span>
                </button>
              ))}
              <input
                type="text"
                className={styles.iconText}
                value={macro.icon}
                title="Any Material Icons name"
                onChange={e => setMacro(m => ({ ...m, icon: e.target.value.trim() }))}
              />
            </div>
          </div>
          <div className={`${styles.field} ${styles.stacked}`}>
            <label>Colour</label>
            <div className={styles.swatches}>
              {COLORS.map(c => (
                <button
                  key={c}
                  className={styles.colorSwatch}
                  data-active={macro.color === c}
                  style={{ background: c }}
                  onClick={() => setMacro(m => ({ ...m, color: c }))}
                />
              ))}
              <input
                type="color"
                className={styles.color}
                value={macro.color}
                onChange={e => setMacro(m => ({ ...m, color: e.target.value }))}
              />
            </div>
          </div>

          <p className={styles.sectionLabel}>Steps — run top to bottom</p>
          <ol className={styles.steps}>
            {macro.steps.map((s, i) => (
              <li key={i} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <select
                  className={styles.select}
                  value={s.type}
                  onChange={e => setStep(i, defaultStep(e.target.value as MacroStep['type'], apps))}
                >
                  {STEP_TYPES.map(t => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div className={styles.stepBody}>
                  <StepEditor step={s} apps={apps} mixerTargets={mixerTargets} onChange={n => setStep(i, n)} />
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.iconBtn} disabled={i === 0} onClick={() => moveStep(i, -1)}>
                    <span className="material-icons">arrow_upward</span>
                  </button>
                  <button
                    className={styles.iconBtn}
                    disabled={i === macro.steps.length - 1}
                    onClick={() => moveStep(i, 1)}
                  >
                    <span className="material-icons">arrow_downward</span>
                  </button>
                  <button
                    className={styles.iconBtn}
                    onClick={() => setMacro(m => ({ ...m, steps: m.steps.filter((_, j) => j !== i) }))}
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className={styles.addSteps}>
            {STEP_TYPES.map(t => (
              <button
                key={t.type}
                className={styles.chip}
                onClick={() => setMacro(m => ({ ...m, steps: [...m.steps, defaultStep(t.type, apps)] }))}
              >
                <span className="material-icons">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          {mixerTargets === null && (
            <p className={styles.warn}>
              <span className="material-icons">info</span>
              Key presses, per-app mute and the mixer need Windows.
            </p>
          )}
        </section>
      ) : (
        <section className={styles.emptyState}>
          <span className="material-icons">bolt</span>
          <p>No macros yet. Make one to mute Discord, start a stream, open a playlist…</p>
          <button className={styles.primaryBtn} onClick={addMacro}>
            New macro
          </button>
        </section>
      )}
    </div>
  )
}

export default MacrosTab
