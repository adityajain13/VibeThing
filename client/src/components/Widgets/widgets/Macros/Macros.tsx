import { useOption } from '@/lib/useOption.ts'
import { useContext, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { ConfigContext } from '@/contexts/ConfigContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'

import { useRunAction } from '@/lib/useRunAction.ts'

import styles from './Macros.module.css'

const Macros: React.FC = () => {
  const { macros } = useContext(ConfigContext)
  const { socket } = useContext(SocketContext)
  const run = useRunAction()
  const rootRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(0)
  const showNames = useOption('macros', 'showNames')
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!socket) return
    const listener = (e: MessageEvent) => {
      const { type, action, data } = JSON.parse(e.data)
      if (type === 'macros' && action === 'result') setFlash(data)
    }
    socket.addEventListener('message', listener)
    return () => socket.removeEventListener('message', listener)
  }, [socket])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 700)
    return () => clearTimeout(t)
  }, [flash])

  useEffect(() => {
    const listener = (e: WheelEvent) => {
      if (!rootRef.current?.matches(':focus-within') || e.deltaX === 0) return
      e.preventDefault()
      setSelected(s => (s + (e.deltaX > 0 ? 1 : -1) + macros.length) % Math.max(1, macros.length))
    }
    document.addEventListener('wheel', listener, { passive: false })
    return () => document.removeEventListener('wheel', listener)
  }, [macros.length])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && macros[selected]) run({ type: 'macro', id: macros[selected].id })
  }

  const focused = rootRef.current?.matches(':focus-within')

  return (
    <BaseWidget className={styles.macros} onKeyDown={onKeyDown} ref={rootRef}>
      {macros.length === 0 ? (
        <p className={styles.empty}>Add macros in the desktop app to trigger them from here.</p>
      ) : (
        <div className={styles.grid}>
          {macros.map((m, i) => (
            <button
              key={m.id}
              className={styles.macro}
              data-selected={focused && i === selected}
              data-result={flash?.id === m.id ? (flash.ok ? 'ok' : 'fail') : undefined}
              onClick={() => run({ type: 'macro', id: m.id })}
            >
              <span className="material-icons" style={{ background: m.color }}>
                {m.icon}
              </span>
              {showNames && <p>{m.name}</p>}
            </button>
          ))}
        </div>
      )}
    </BaseWidget>
  )
}

export default Macros
