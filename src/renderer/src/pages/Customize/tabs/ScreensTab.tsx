import React, { useState } from 'react'

import type {
  ButtonAction,
  ClientConfig,
  Screen,
  WidgetId
} from '@/types/Config.js'

import type { Updater } from '../Customize.js'
import { MAX_COLUMNS, WIDGETS, WIDGET_ORDER, newId } from '../meta.js'

import styles from '../Customize.module.css'

interface Props {
  config: ClientConfig
  update: Updater<ClientConfig>
}

type DragPayload =
  | { kind: 'palette'; widget: WidgetId }
  | { kind: 'tile'; widget: WidgetId; from: number }

const DRAG_MIME = 'application/x-glancething-widget'

/** Keep button "go to screen N" mappings pointing at the same screen */
function remapScreenAction(
  a: ButtonAction,
  map: (index: number) => number | null
): ButtonAction {
  if (a.type !== 'screen') return a
  const next = map(a.index)
  return next === null ? { type: 'none' } : { ...a, index: next }
}

function remapButtons(
  config: ClientConfig,
  map: (index: number) => number | null
): ClientConfig {
  const buttons = Object.fromEntries(
    Object.entries(config.buttons).map(([k, b]) => [
      k,
      { press: remapScreenAction(b.press, map), hold: remapScreenAction(b.hold, map) }
    ])
  ) as ClientConfig['buttons']
  return {
    ...config,
    buttons,
    knob: { ...config.knob, press: remapScreenAction(config.knob.press, map) }
  }
}

