import { useContext, useRef } from 'react'

import { hasKnownLength, MediaContext, usePosition } from '@/contexts/MediaContext.tsx'

import { formatTime } from '@/lib/utils.ts'

import styles from './Progress.module.css'

interface ProgressProps {
  showTimes?: boolean
  className?: string
}

/** Track progress; tap anywhere on the bar to seek */
const Progress: React.FC<ProgressProps> = ({ showTimes = true, className }) => {
  const { playerData, supports, actions } = useContext(MediaContext)
  const position = usePosition()
  const barRef = useRef<HTMLDivElement>(null)

  if (!playerData) return null
  const known = hasKnownLength(playerData, position)
  const total = playerData.track.duration.total || 1
  const pct = known ? Math.max(0, Math.min(100, (position / total) * 100)) : 0
  const seekable = known && supports('seek')

  function onPointerDown(e: React.PointerEvent) {
    if (!seekable || !barRef.current) return
    e.stopPropagation()
    const rect = barRef.current.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    actions.seek(f * total)
  }

  return (
    <div className={`${styles.progress} ${className ?? ''}`} data-noswipe>
      {showTimes && <span className="tnum">{formatTime(position)}</span>}
      <div
        className={styles.hit}
        ref={barRef}
        onPointerDown={onPointerDown}
        data-seekable={seekable}
      >
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {showTimes && <span className="tnum">{known ? formatTime(total) : '--:--'}</span>}
    </div>
  )
}

export default Progress
