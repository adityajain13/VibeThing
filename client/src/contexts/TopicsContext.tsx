import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { SocketContext } from './SocketContext.tsx'

const TOPICS = ['weather', 'system', 'calendar', 'mixer', 'notifications'] as const
export type Topic = (typeof TOPICS)[number]

interface TopicsContextProps {
  data: Partial<Record<Topic, unknown>>
  setWanted: (topics: Topic[]) => void
  /** Keep a topic running while the returned function has not been called */
  want: (topic: Topic) => () => void
}

const TopicsContext = createContext<TopicsContextProps>({
  data: {},
  setWanted: () => {},
  want: () => () => {}
})

/**
 * Widget data streams. The visible screen tells the server which topics it
 * needs, so nothing is polled on the PC for widgets that aren't on screen.
 */
const TopicsContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { ready, socket } = useContext(SocketContext)
  const [data, setData] = useState<Partial<Record<Topic, unknown>>>({})
  const [wanted, setWantedState] = useState<Topic[]>([])
  // topics wanted by components regardless of the screen, with a count of who wants them
  const [extra, setExtra] = useState<Partial<Record<Topic, number>>>({})

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

  const want = useCallback((topic: Topic) => {
    setExtra(e => ({ ...e, [topic]: (e[topic] ?? 0) + 1 }))
    let released = false
    return () => {
      if (released) return
      released = true
      setExtra(e => {
        const count = (e[topic] ?? 0) - 1
        const next = { ...e }
        if (count > 0) next[topic] = count
        else delete next[topic]
        return next
      })
    }
  }, [])

  const allWanted = new Set<Topic>(wanted)
  for (const topic of TOPICS) if ((extra[topic] ?? 0) > 0) allWanted.add(topic)
  const wantedKey = [...allWanted].sort().join(',')

  useEffect(() => {
    if (!ready || !socket) return
    socket.send(JSON.stringify({ type: 'subscribe', data: wantedKey ? wantedKey.split(',') : [] }))
  }, [ready, socket, wantedKey])

  return (
    <TopicsContext.Provider value={{ data, setWanted: setWantedState, want }}>
      {children}
    </TopicsContext.Provider>
  )
}

export function useTopic<T>(topic: Topic): T | undefined {
  return useContext(TopicsContext).data[topic] as T | undefined
}

/** Subscribe to a topic from any component while enabled, whatever the screen */
export function useWantTopic(topic: Topic, enabled: boolean) {
  const { want } = useContext(TopicsContext)
  useEffect(() => {
    if (!enabled) return
    return want(topic)
  }, [want, topic, enabled])
}

export { TopicsContext, TopicsContextProvider, TOPICS }
