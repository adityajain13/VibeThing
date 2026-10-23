import { useOption } from '@/lib/useOption.ts'
import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { useServerTime } from '@/lib/useServerTime.ts'

import styles from './Clock.module.css'

const Clock: React.FC = () => {
  const time = useServerTime()

  const showDate = useOption('clock', 'showDate')

  return (
    <BaseWidget className={styles.clock}>
      <p className={`${styles.time} tnum`}>{time?.time ?? '--:--'}</p>
      {showDate && <p className={styles.date}>{time?.date}</p>}
    </BaseWidget>
  )
}

export default Clock
