import React, { createContext, useContext, useEffect, useState } from 'react'

import { SocketContext } from './SocketContext.tsx'

const TOPICS = ['weather', 'system', 'calendar', 'mixer'] as const
export type Topic = (typeof TOPICS)[number]

interface TopicsContextProps {
  data: Partial<Record<Topic, unknown>>
  setWanted: (topics: Topic[]) => void
}

const TopicsContext = createContext<TopicsContextProps>({
  data: {},
  setWanted: () => {}
})

/**
 * Widget data streams. The visible screen tells the server which topics it
 * needs, so nothing is polled on the PC for widgets that aren't on screen.
 */
const TopicsContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { ready, socket } = useContext(SocketContext)
  const [data, setData] = useState<Partial<Record<Topic, unknown>>>({})
  const [wanted, setWantedState] = useState<Topic[]>([])

  useEffect(() => {
    if (!ready || !socket) return
    const listener = (e: MessageEvent) => {
      const { type, data } = JSON.parse(e.data)
      if (!(TOPICS as readonly string[]).includes(type)) return
      setData(d => ({ ...d, [type]: data }))
    }
    socket.addEventListener('message', listener)
    return () => socket.removeEventListener('message', listener)
  }, [ready, socket])

  const wantedKey = [...wanted].sort().join(',')

  useEffect(() => {
    if (!ready || !socket) return
    socket.send(JSON.stringify({ type: 'subscribe', data: wantedKey ? wantedKey.split(',') : [] }))
  }, [ready, socket, wantedKey])

  return (
    <TopicsContext.Provider value={{ data, setWanted: setWantedState }}>
      {children}
    </TopicsContext.Provider>
  )
}

export function useTopic<T>(topic: Topic): T | undefined {
  return useContext(TopicsContext).data[topic] as T | undefined
}

export { TopicsContext, TopicsContextProvider, TOPICS }
