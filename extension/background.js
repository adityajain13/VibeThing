// Keeps a connection to the VibeThing app on this PC and relays YouTube's like state.
const VIBETHING = 'ws://127.0.0.1:47321'

/** tabId -> { data, lastPlayed } */
const tabs = new Map()
let ws = null

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return
  try {
    ws = new WebSocket(VIBETHING)
  } catch {
    ws = null
    return
  }
  ws.onopen = () => report()
  ws.onmessage = e => {
    let msg
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    if (msg.type !== 'like') return
    const id = activeTab()
    if (id !== null) chrome.tabs.sendMessage(id, { type: 'like', liked: !!msg.data.liked }).catch(() => {})
  }
  ws.onclose = () => (ws = null)
  ws.onerror = () => {}
}

/** The tab that's playing, or the one that played most recently */
function activeTab() {
  let best = null
  for (const [id, t] of tabs) {
    if (
      !best ||
      (t.data.playing && !best.t.data.playing) ||
      (t.data.playing === best.t.data.playing && t.lastPlayed > best.t.lastPlayed)
    )
      best = { id, t }
  }
  return best ? best.id : null
}

function report() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  const id = activeTab()
  ws.send(JSON.stringify({ type: 'media', data: id === null ? null : tabs.get(id).data }))
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'media' || !sender.tab) return
  const id = sender.tab.id
  if (!msg.data) tabs.delete(id)
  else {
    const prev = tabs.get(id)
    tabs.set(id, {
      data: msg.data,
      lastPlayed: msg.data.playing ? Date.now() : prev ? prev.lastPlayed : 0
    })
  }
  connect()
  report()
})

chrome.tabs.onRemoved.addListener(id => {
  if (tabs.delete(id)) report()
})

// retry now and then in case VibeThing was started after the browser
chrome.alarms.create('reconnect', { periodInMinutes: 0.5 })
chrome.alarms.onAlarm.addListener(() => connect())
connect()
