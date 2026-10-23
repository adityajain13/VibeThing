import { useContext, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { activeLyricIndex, MediaContext, usePosition } from '@/contexts/MediaContext.tsx'
import { ConfigContext } from '@/contexts/ConfigContext.tsx'
import { UIContext } from '@/contexts/UIContext.tsx'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'
import Progress from '@/components/Progress/Progress.tsx'
import VolumeOverlay from '@/components/VolumeOverlay/VolumeOverlay.tsx'

import styles from './Player.module.css'

const LyricLine: React.FC = () => {
  const { lyrics } = useContext(MediaContext)
  const position = usePosition(300)
  const idx = activeLyricIndex(lyrics, position)
  const line = idx >= 0 ? lyrics!.synced![idx].text : ''

  return (
    <p className={styles.lyric} key={idx}>
      {line || ' '}
    </p>
  )
}

const Player: React.FC = () => {
  const { actions, playerData, playerDataRef, image, lyrics, supports } = useContext(MediaContext)
  const config = useContext(ConfigContext)
  const { setFullscreen } = useContext(UIContext)

  const playerRef = useRef<HTMLDivElement>(null)

  const coverClicks = useRef(0)
  const coverClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [coverAction, setCoverAction] = useState<string | null>(null)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') actions.playPause()
    else if (e.key === 'ArrowLeft') actions.changeVolume(-1)
    else if (e.key === 'ArrowRight') actions.changeVolume(1)
  }

  // knob turns adjust volume while the player is focused
  useEffect(() => {
    const listener = (e: WheelEvent) => {
      if (!playerRef.current?.matches(':focus-within') || e.deltaX === 0) return
      e.preventDefault()
      actions.changeVolume(e.deltaX > 0 ? 1 : -1)
    }
    document.addEventListener('wheel', listener, { passive: false })
    return () => document.removeEventListener('wheel', listener)
  })

  // tap: play/pause, double tap: next, triple tap: previous
  function handleCoverPress() {
    coverClicks.current++
    if (coverClickTimer.current) clearTimeout(coverClickTimer.current)
    coverClickTimer.current = setTimeout(() => {
      if (coverClicks.current === 1) {
        setCoverAction(playerDataRef.current?.isPlaying ? 'pause' : 'play_arrow')
        actions.playPause()
      } else if (coverClicks.current === 2) {
        setCoverAction('skip_next')
        actions.skipForward()
      } else {
        setCoverAction('skip_previous')
        actions.skipBackward()
      }
      coverClicks.current = 0
    }, 220)
  }

  useEffect(() => {
    if (!coverAction) return
    const t = setTimeout(() => setCoverAction(null), 600)
    return () => clearTimeout(t)
  }, [coverAction])

  const showLyric = config.playerLyricsLine && Boolean(lyrics?.synced?.length)
  const p = config.player

  // side-by-side: the cover is a square that fits the slot height and half its width,
  // scaled by Cover size (Chrome 69 has no CSS min(), so measure it here)
  const hasTrack = playerData !== null
  const [sideCover, setSideCover] = useState<number | null>(null)
  useEffect(() => {
    const el = playerRef.current
    if (!el) return
    const measure = () => {
      const isSide = getComputedStyle(el).flexDirection === 'row'
      if (!isSide) return setSideCover(null)
      const cs = getComputedStyle(el)
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      setSideCover(Math.max(40, Math.floor(Math.min(h, w * 0.5) * (p.coverSize / 100))))
    }
    measure()
    window.addEventListener('resize', measure)
    const t = setTimeout(measure, 50) // after BaseWidget settles its size class
    return () => {
      window.removeEventListener('resize', measure)
      clearTimeout(t)
    }
  }, [p.layout, p.coverSize, hasTrack])

  const vars = {
    ...(sideCover ? { '--side-cover': `${sideCover}px` } : {}),
    '--cover-size': p.coverSize / 100,
    '--text-scale': p.textScale / 100,
    '--controls-scale': p.controlsScale / 100
  } as React.CSSProperties

  return (
    <BaseWidget
      className={styles.player}
      onKeyDown={onKeyDown}
      ref={playerRef}
      style={vars}
      data-layout={p.layout}
      data-cover-align={p.coverAlign}
      data-text-align={p.textAlign}
    >
      {playerData ? (
        <>
          {image && p.glow && <img className={styles.glow} src={image} alt="" />}
          <button className={styles.cover} onMouseDown={handleCoverPress}>
            {image ? (
              <img src={image} alt="" />
            ) : (
              <span className={`material-icons ${styles.placeholder}`}>music_note</span>
            )}
            <span className={`material-icons ${styles.action}`} data-shown={coverAction !== null}>
              {coverAction}
            </span>
          </button>
          <div className={styles.meta}>
            <div className={styles.titleRow} data-like={p.showLike && supports('like')}>
              <div className={styles.text} onClick={() => setFullscreen('cover')}>
                <p className={styles.name}>{playerData.track.name}</p>
                <p className={styles.artists}>{playerData.track.artists.join(', ')}</p>
              </div>
              {p.showLike && supports('like') && (
                <button
                  className={styles.like}
                  data-liked={playerData.track.liked === true}
                  onClick={actions.toggleLike}
                  aria-label={playerData.track.liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                >
                  <span className="material-icons">
                    {playerData.track.liked ? 'favorite' : 'favorite_border'}
                  </span>
                </button>
              )}
            </div>
            {showLyric && (
              <div onClick={() => setFullscreen('lyrics')}>
                <LyricLine />
              </div>
            )}
            {p.showProgress && <Progress className={styles.progress} showTimes={p.showTimes} />}
            {p.showControls && (
              <div className={styles.controls}>
                <button onMouseDown={actions.skipBackward} aria-label="Previous">
                  <span className="material-icons">skip_previous</span>
                </button>
                <button className={styles.play} onMouseDown={actions.playPause} aria-label={playerData.isPlaying ? 'Pause' : 'Play'}>
                  <span className="material-icons">{playerData.isPlaying ? 'pause' : 'play_arrow'}</span>
                </button>
                <button onMouseDown={actions.skipForward} aria-label="Next">
                  <span className="material-icons">skip_next</span>
                </button>
              </div>
            )}
          </div>
          <VolumeOverlay />
        </>
      ) : (
        <div className={styles.notPlaying}>
          <span className="material-icons">music_note</span>
          <p className={styles.title}>Nothing playing</p>
          <p className={styles.note}>Start something on your PC and it shows up here.</p>
        </div>
      )}
    </BaseWidget>
  )
}

export default Player
