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
      } else if (coverClicks.current === 2 && supports('next')) {
        setCoverAction('skip_next')
        actions.skipForward()
      } else if (coverClicks.current >= 3 && supports('previous')) {
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

  // The cover is sized in px from measured space. The CarThing runs Chrome 69,
  // where % heights inside the flex layout don't resolve (the art spilled over
  // the text) and CSS min() doesn't exist.
  //  - stacked: a square filling the space left above the text
  //  - side: a square fitting the slot height and half its width
  const coverRef = useRef<HTMLButtonElement>(null)
  const [coverPx, setCoverPx] = useState<{ w: number; h: number } | null>(null)
  // width / height of the current art; video thumbnails are usually 16:9
  const [aspect, setAspect] = useState(1)
  useEffect(() => {
    if (!image) return setAspect(1)
    const img = new Image()
    img.onload = () => setAspect(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1)
    img.src = image
  }, [image])
  const trackKey = playerData ? `${playerData.track.name}|${playerData.track.artists.join(',')}` : ''
  useEffect(() => {
    const el = playerRef.current
    if (!el) return
    const measure = () => {
      const cover = coverRef.current
      if (!cover) return
      const cs = getComputedStyle(el)
      const scale = p.coverSize / 100
      let maxW: number, maxH: number
      if (cs.flexDirection === 'row') {
        maxH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        // wide art may take a little more of the row than square art
        maxW = (el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * (aspect > 1.1 ? 0.58 : 0.5)
      } else {
        maxH = cover.clientHeight
        maxW = cover.clientWidth
      }
      // largest box with the art's proportions that fits, then scaled
      const w = Math.min(maxW, maxH * aspect) * scale
      const next = { w: Math.max(40, Math.floor(w)), h: Math.max(40, Math.floor(w / aspect)) }
      setCoverPx(prev => (prev && prev.w === next.w && prev.h === next.h ? prev : next))
    }
    measure()
    window.addEventListener('resize', measure)
    // again once BaseWidget has settled its size class and fonts have loaded
    const t1 = setTimeout(measure, 60)
    const t2 = setTimeout(measure, 500)
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts
    fonts?.ready.then(measure)
    return () => {
      window.removeEventListener('resize', measure)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [p.layout, p.coverSize, p.textScale, p.controlsScale, p.showControls, p.showProgress, p.showTimes, showLyric, trackKey, aspect])

  const vars = {
    ...(coverPx ? { '--cover-w': `${coverPx.w}px`, '--cover-h': `${coverPx.h}px` } : {}),
    '--cover-size': p.coverSize / 100,
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
          <button
            className={styles.cover}
            onMouseDown={handleCoverPress}
            ref={coverRef}
            data-measured={coverPx !== null}
          >
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
                {supports('previous') && (
                  <button onMouseDown={actions.skipBackward} aria-label="Previous">
                    <span className="material-icons">skip_previous</span>
                  </button>
                )}
                <button className={styles.play} onMouseDown={actions.playPause} aria-label={playerData.isPlaying ? 'Pause' : 'Play'}>
                  <span className="material-icons">{playerData.isPlaying ? 'pause' : 'play_arrow'}</span>
                </button>
                {supports('next') && (
                  <button onMouseDown={actions.skipForward} aria-label="Next">
                    <span className="material-icons">skip_next</span>
                  </button>
                )}
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
