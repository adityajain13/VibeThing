import { useOption } from '@/lib/useOption.ts'
import { useContext } from 'react'

import { ConfigContext } from '@/contexts/ConfigContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import { UIContext } from '@/contexts/UIContext.tsx'

import { useServerTime } from '@/lib/useServerTime.ts'

import styles from './Statusbar.module.css'

const Statusbar: React.FC = () => {
  const { ready } = useContext(SocketContext)
  const { screens } = useContext(ConfigContext)
  const { screen, setScreen } = useContext(UIContext)
  const time = useServerTime()

  const showDate = useOption('statusbar', 'showDate')
  const showPages = useOption('statusbar', 'showPages')

  return (
    <div className={styles.statusbar}>
      <div className={`${styles.time} tnum`}>{time?.time}</div>
      {showDate && <div className={styles.date}>{time?.date}</div>}
      {showPages && screens.length > 1 && (
        <div className={styles.pages}>
          {screens.map((s, i) => (
            <button
              key={s.id}
              className={styles.page}
              data-active={i === screen}
              onClick={() => setScreen(i)}
              tabIndex={-1}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {!ready && <span className={`material-icons ${styles.offline}`}>link_off</span>}
    </div>
  )
}

export default Statusbar