const ScreensTab: React.FC<Props> = ({ config, update }) => {
  const [selected, setSelected] = useState(0)
  const [targetCol, setTargetCol] = useState(0)
  const [dropAt, setDropAt] = useState<{ col: number; index: number } | null>(
    null
  )

  const screens = config.screens
  const current: Screen | undefined = screens[Math.min(selected, screens.length - 1)]
  const sIndex = Math.min(selected, screens.length - 1)
  const used = new Set(current?.columns.flat() ?? [])

  function setScreen(fn: (s: Screen) => Screen) {
    update(c => ({
      ...c,
      screens: c.screens.map((s, i) => (i === sIndex ? fn(s) : s))
    }))
  }

  function addScreen() {
    update(c => ({
      ...c,
      screens: [
        ...c.screens,
        { id: newId('screen'), name: `Screen ${c.screens.length + 1}`, columns: [[]] }
      ]
    }))
    setSelected(screens.length)
    setTargetCol(0)
  }

  function removeScreen(i: number) {
    if (screens.length <= 1) return
    update(c =>
      remapButtons(
        { ...c, screens: c.screens.filter((_, j) => j !== i) },
        idx => (idx === i ? null : idx > i ? idx - 1 : idx)
      )
    )
    setSelected(s => Math.max(0, s > i ? s - 1 : Math.min(s, screens.length - 2)))
  }

  function moveScreen(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= screens.length) return
    update(c => {
      const next = [...c.screens]
      ;[next[i], next[j]] = [next[j], next[i]]
      return remapButtons({ ...c, screens: next }, idx =>
        idx === i ? j : idx === j ? i : idx
      )
    })
    if (selected === i) setSelected(j)
    else if (selected === j) setSelected(i)
  }

  function placeWidget(widget: WidgetId, col: number, index?: number) {
    setScreen(s => {
      // a widget can only appear once per screen, so moving removes it first
      let columns = s.columns.map(c => c.filter(w => w !== widget))
      // removing may shift the target index within the same column
      if (index !== undefined) {
        const orig = s.columns[col] ?? []
        const before = orig.slice(0, index).filter(w => w === widget).length
        index -= before
      }
      columns = columns.map((c, ci) => {
        if (ci !== col) return c
        const at = index ?? c.length
        return [...c.slice(0, at), widget, ...c.slice(at)]
      })
      return { ...s, columns }
    })
  }

  function removeWidget(widget: WidgetId) {
    setScreen(s => ({ ...s, columns: s.columns.map(c => c.filter(w => w !== widget)) }))
  }

  function addColumn() {
    if (!current || current.columns.length >= MAX_COLUMNS) return
    setScreen(s => ({ ...s, columns: [...s.columns, []] }))
    setTargetCol(current.columns.length)
  }

  function removeColumn(ci: number) {
    if (!current || current.columns.length <= 1) return
    setScreen(s => ({ ...s, columns: s.columns.filter((_, i) => i !== ci) }))
    setTargetCol(t => Math.max(0, t >= ci ? t - 1 : t))
  }

  function onDragStart(e: React.DragEvent, payload: DragPayload) {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDrop(e: React.DragEvent, col: number, index?: number) {
    e.preventDefault()
    e.stopPropagation()
    setDropAt(null)
    const raw = e.dataTransfer.getData(DRAG_MIME)
    if (!raw) return
    const payload = JSON.parse(raw) as DragPayload
    placeWidget(payload.widget, col, index)
    setTargetCol(col)
  }

  function allowDrop(e: React.DragEvent, col: number, index: number) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.stopPropagation()
    if (dropAt?.col !== col || dropAt.index !== index) setDropAt({ col, index })
  }

  if (!current) return null

  const emptyCols = current.columns.filter(c => c.length === 0).length

  return (
    <div className={styles.screensTab}>
      <aside className={styles.screenList}>
        <p className={styles.sectionLabel}>Screens</p>
        {screens.map((s, i) => (
          <div
            key={s.id}
            className={styles.screenItem}
            data-active={i === sIndex}
            onClick={() => {
              setSelected(i)
              setTargetCol(0)
            }}
          >
            <span className={styles.screenNum}>{i + 1}</span>
            <span className={styles.screenName}>{s.name}</span>
            <div className={styles.rowActions}>
              <button
                className={styles.iconBtn}
                title="Move up"
                disabled={i === 0}
                onClick={e => {
                  e.stopPropagation()
                  moveScreen(i, -1)
                }}
              >
                <span className="material-icons">arrow_upward</span>
              </button>
              <button
                className={styles.iconBtn}
                title="Move down"
                disabled={i === screens.length - 1}
                onClick={e => {
                  e.stopPropagation()
                  moveScreen(i, 1)
                }}
              >
                <span className="material-icons">arrow_downward</span>
              </button>
            </div>
          </div>
        ))}
        <button className={styles.ghostBtn} onClick={addScreen}>
          <span className="material-icons">add</span>Add screen
        </button>
        <p className={styles.help}>
          Swipe on the CarThing or map a button to switch screens.
        </p>
      </aside>

      <section className={styles.editor}>
        <div className={styles.editorHead}>
          <input
            type="text"
            className={styles.nameInput}
            value={current.name}
            maxLength={24}
            onChange={e => setScreen(s => ({ ...s, name: e.target.value }))}
          />
          <button
            className={styles.dangerGhost}
            disabled={screens.length <= 1}
            onClick={() => removeScreen(sIndex)}
          >
            <span className="material-icons">delete</span>Delete screen
          </button>
        </div>

        {/* 800x480 frame, same flex rules the CarThing uses */}
        <div className={styles.device}>
          <div className={styles.deviceStatus}>
            <span>{current.name}</span>
            <span className={styles.dots}>
              {screens.map((_, i) => (
                <i key={i} data-active={i === sIndex} />
              ))}
            </span>
            <span>12:45</span>
          </div>
          <div className={styles.deviceScreen}>
            {current.columns.map((col, ci) => (
              <div
                key={ci}
                className={styles.col}
                data-target={ci === targetCol}
                data-empty={col.length === 0}
                style={{
                  flex: col.length
                    ? Math.max(...col.map(w => WIDGETS[w].weight ?? 1))
                    : 1
                }}
                onClick={() => setTargetCol(ci)}
                onDragOver={e => allowDrop(e, ci, col.length)}
                onDragLeave={() => setDropAt(null)}
                onDrop={e => onDrop(e, ci)}
              >
                {col.map((w, wi) => (
                  <div
                    key={w}
                    className={styles.tile}
                    draggable
                    data-drop-before={dropAt?.col === ci && dropAt.index === wi}
                    onDragStart={e => onDragStart(e, { kind: 'tile', widget: w, from: ci })}
                    onDragOver={e => allowDrop(e, ci, wi)}
                    onDrop={e => onDrop(e, ci, wi)}
                  >
                    <span className="material-icons">{WIDGETS[w].icon}</span>
                    <span className={styles.tileLabel}>{WIDGETS[w].label}</span>
                    <button
                      className={styles.tileRemove}
                      title="Remove"
                      onClick={e => {
                        e.stopPropagation()
                        removeWidget(w)
                      }}
                    >
                      <span className="material-icons">close</span>
                    </button>
                  </div>
                ))}
                {dropAt?.col === ci && dropAt.index === col.length && (
                  <div className={styles.dropLine} />
                )}
                {col.length === 0 && (
                  <p className={styles.colEmpty}>Drop a widget here</p>
                )}
                {current.columns.length > 1 && (
                  <button
                    className={styles.colRemove}
                    title="Remove column"
                    onClick={e => {
                      e.stopPropagation()
                      removeColumn(ci)
                    }}
                  >
                    <span className="material-icons">remove</span>
                  </button>
                )}
              </div>
            ))}
            {current.columns.length < MAX_COLUMNS && (
              <button className={styles.addCol} onClick={addColumn} title="Add column">
                <span className="material-icons">add</span>
              </button>
            )}
          </div>
        </div>
        {emptyCols > 0 && (
          <p className={styles.warn}>
            <span className="material-icons">info</span>
            Empty columns are hidden on the CarThing.
          </p>
        )}

        <p className={styles.sectionLabel}>
          Widgets — drag onto a column, or click to add to column {targetCol + 1}
        </p>
        <div className={styles.palette}>
          {WIDGET_ORDER.map(w => (
            // a div, not a <button>: Chromium won't start a drag on buttons
            <div
              key={w}
              role="button"
              tabIndex={0}
              className={styles.chip}
              data-used={used.has(w)}
              draggable
              title={WIDGETS[w].hint}
              onDragStart={e => onDragStart(e, { kind: 'palette', widget: w })}
              onClick={() => placeWidget(w, targetCol)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  placeWidget(w, targetCol)
                }
              }}
            >
              <span className="material-icons">{WIDGETS[w].icon}</span>
              {WIDGETS[w].label}
              {used.has(w) && <span className={styles.chipBadge}>on screen</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default ScreensTab
