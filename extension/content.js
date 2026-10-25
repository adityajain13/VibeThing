// Reads what's playing on this YouTube / YouTube Music tab and presses its like button on request.
;(() => {
  const site = location.hostname.startsWith('music.') ? 'ytmusic' : 'youtube'

  function likeButton() {
    if (site === 'ytmusic') {
      return document.querySelector(
        'ytmusic-player-bar ytmusic-like-button-renderer #button-shape-like button, ' +
          'ytmusic-player-bar ytmusic-like-button-renderer .like button, ' +
          'ytmusic-player-bar ytmusic-like-button-renderer button'
      )
    }
    // Shorts first when one is on screen, then the normal watch page (new and old layouts)
    return document.querySelector(
      'ytd-reel-video-renderer[is-active] like-button-view-model button, ' +
        'ytd-watch-metadata like-button-view-model button, ' +
        'ytd-watch-metadata #segmented-like-button button, ' +
        '#top-level-buttons-computed like-button-view-model button'
    )
  }

  function liked() {
    if (site === 'ytmusic') {
      const r = document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer')
      const status = r && r.getAttribute('like-status')
      if (status) return status === 'LIKE'
    }
    const b = likeButton()
    if (!b) return null
    const pressed = b.getAttribute('aria-pressed')
    return pressed === 'true' ? true : pressed === 'false' ? false : null
  }

  function title() {
    // the same title Windows shows, so VibeThing can match the two
    const md = navigator.mediaSession && navigator.mediaSession.metadata
    if (md && md.title) return md.title
    if (site === 'ytmusic') {
      const t = document.querySelector('ytmusic-player-bar .title')
      return t ? t.textContent.trim() : ''
    }
    const h = document.querySelector('ytd-watch-metadata h1')
    return h ? h.textContent.trim() : document.title.replace(/ - YouTube$/, '')
  }

  function videoId() {
    const v = new URL(location.href).searchParams.get('v')
    if (v) return v
    const m = location.pathname.match(/^\/shorts\/([^/?]+)/)
    return m ? m[1] : null
  }

  function state() {
    const video = document.querySelector('video')
    if (!video || !video.src) return null
    const t = title()
    if (!t) return null
    return {
      site,
      title: t,
      videoId: videoId(),
      playing: !video.paused && !video.ended,
      liked: liked()
    }
  }

  let last = ''
  let lastSent = 0
  const timer = setInterval(() => {
    const s = state()
    const key = JSON.stringify(s)
    // report changes straight away, otherwise a heartbeat so VibeThing knows we're here
    if (key === last && Date.now() - lastSent < 5000) return
    last = key
    lastSent = Date.now()
    try {
      chrome.runtime.sendMessage({ type: 'media', data: s }).catch(() => {})
    } catch {
      // the extension was reloaded or removed; this old copy of the script should stop
      clearInterval(timer)
    }
  }, 700)

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type !== 'like') return
    const current = liked()
    if (current === null || current === msg.liked) return
    const b = likeButton()
    if (b) b.click()
  })
})()
