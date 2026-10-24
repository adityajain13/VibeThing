import { playbackManager } from '../playback/playback.js'
import { getLyrics } from '../lyrics.js'

import { HandlerFunction } from '../../types/WebSocketHandler.js'

export const name = 'lyrics'

export const hasActions = false

export const handle: HandlerFunction = async ws => {
  const playback = await playbackManager.getPlayback().catch(() => null)
  if (!playback) {
    ws.send(JSON.stringify({ type: 'lyrics', data: null }))
    return
  }

  const { name, artists, album, duration } = playback.track
  const lyrics = await getLyrics({
    name,
    artists,
    album,
    durationMs: duration.total
  })

  ws.send(JSON.stringify({ type: 'lyrics', data: lyrics }))
}
