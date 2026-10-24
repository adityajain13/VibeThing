import React from 'react'
import styles from './Native.module.css'

interface NativeProps {
  onStepComplete: () => void
}

const Native: React.FC<NativeProps> = ({ onStepComplete }) => {
  return (
    <div className={styles.native}>
      <p>
        This will use your operating system&apos;s playback service to
        provide updates and controls.
      </p>
      <p style={{ fontSize: 14, color: '#aaa', marginTop: 8 }}>
        Works with anything that shows up in Windows&apos; media controls
        (Spotify, browsers, most players). VLC 3 doesn&apos;t report to
        Windows on its own; install the free{' '}
        <a
          href="https://github.com/spmn/vlc-win10smtc"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--brand-hi)' }}
        >
          vlc-win10smtc
        </a>{' '}
        plugin to make it work.
      </p>
      <div className={styles.buttons}>
        <button onClick={onStepComplete}>Continue</button>
      </div>
    </div>
  )
}

export default Native
