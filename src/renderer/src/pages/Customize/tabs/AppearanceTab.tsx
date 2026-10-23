import React, { useEffect, useRef, useState } from 'react'

import Switch from '@/components/Switch/Switch.js'

import type { ClientConfig, Macro, PlayerLayout, Screen } from '@/types/Config.js'

// shared with the CarThing client so both sides agree on every text element
import {
  TEXT_GROUPS,
  WEIGHTS,
  optionValue,
  type TextGroup
} from '../../../../../../client/src/lib/textSlots.js'

import type { Updater } from '../Customize.js'

import styles from '../Customize.module.css'

interface Props {
  config: ClientConfig
  macros: Macro[]
  update: Updater<ClientConfig>
}

const PREVIEW_URL = 'gtpreview://app/usr/share/qt-superbird-app/webapp/index.html?preview'
const PREVIEW_MESSAGE = 'glancething-preview'

export const DEFAULT_PLAYER: PlayerLayout = {
  layout: 'auto',
  coverSize: 100,
  coverAlign: 'center',
  textAlign: 'left',
  textScale: 100,
  controlsScale: 100,
  showProgress: true,
  showTimes: true,
  showControls: true,
  showLike: true,
  glow: true
}

// not a text group: theme and accent colour for the whole CarThing
const COLOURS: TextGroup = { id: 'colours', label: 'Colours', icon: 'palette', slots: [] }
const GROUPS: TextGroup[] = [COLOURS, ...TEXT_GROUPS]

const ACCENT_PRESETS = ['#1ed760', '#6ea8ff', '#ff7a59', '#f5c211', '#c061cb', '#ff5c8a', '#eef0f2']

