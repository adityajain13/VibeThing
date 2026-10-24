import { useContext, useEffect, useState } from 'react'

import { SocketContext } from '@/contexts/SocketContext.tsx'

/** Time and date strings formatted by the desktop app (CarThing has no reliable clock) */
export function useServerTime() {
  const { ready, socket } = useContext(SocketContext)
  const [time, setTime] = useState<{ time: string; date: string } | null>(null)

  useEffect(() => {
    if (!ready || !socket) return
    const listener = (e: MessageEvent) => {
      const { type, data } = JSON.parse(e.data)
      if (type === 'time') setTime(data)
    }
    socket.addEventListener('message', listener)
    socket.send(JSON.stringify({ type: 'time' }))
    return () => socket.removeEventListener('message', listener)
  }, [ready, socket])

  return time
}
