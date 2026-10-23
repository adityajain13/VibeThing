import React, { useEffect, useRef, useState } from 'react'

import Switch from '@/components/Switch/Switch.js'

import type { ClientConfig, Macro, PlayerLayout } from '@/types/Config.js'

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

type View = 'widget' | 'cover' | 'lyrics'

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

const PlayerTab: React.FC<Props> = ({ config, macros, update }) => {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [frameReady, setFrameReady] = useState(false)
  const [view, setView] = useState<View>('widget')

  const p = { ...DEFAULT_PLAYER, ...(config.player ?? {}) }
  const playerScreens = config.screens
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.columns.some(c => c.includes('player')))
  const [screenIdx, setScreenIdx] = useState(playerScreens[0]?.i ?? 0)

  useEffect(() => {
    window.api.hasPreviewClient().then(setAvailable).catch(() => setAvailable(false))
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
    const screens = config.screens
      .map(s => ({ ...s, columns: s.columns.filter(c => c.length) }))
      .filter(s => s.columns.length)
    frameRef.current?.contentWindow?.postMessage(
      {
        source: PREVIEW_MESSAGE,
        config: { ...config, screens, player: p, macros: macros.map(({ id, name, icon, color }) => ({ id, name, icon, color })) },
        screen: screenIdx,
        fullscreen: view === 'widget' ? null : view
      },
      '*'
    )
  }, [frameReady, config, macros, screenIdx, view])

  function set<K extends keyof PlayerLayout>(key: K, value: PlayerLayout[K]) {
    update(c => ({ ...c, player: { ...DEFAULT_PLAYER, ...(c.player ?? {}), [key]: value } }))
  }

  return (
    <div className={styles.playerTab}>
      <section className={styles.previewPane}>
        <div className={styles.previewBar}>
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'widget', label: 'Widget', icon: 'dashboard' },
              { value: 'cover', label: 'Fullscreen', icon: 'fullscreen' },
              { value: 'lyrics', label: 'Lyrics', icon: 'lyrics' }
            ]}
          />
          {view === 'widget' && playerScreens.length > 1 && (
            <select
              className={styles.select}
              value={screenIdx}
              onChange={e => setScreenIdx(Number(e.target.value))}
            >
              {playerScreens.map(({ s, i }) => (
                <option key={s.id} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.liveFrame}>
          {available === false ? (
            <div className={styles.frameMissing}>
              <span className="material-icons">visibility_off</span>
              <p>No CarThing client build on this PC, so there’s nothing to preview.</p>
            </div>
          ) : available ? (
            <iframe
              ref={frameRef}
              src={PREVIEW_URL}
              title="CarThing preview"
              width={800}
              height={480}
              tabIndex={-1}
            />
          ) : null}
        </div>
        <p className={styles.help}>
          This is the real CarThing interface with sample music.{' '}
          {playerScreens.length === 0 && view === 'widget'
            ? 'Add the Now playing widget to a screen to see it here.'
            : 'Tap it to try the controls.'}
        </p>
      </section>

      <section className={`${styles.scrollTab} ${styles.playerControls}`}>
        <div className={styles.card}>
          <h3>Layout</h3>
          <Segmented<PlayerLayout['layout']>
            value={p.layout}
            onChange={v => set('layout', v)}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'stacked', label: 'Cover on top' },
              { value: 'side', label: 'Cover beside' }
            ]}
          />
          <p className={styles.help}>
            Auto stacks in tall slots and goes side-by-side in short ones.
          </p>
          <Slider label="Cover size" value={p.coverSize} min={40} max={100} onChange={v => set('coverSize', v)} />
          <div className={styles.field}>
            <label>Cover position</label>
            <Segmented<PlayerLayout['coverAlign']>
              value={p.coverAlign}
              onChange={v => set('coverAlign', v)}
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
              onChange={v => set('textAlign', v)}
              options={[
                { value: 'left', label: '', icon: 'format_align_left' },
                { value: 'center', label: '', icon: 'format_align_center' }
              ]}
            />
          </div>
        </div>

        <div className={styles.card}>
          <h3>Size</h3>
          <Slider label="Text" value={p.textScale} min={70} max={150} onChange={v => set('textScale', v)} />
          <Slider label="Buttons" value={p.controlsScale} min={70} max={150} onChange={v => set('controlsScale', v)} />
        </div>

        <div className={styles.card}>
          <h3>Show</h3>
          {(
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
              <Switch value={p[key] as boolean} onChange={v => set(key, v as never)} />
            </div>
          ))}
          <div className={styles.field}>
            <label>Lyric line</label>
            <Switch
              value={config.playerLyricsLine}
              onChange={v => update(c => ({ ...c, playerLyricsLine: v }))}
            />
          </div>
        </div>

        <button
          className={styles.ghostBtn}
          onClick={() => update(c => ({ ...c, player: DEFAULT_PLAYER, playerLyricsLine: true }))}
        >
          <span className="material-icons">restart_alt</span>Reset to defaults
        </button>
      </section>
    </div>
  )
}

export default PlayerTab