function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string; icon?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className={styles.segmented}>
      {options.map(o => (
        <button key={o.value} data-active={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon && <span className="material-icons">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}

const Slider: React.FC<{
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}> = ({ label, value, min, max, step = 5, onChange }) => (
  <div className={styles.field}>
    <label>
      {label} <b>{value}%</b>
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    />
  </div>
)

/** Which screen / view shows a group best, and whether we had to fake one */
function previewTarget(group: TextGroup, screens: Screen[], fsView: 'cover' | 'queue') {
  if (group.id === 'fullscreen') return { screens, screen: 0, fullscreen: fsView, synthetic: false }
  if (group.id === 'lyrics') return { screens, screen: 0, fullscreen: 'lyrics' as const, synthetic: false }
  if (!group.widget) return { screens, screen: 0, fullscreen: null, synthetic: false }
  const idx = screens.findIndex(s => s.columns.some(c => c.includes(group.widget as never)))
  if (idx >= 0) return { screens, screen: idx, fullscreen: null, synthetic: false }
  const temp: Screen = { id: '__preview', name: 'Preview', columns: [[group.widget as never]] }
  return { screens: [...screens, temp], screen: screens.length, fullscreen: null, synthetic: true }
}

const AppearanceTab: React.FC<Props> = ({ config, macros, update }) => {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [frameReady, setFrameReady] = useState(false)
  const [groupId, setGroupId] = useState('player')
  const [fsView, setFsView] = useState<'cover' | 'queue'>('cover')

  const group = GROUPS.find(g => g.id === groupId) ?? TEXT_GROUPS[0]
  const p = { ...DEFAULT_PLAYER, ...(config.player ?? {}) }
  const text = config.text ?? {}
  const cleanScreens = config.screens
    .map(s => ({ ...s, columns: s.columns.filter(c => c.length) }))
    .filter(s => s.columns.length)
  const target = previewTarget(group, cleanScreens, fsView)

  // live data from our own server when it's running; sample data otherwise
  const [frameSrc, setFrameSrc] = useState(PREVIEW_URL)
  useEffect(() => {
    Promise.all([window.api.hasPreviewClient(), window.api.getPreviewConnection().catch(() => null)])
      .then(([has, conn]) => {
        if (conn) setFrameSrc(`${PREVIEW_URL}#port=${conn.port}&pw=${encodeURIComponent(conn.password)}`)
        setAvailable(has)
      })
      .catch(() => setAvailable(false))
  }, [])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source === PREVIEW_MESSAGE && e.data.ready) setFrameReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // push every change straight into the preview, before it's even saved
  useEffect(() => {
    if (!frameReady) return
    frameRef.current?.contentWindow?.postMessage(
      {
        source: PREVIEW_MESSAGE,
        config: {
          ...config,
          screens: target.screens,
          player: p,
          macros: macros.map(({ id, name, icon, color }) => ({ id, name, icon, color }))
        },
        screen: target.screen,
        fullscreen: target.fullscreen
      },
      '*'
    )
  }, [frameReady, config, macros, groupId, fsView])

  function setPlayer<K extends keyof PlayerLayout>(key: K, value: PlayerLayout[K]) {
    update(c => ({ ...c, player: { ...DEFAULT_PLAYER, ...(c.player ?? {}), [key]: value } }))
  }

  function setText(key: string, patch: { size?: number; weight?: number }) {
    update(c => ({ ...c, text: { ...(c.text ?? {}), [key]: { ...(c.text?.[key] ?? {}), ...patch } } }))
  }

  function setOption(key: string, value: boolean) {
    update(c => ({
      ...c,
      options: { ...(c.options ?? {}), [group.id]: { ...(c.options?.[group.id] ?? {}), [key]: value } }
    }))
  }

  // the Now playing master size predates the text system and lives in player.textScale
  const masterSize = group.id === 'player' ? text.player?.size ?? p.textScale : text[group.id]?.size ?? 100
  function setMaster(v: number) {
    if (group.id === 'player') setPlayer('textScale', v)
    else setText(group.id, { size: v })
  }

  function resetGroup() {
    if (group.id === 'colours') return update(c => ({ ...c, theme: 'dark', accent: 'album' }))
    update(c => {
      const nextText = Object.fromEntries(
        Object.entries(c.text ?? {}).filter(([k]) => k !== group.id && !k.startsWith(`${group.id}.`))
      )
      const nextOptions = { ...(c.options ?? {}) }
      delete nextOptions[group.id]
      return {
        ...c,
        text: nextText,
        options: nextOptions,
        ...(group.id === 'player' ? { player: DEFAULT_PLAYER, playerLyricsLine: true } : {})
      }
    })
  }

  const onScreen =
    !group.widget || config.screens.some(s => s.columns.some(c => c.includes(group.widget as never)))

  return (
    <div className={styles.appearanceTab}>
      <nav className={styles.groupChips}>
        {GROUPS.map(g => (
          <button
            key={g.id}
            className={styles.chip}
            data-active={g.id === group.id}
            onClick={() => setGroupId(g.id)}
          >
            <span className="material-icons">{g.icon}</span>
            {g.label}
          </button>
        ))}
      </nav>

      <div className={styles.playerTab}>
        <section className={styles.previewPane}>
          {group.id === 'fullscreen' && (
            <div className={styles.previewBar}>
              <Segmented<'cover' | 'queue'>
                value={fsView}
                onChange={setFsView}
                options={[
                  { value: 'cover', label: 'Now playing', icon: 'album' },
                  { value: 'queue', label: 'Up next', icon: 'queue_music' }
                ]}
              />
            </div>
          )}
          <div className={styles.liveFrame}>
            {available === false ? (
              <div className={styles.frameMissing}>
                <span className="material-icons">visibility_off</span>
                <p>No CarThing client build on this PC, so there’s nothing to preview.</p>
              </div>
            ) : available ? (
              <iframe
                ref={frameRef}
                src={frameSrc}
                title="CarThing preview"
                width={800}
                height={480}
                tabIndex={-1}
              />
            ) : null}
          </div>
          <p className={styles.help}>
            {!onScreen
              ? `${group.label} isn’t on any screen yet, so it’s shown on its own. Add it in Screens.`
              : frameSrc !== PREVIEW_URL
                ? 'Live: your music, calendar and weather (taps here don’t control anything). Sample song when nothing’s playing.'
                : 'The real CarThing interface with sample data. Changes go to your CarThing as you make them.'}
          </p>
        </section>

        <section className={`${styles.scrollTab} ${styles.playerControls}`}>
          {group.id === 'colours' && (
            <>
              <div className={styles.card}>
                <h3>Background</h3>
                <div className={styles.themeChoices}>
                  {(
                    [
                      ['dark', 'Dark grey', 'Grey panels on black'],
                      ['black', 'Pure black', 'Black panels with a faint outline'],
                      ['black-flat', 'Pure black, no outlines', 'Everything true black']
                    ] as const
                  ).map(([value, label, hint]) => (
                    <button
                      key={value}
                      className={styles.themeChoice}
                      data-active={(config.theme ?? 'dark') === value}
                      onClick={() => update(c => ({ ...c, theme: value }))}
                    >
                      <span className={styles.themeSwatch} data-theme={value}>
                        <i />
                        <i />
                      </span>
                      <span>
                        <b>{label}</b>
                        <small>{hint}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.card}>
                <h3>Accent colour</h3>
                <Segmented<'album' | 'fixed'>
                  value={config.accent === 'album' ? 'album' : 'fixed'}
                  onChange={v => update(c => ({ ...c, accent: v === 'album' ? 'album' : '#1ed760' }))}
                  options={[
                    { value: 'album', label: 'From album art' },
                    { value: 'fixed', label: 'Fixed colour' }
                  ]}
                />
                {config.accent !== 'album' && (
                  <div className={styles.swatches}>
                    {ACCENT_PRESETS.map(c => (
                      <button
                        key={c}
                        className={styles.colorSwatch}
                        data-active={config.accent.toLowerCase() === c}
                        style={{ background: c }}
                        onClick={() => update(cfg => ({ ...cfg, accent: c }))}
                      />
                    ))}
                    <input
                      type="color"
                      className={styles.color}
                      value={config.accent}
                      onChange={e => update(c => ({ ...c, accent: e.target.value }))}
                    />
                  </div>
                )}
                <p className={styles.help}>Used for the progress bar, lyric line, focus rings and highlights.</p>
              </div>
            </>
          )}

          {group.id === 'player' && (
            <div className={styles.card}>
              <h3>Layout</h3>
              <Segmented<PlayerLayout['layout']>
                value={p.layout}
                onChange={v => setPlayer('layout', v)}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'stacked', label: 'Cover on top' },
                  { value: 'side', label: 'Cover beside' }
                ]}
              />
              <Slider label="Cover size" value={p.coverSize} min={40} max={100} onChange={v => setPlayer('coverSize', v)} />
              <div className={styles.field}>
                <label>Cover position</label>
                <Segmented<PlayerLayout['coverAlign']>
                  value={p.coverAlign}
                  onChange={v => setPlayer('coverAlign', v)}
                  options={[
                    { value: 'left', label: '', icon: 'format_align_left' },
                    { value: 'center', label: '', icon: 'format_align_center' },
                    { value: 'right', label: '', icon: 'format_align_right' }
                  ]}
                />
              </div>
              <div className={styles.field}>
                <label>Text alignment</label>
                <Segmented<PlayerLayout['textAlign']>
                  value={p.textAlign}
                  onChange={v => setPlayer('textAlign', v)}
                  options={[
                    { value: 'left', label: '', icon: 'format_align_left' },
                    { value: 'center', label: '', icon: 'format_align_center' }
                  ]}
                />
              </div>
              <Slider
                label="Button size"
                value={p.controlsScale}
                min={70}
                max={150}
                onChange={v => setPlayer('controlsScale', v)}
              />
            </div>
          )}

          {(group.options?.length || group.id === 'player') && (
            <div className={styles.card}>
              <h3>Show</h3>
              {group.id === 'player' &&
                (
                  [
                    ['showControls', 'Playback buttons'],
                    ['showProgress', 'Progress bar'],
                    ['showTimes', 'Elapsed / total time'],
                    ['showLike', 'Like button'],
                    ['glow', 'Album-art glow']
                  ] as [keyof PlayerLayout, string][]
                ).map(([key, label]) => (
                  <div className={styles.field} key={key}>
                    <label>{label}</label>
                    <Switch value={p[key] as boolean} onChange={v => setPlayer(key, v as never)} />
                  </div>
                ))}
              {group.id === 'player' && (
                <div className={styles.field}>
                  <label>Lyric line</label>
                  <Switch
                    value={config.playerLyricsLine}
                    onChange={v => update(c => ({ ...c, playerLyricsLine: v }))}
                  />
                </div>
              )}
              {group.options?.map(o => (
                <div className={styles.field} key={o.key}>
                  <label>{o.label}</label>
                  <Switch
                    value={optionValue(config.options, group.id, o.key)}
                    onChange={v => setOption(o.key, v)}
                  />
                </div>
              ))}
            </div>
          )}

          {group.slots.length > 0 && (
          <div className={styles.card}>
            <h3>Text</h3>
            <Slider label="Whole widget" value={masterSize} min={50} max={200} onChange={setMaster} />
            <div className={styles.slotList}>
              {group.slots.map(s => {
                const st = text[`${group.id}.${s.key}`] ?? {}
                const size = st.size ?? 100
                const weight = st.weight ?? s.weight
                const changed = size !== 100 || weight !== s.weight
                return (
                  <div key={s.key} className={styles.slot}>
                    <div className={styles.slotHead}>
                      <span
                        className={styles.slotName}
                        style={{ fontWeight: weight }}
                      >
                        {s.label}
                      </span>
                      {changed && (
                        <button
                          className={styles.iconBtn}
                          title="Reset"
                          onClick={() =>
                            update(c => {
                              const next = { ...(c.text ?? {}) }
                              delete next[`${group.id}.${s.key}`]
                              return { ...c, text: next }
                            })
                          }
                        >
                          <span className="material-icons">restart_alt</span>
                        </button>
                      )}
                    </div>
                    <div className={styles.slotControls}>
                      <input
                        type="range"
                        min={50}
                        max={200}
                        step={5}
                        value={size}
                        title={`${Math.round((s.size * size * masterSize) / 10000)}px`}
                        onChange={e => setText(`${group.id}.${s.key}`, { size: Number(e.target.value) })}
                      />
                      <b className={styles.slotValue}>{size}%</b>
                      <select
                        className={styles.select}
                        value={weight}
                        onChange={e => setText(`${group.id}.${s.key}`, { weight: Number(e.target.value) })}
                      >
                        {WEIGHTS.map(w => (
                          <option key={w.value} value={w.value}>
                            {w.label}
                          </option>
                        ))}
                        {!WEIGHTS.some(w => w.value === weight) && <option value={weight}>{weight}</option>}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          )}

          <button className={styles.ghostBtn} onClick={resetGroup}>
            <span className="material-icons">restart_alt</span>Reset {group.label}
          </button>
        </section>
      </div>
    </div>
  )
}

export default AppearanceTab
