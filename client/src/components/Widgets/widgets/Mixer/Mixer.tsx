import { useContext, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { SocketContext } from '@/contexts/SocketContext.tsx'
import { useTopic } from '@/contexts/TopicsContext.tsx'

import { MixerData } from '@/types/Widgets.js'

import styles from './Mixer.module.css'

interface Row {
  id: string
  name: string
  volume: number
  muted: boolean
  icon: string | null
  fallbackIcon: string
}

const STEP = 5

const Slider: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const ref = useRef<HTMLDivElement>(null)

  function update(e: React.PointerEvent) {
    const rect = ref.current!.getBoundingClientRect()
    onChange(Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100))
  }

  return (
    <div
      className={styles.slider}
      ref={ref}
      data-noswipe
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e)
      }}
      onPointerMove={e => {
        if (e.buttons) update(e)
      }}
    >
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

const Mixer: React.FC = () => {
  const { socket } = useContext(SocketContext)
  const data = useTopic<MixerData>('mixer')
  const rootRef = useRef<HTMLDivElement>(null)

  // optimistic values so sliders don't snap back while the PC catches up
  const [local, setLocal] = useState<Record<string, { volume?: number; muted?: boolean; at: number }>>({})
  const [selected, setSelected] = useState(0)
  const [adjusting, setAdjusting] = useState(false)
  const sendTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const rows: Row[] = []
  if (data && !data.unsupported) {
    if (data.master)
      rows.push({ id: 'master', name: 'PC volume', ...data.master, icon: null, fallbackIcon: 'speaker' })
    for (const s of data.sessions ?? [])
      rows.push({ ...s, fallbackIcon: s.id === 'system' ? 'notifications' : 'apps' })
  }

  const view = rows.map(r => {
    const l = local[r.id]
    if (!l || Date.now() - l.at > 1500) return r
    return { ...r, volume: l.volume ?? r.volume, muted: l.muted ?? r.muted }
  })

  function setVolume(id: string, volume: number) {
    setLocal(l => ({ ...l, [id]: { ...l[id], volume, muted: volume > 0 ? false : l[id]?.muted, at: Date.now() } }))
    clearTimeout(sendTimers.current[id])
    sendTimers.current[id] = setTimeout(
      () => socket?.send(JSON.stringify({ type: 'mixer', action: 'volume', data: { id, volume } })),
      80
    )
  }

  function toggleMute(row: Row) {
    setLocal(l => ({ ...l, [row.id]: { ...l[row.id], muted: !row.muted, at: Date.now() } }))
    socket?.send(JSON.stringify({ type: 'mixer', action: 'mute', data: { id: row.id, muted: !row.muted } }))
  }

  function toggleMic() {
    if (!data?.mic) return
    setLocal(l => ({ ...l, mic: { muted: !data.mic!.muted, at: Date.now() } }))
    socket?.send(JSON.stringify({ type: 'mixer', action: 'mute', data: { id: 'mic', muted: !data.mic.muted } }))
  }

  const micMuted =
    local.mic && Date.now() - local.mic.at < 1500 ? local.mic.muted : data?.mic?.muted

  const latest = useRef({ view, selected, adjusting, setVolume })
  latest.current = { view, selected, adjusting, setVolume }

  useEffect(() => {
    const listener = (e: WheelEvent) => {
      if (!rootRef.current?.matches(':focus-within') || e.deltaX === 0) return
      e.preventDefault()
      const { view, selected, adjusting, setVolume } = latest.current
      const dir = e.deltaX > 0 ? 1 : -1
      if (adjusting) {
        const row = view[selected]
        if (row) setVolume(row.id, Math.max(0, Math.min(100, row.volume + dir * STEP)))
      } else {
        setSelected(s => Math.max(0, Math.min(view.length - 1, s + dir)))
      }
    }
    document.addEventListener('wheel', listener, { passive: false })
    return () => document.removeEventListener('wheel', listener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-row="${selected}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') setAdjusting(a => !a)
    else if (e.key === 'ArrowLeft') document.dispatchEvent(new WheelEvent('wheel', { deltaX: -1 }))
    else if (e.key === 'ArrowRight') document.dispatchEvent(new WheelEvent('wheel', { deltaX: 1 }))
  }

  const focused = rootRef.current?.matches(':focus-within')

  let body: React.ReactNode
  if (!data) body = <p className={styles.empty}>Connecting to your PC's audio…</p>
  else if (data.unsupported) body = <p className={styles.empty}>The volume mixer needs Windows</p>
  else
    body = view.map((row, i) => (
      <div
        key={row.id}
        className={styles.row}
        data-row={i}
        data-selected={focused && i === selected}
        data-adjusting={focused && adjusting && i === selected}
        data-muted={row.muted}
      >
        <button className={styles.icon} onClick={() => toggleMute(row)} aria-label={row.muted ? `Unmute ${row.name}` : `Mute ${row.name}`}>
          {row.icon ? <img src={row.icon} alt="" /> : <span className="material-icons">{row.fallbackIcon}</span>}
          {row.muted && <span className={`material-icons ${styles.mutedBadge}`}>volume_off</span>}
        </button>
        <div className={styles.info}>
          <div className={styles.head}>
            <p className={styles.name}>{row.name}</p>
            <p className={`${styles.value} tnum`}>{row.muted ? 'Muted' : row.volume}</p>
          </div>
          <Slider value={row.muted ? 0 : row.volume} onChange={v => setVolume(row.id, v)} />
        </div>
      </div>
    ))

  return (
    <BaseWidget className={styles.mixer} onKeyDown={onKeyDown} onBlur={() => setAdjusting(false)} ref={rootRef}>
      <div className={styles.header}>
        <p className={styles.heading}>Mixer</p>
        {data?.mic && (
          <button className={styles.mic} data-muted={micMuted === true} onClick={toggleMic}>
            <span className="material-icons">{micMuted ? 'mic_off' : 'mic'}</span>
            {micMuted ? 'Mic muted' : 'Mic on'}
          </button>
        )}
      </div>
      <div className={styles.list} data-noswipe>
        {body}
      </div>
    </BaseWidget>
  )
}

export default Mixer
