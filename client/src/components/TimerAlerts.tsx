import { useContext, useEffect } from 'react'

import { SocketContext } from '@/contexts/SocketContext.tsx'
import { UIContext } from '@/contexts/UIContext.tsx'

import { timer } from '@/lib/timerStore.ts'

/** When the timer finishes, wherever you are: toast here, notification on the PC */
const TimerAlerts: React.FC = () => {
  const { socket } = useContext(SocketContext)
  const { toast } = useContext(UIContext)

  useEffect(
    () =>
      timer.onDone(() => {
        toast('timer', "Time's up")
        socket?.send(JSON.stringify({ type: 'timer', action: 'done', data: timer.get().setMs }))
      }),
    [socket, toast]
  )

  return null
}

export default TimerAlerts
