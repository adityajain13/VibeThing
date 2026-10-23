import { useContext, useEffect, useState } from 'react'

import { MediaContext } from '@/contexts/MediaContext.tsx'

import styles from './VolumeOverlay.module.css'

/** Shows briefly whenever the volume changes */
const VolumeOverlay: React.FC<{ fixed?: boolean }> = ({ fixed }) => {
  const { volume, volumeChangedAt, supports } = useContext(MediaContext)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!volumeChangedAt) return
    setShown(true)
    const t = setTimeout(() => setShown(false), 1500)
    return () => clearTimeout(t)
  }, [volumeChangedAt])

  if (!supports('volume')) return null

  return (
    <div className={styles.overlay} data-shown={shown} data-fixed={fixed === true}>
      <span className="material-icons">
        {volume === 0 ? 'volume_off' : volume < 50 ? 'volume_down' : 'volume_up'}
      </span>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${volume}%` }} />
      </div>
      <span className={`${styles.value} tnum`}>{volume}</span>
    </div>
  )
}

export default VolumeOverlay
