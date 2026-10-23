import { useContext } from 'react'

import { UIContext } from '@/contexts/UIContext.tsx'

import styles from './Toast.module.css'

/** Brief confirmation for actions that have no other visible effect */
const Toast: React.FC = () => {
  const { toastState } = useContext(UIContext)

  return (
    <div className={styles.toast} data-shown={toastState !== null}>
      {toastState && (
        <>
          <span className="material-icons">{toastState.icon}</span>
          <p>{toastState.text}</p>
        </>
      )}
    </div>
  )
}

export default Toast
