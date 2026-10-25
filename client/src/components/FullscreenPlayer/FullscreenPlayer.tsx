import { useChoice, useOption } from '@/lib/useOption.ts'
import { useServerTime } from '@/lib/useServerTime.ts'
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { MediaContext } from '@/contexts/MediaContext.tsx'
import { FullscreenView, UIContext } from '@/contexts/UIContext.tsx'

import Progress from '@/components/Progress/Progress.tsx'
import LyricsView from '@/components/LyricsView/LyricsView.tsx'
import VolumeOverlay from '@/components/VolumeOverlay/VolumeOverlay.tsx'

import styles from './FullscreenPlayer.module.css'

const VIEWS: { id: FullscreenView; label: string }[] = [
  { id: 'cover', label: 'Now playing' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'queue', label: 'Up next' }
]

const Queue: React.FC = () => {
  const { queue, playerData, actions } = useContext(MediaContext)
  const listRef = useRef<HTMLDivElement>(null)
  const trackId = playerData?.track.id ?? playerData?.track.name

  useEffect(() => {
    actions.requestQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId])

  if (!playerData?.supportedActions.includes('queue'))
    return <p className={styles.empty}>Your player doesn't share its queue</p>
  if (!queue) return <p className={styles.empty}>Loading the queue…</p>
  if (queue.length === 0) return <p className={styles.empty}>Nothing queued up</p>

  return (
    <div className={styles.queue} ref={listRef}>
      {queue.map((item, i) => (
        <div key={i} className={styles.queueItem}>
          {item.image ? (
            <img src={item.image} alt="" />
          ) : (
            <span className={`material-icons ${styles.queueArt}`}>music_note</span>
          )}
          <div className={styles.queueText}>
            <p className={styles.queueName}>{item.name}</p>
            <p className={styles.queueArtists}>{item.artists.join(', ')}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const FullscreenPlayer: React.FC = () => {
  const { fullscreen, setFullscreen } = useContext(UIContext)
  const showAlbum = useOption('fullscreen', 'showAlbum')
  const showTime = useOption('fullscreen', 'showTime')
  const layout = useChoice('fullscreen', 'layout')
  const time = useServerTime()
  const { image, playerData, actions, supports } = useContext(MediaContext)

  // keep the art's own shape (video thumbnails are 16:9) inside a box that fits the layout
  // on top, the cover gets whatever height the text leaves (text sizes are adjustable)
  const nowRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const [aboveHeight, setAboveHeight] = useState(160)
  const box = layout === 'above' ? { w: 360, h: aboveHeight } : { w: 420, h: 300 }
  const [aspect, setAspect] = useState(1)
  useEffect(() => {
    if (!image) return setAspect(1)
    const img = new Image()
    img.onload = () =>
      setAspect(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1)
    img.src = image
  }, [image])
  const coverWidth = Math.round(Math.min(box.w, box.h * aspect))
  const coverSize = { width: coverWidth, height: Math.round(coverWidth / aspect) }

  useLayoutEffect(() => {
    if (layout !== 'above' || !nowRef.current || !infoRef.current) return
    const now = nowRef.current
    const cs = getComputedStyle(now)
    const free =
      now.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - infoRef.current.offsetHeight - 30
    const next = Math.max(80, Math.min(240, Math.floor(free)))
    if (Math.abs(next - aboveHeight) > 2) setAboveHeight(next)
  })
  const shown = fullscreen !== null
  const view = fullscreen ?? 'cover'

  const latest = useRef({ shown, actions, view })
  latest.current = { shown, actions, view }

  // knob: volume, knob press: play/pause (the queue scrolls via touch)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const { shown, actions } = latest.current
      if (!shown || e.deltaX === 0) return
      e.preventDefault()
      actions.changeVolume(e.deltaX > 0 ? 1 : -1)
    }
    const onKey = (e: KeyboardEvent) => {
      const { shown, actions } = latest.current
      if (!shown) return
      if (e.key === 'Enter') actions.playPause()
      else if (e.key === 'ArrowLeft') actions.changeVolume(-1)
      else if (e.key === 'ArrowRight') actions.changeVolume(1)
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (shown) (document.activeElement as HTMLElement | null)?.blur()
  }, [shown])

  const repeatIcon = playerData?.repeat === 'one' ? 'repeat_one' : 'repeat'

  return (
    <div className={styles.player} data-shown={shown} data-view={view}>
      {image && <img src={image} alt="" className={styles.background} />}

      <div className={styles.top}>
        <button className={styles.close} onClick={() => setFullscreen(null)} aria-label="Close">
          <span className="material-icons">keyboard_arrow_down</span>
        </button>
        {showTime && time && <span className={`${styles.clock} tnum`}>{time.time}</span>}
        <div className={styles.tabs}>
          {VIEWS.map(v => (
            <button
              key={v.id}
              className={styles.tab}
              data-active={v.id === view}
              onClick={() => setFullscreen(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        {supports('like') && playerData ? (
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
        ) : (
          <span className={styles.spacer} />
        )}
      </div>

      {!playerData ? (
        <p className={styles.empty}>Nothing playing</p>
      ) : (
        <div className={styles.body}>
          {view === 'cover' && (
            <div className={styles.now} data-layout={layout} ref={nowRef}>
              <div className={styles.cover} style={coverSize}>
                {image ? <img src={image} alt="" /> : <span className="material-icons">music_note</span>}
              </div>
              <div className={styles.info} ref={infoRef}>
                <p className={styles.title}>{playerData.track.name}</p>
                <p className={styles.artist}>{playerData.track.artists.join(', ')}</p>
                {showAlbum && <p className={styles.album}>{playerData.track.album}</p>}
                <Progress className={styles.progress} />
                <div className={styles.controls}>
                  {/* only offer what the current player can actually do */}
                  {supports('shuffle') && (
                    <button
                      data-toggle={playerData.shuffle}
                      onClick={() => actions.shuffle(!playerData.shuffle)}
                      aria-label="Shuffle"
                    >
                      <span className="material-icons">shuffle</span>
                    </button>
                  )}
                  {supports('previous') && (
                    <button onClick={actions.skipBackward} aria-label="Previous">
                      <span className="material-icons">skip_previous</span>
                    </button>
                  )}
                  <button className={styles.play} onClick={actions.playPause} aria-label={playerData.isPlaying ? 'Pause' : 'Play'}>
                    <span className="material-icons">{playerData.isPlaying ? 'pause' : 'play_arrow'}</span>
                  </button>
                  {supports('next') && (
                    <button onClick={actions.skipForward} aria-label="Next">
                      <span className="material-icons">skip_next</span>
                    </button>
                  )}
                  {supports('repeat') && (
                    <button
                      data-toggle={playerData.repeat !== 'off'}
                      onClick={() =>
                        actions.repeat(playerData.repeat === 'off' ? 'on' : playerData.repeat === 'on' ? 'one' : 'off')
                      }
                      aria-label="Repeat"
                    >
                      <span className="material-icons">{repeatIcon}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'lyrics' && (
            <div className={styles.lyrics}>
              <LyricsView size="large" />
            </div>
          )}

          {view === 'queue' && <Queue />}

          {view !== 'cover' && (
            <div className={styles.mini}>
              {image && <img src={image} alt="" />}
              <div className={styles.miniText}>
                <p className={styles.miniTitle}>{playerData.track.name}</p>
                <p className={styles.miniArtist}>{playerData.track.artists.join(', ')}</p>
              </div>
              <Progress showTimes={false} className={styles.miniProgress} />
              <button className={styles.miniPlay} onClick={actions.playPause} aria-label={playerData.isPlaying ? 'Pause' : 'Play'}>
                <span className="material-icons">{playerData.isPlaying ? 'pause' : 'play_arrow'}</span>
              </button>
            </div>
          )}
        </div>
      )}
      <VolumeOverlay />
    </div>
  )
}

export default FullscreenPlayer
