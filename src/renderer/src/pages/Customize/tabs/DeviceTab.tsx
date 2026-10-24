import React, { useEffect, useRef, useState } from 'react'

import Switch from '@/components/Switch/Switch.js'

import Segmented from '../Segmented.js'
import styles from '../Customize.module.css'

type SleepMethod = 'sleep' | 'screensaver'

/** The CarThing's own settings: clock format, brightness, sleep */
const DeviceTab: React.FC = () => {
  const [loaded, setLoaded] = useState(false)
  const [timeFormat, setTimeFormat] = useState('HH:mm')
  const [dateFormat, setDateFormat] = useState('ddd, D MMM')
  const [autoBrightness, setAutoBrightness] = useState(true)
  const [brightness, setBrightness] = useState(50)
  const [sleepMethod, setSleepMethod] = useState<SleepMethod>('sleep')
  const [hasImage, setHasImage] = useState(false)
  const [imageStatus, setImageStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const brightnessTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    Promise.all([
      window.api.getStorageValue('timeFormat'),
      window.api.getStorageValue('dateFormat'),
      window.api.getStorageValue('autoBrightness'),
      window.api.getStorageValue('brightness'),
      window.api.getStorageValue('sleepMethod'),
      window.api.hasCustomScreensaverImage()
    ]).then(([t, d, ab, b, sm, img]) => {
      setTimeFormat((t as string) || 'HH:mm')
      setDateFormat((d as string) || 'ddd, D MMM')
      setAutoBrightness((ab ?? true) === true)
      setBrightness(Math.round(((b as number) ?? 0.5) * 100))
      setSleepMethod(sm === 'screensaver' ? 'screensaver' : 'sleep')
      setHasImage(Boolean(img))
      setLoaded(true)
    })
    return () => clearTimeout(brightnessTimer.current)
  }, [])

  function save(key: string, value: unknown) {
    window.api.setStorageValue(key, value)
  }

  // each change fades the backlight over adb, so only send where the slider stops
  function changeBrightness(v: number) {
    setBrightness(v)
    clearTimeout(brightnessTimer.current)
    brightnessTimer.current = setTimeout(() => save('brightness', v / 100), 350)
  }

  async function uploadImage() {
    setImageStatus(null)
    const res = await window.api.uploadScreensaverImage()
    if (res?.success) {
      setHasImage(true)
      setImageStatus({ ok: true, text: 'Screensaver image updated.' })
    } else if (res?.message) {
      setImageStatus({ ok: false, text: res.message })
    }
  }

  async function removeImage() {
    setImageStatus(null)
    const ok = await window.api.removeScreensaverImage()
    if (ok) setHasImage(false)
    setImageStatus(ok ? { ok: true, text: 'Back to the default screensaver.' } : { ok: false, text: 'Couldn’t remove the image.' })
  }

  if (!loaded) return null

  return (
    <div className={styles.scrollTab}>
      <section className={styles.card}>
        <h3>
          <span className="material-icons">schedule</span>Time and date
        </h3>
        <p className={styles.help}>Used by the status bar, Clock and Calendar.</p>
        <div className={styles.field}>
          <label>Time</label>
          <Segmented
            value={timeFormat}
            onChange={v => {
              setTimeFormat(v)
              save('timeFormat', v)
            }}
            options={[
              { value: 'HH:mm', label: '24-hour (18:30)' },
              { value: 'h:mm A', label: '12-hour (6:30 PM)' }
            ]}
          />
        </div>
        <div className={styles.field}>
          <label>Date</label>
          <Segmented
            value={dateFormat}
            onChange={v => {
              setDateFormat(v)
              save('dateFormat', v)
            }}
            options={[
              { value: 'ddd, D MMM', label: 'Short (Sat, 24 Oct)' },
              { value: 'dddd, D MMMM', label: 'Long (Saturday, 24 October)' }
            ]}
          />
        </div>
      </section>

      <section className={styles.card}>
        <h3>
          <span className="material-icons">brightness_6</span>Screen brightness
        </h3>
        <div className={styles.field}>
          <label>
            Automatic
            <small>Uses the CarThing’s light sensor</small>
          </label>
          <Switch
            value={autoBrightness}
            onChange={v => {
              setAutoBrightness(v)
              save('autoBrightness', v)
            }}
          />
        </div>
        <div className={styles.dimmable} data-off={autoBrightness}>
          <div className={styles.field}>
            <label>
              Brightness <b>{brightness}%</b>
            </label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={brightness}
              onChange={e => changeBrightness(Number(e.target.value))}
            />
          </div>
        </div>
        <p className={styles.help}>Night mode (in Behaviour) can dim it further on a schedule.</p>
      </section>

      <section className={styles.card}>
        <h3>
          <span className="material-icons">bedtime</span>When the CarThing sleeps
        </h3>
        <Segmented<SleepMethod>
          value={sleepMethod}
          onChange={v => {
            setSleepMethod(v)
            save('sleepMethod', v)
          }}
          options={[
            { value: 'sleep', label: 'Screen off' },
            { value: 'screensaver', label: 'Screensaver' }
          ]}
        />
        {sleepMethod === 'screensaver' && (
          <>
            <div className={styles.field}>
              <label>
                Screensaver image
                <small>{hasImage ? 'Using your own image' : 'Using the default'}</small>
              </label>
              <div className={styles.inline}>
                <button className={styles.primaryBtn} onClick={uploadImage}>
                  <span className="material-icons">upload</span>
                  {hasImage ? 'Replace' : 'Choose image'}
                </button>
                {hasImage && (
                  <button className={styles.dangerGhost} onClick={removeImage}>
                    <span className="material-icons">delete</span>
                    Remove
                  </button>
                )}
              </div>
            </div>
            {imageStatus && (
              <p className={imageStatus.ok ? styles.okNote : styles.warn}>
                <span className="material-icons">{imageStatus.ok ? 'check_circle' : 'error'}</span>
                {imageStatus.text}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default DeviceTab
