import WebSocket from 'ws'

import { log, LogLevel } from './utils.js'

import { AuthenticatedWebSocket } from '../types/WebSocketServer.js'

/**
 * A topic is a stream of widget data (weather, system stats, mixer...).
 * Providers only run while at least one connected client is subscribed,
 * so e.g. system stats are not polled while that screen is not visible.
 */
export interface TopicProvider {
  topic: string
  start(): void | Promise<void>
  stop(): void | Promise<void>
  /** Last known value, sent immediately to new subscribers */
  latest(): unknown
}

const providers = new Map<string, TopicProvider>()
const running = new Set<string>()
const clients = new Set<AuthenticatedWebSocket>()

export function registerProvider(provider: TopicProvider) {
  providers.set(provider.topic, provider)
}

function send(ws: AuthenticatedWebSocket, type: string, data: unknown) {
  if (!ws.authenticated || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type, data }))
}

/** Push a value to every client subscribed to the topic */
export function publish(topic: string, data: unknown) {
  for (const ws of clients) {
    if (ws.subscriptions?.has(topic)) send(ws, topic, data)
  }
}

async function reconcile() {
  const wanted = new Set<string>()
  for (const ws of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue
    ws.subscriptions?.forEach(t => wanted.add(t))
  }

  for (const topic of wanted) {
    if (running.has(topic)) continue
    const provider = providers.get(topic)
    if (!provider) continue
    running.add(topic)
    log(`Starting provider ${topic}`, 'Topics', LogLevel.DEBUG)
    try {
      await provider.start()
    } catch (err) {
      log(`Provider ${topic} failed to start: ${err}`, 'Topics')
    }
  }

  for (const topic of [...running]) {
    if (wanted.has(topic)) continue
    running.delete(topic)
    log(`Stopping provider ${topic}`, 'Topics', LogLevel.DEBUG)
    try {
      await providers.get(topic)?.stop()
    } catch (err) {
      log(`Provider ${topic} failed to stop: ${err}`, 'Topics')
    }
  }
}

export async function setSubscriptions(
  ws: AuthenticatedWebSocket,
  topics: string[]
) {
  const next = new Set(topics.filter(t => providers.has(t)))
  const previous = ws.subscriptions ?? new Set<string>()
  ws.subscriptions = next

  if (!clients.has(ws)) {
    clients.add(ws)
    ws.once('close', () => {
      clients.delete(ws)
      reconcile()
    })
  }

  await reconcile()

  // Send cached values for newly added topics right away
  for (const topic of next) {
    if (previous.has(topic)) continue
    const latest = providers.get(topic)?.latest()
    if (latest !== undefined && latest !== null) send(ws, topic, latest)
  }
}

/** Restart a running provider, e.g. after its settings changed */
export async function restartProvider(topic: string) {
  const provider = providers.get(topic)
  if (!provider || !running.has(topic)) return
  await provider.stop()
  await provider.start()
}

export async function stopAllProviders() {
  for (const topic of running) await providers.get(topic)?.stop()
  running.clear()
  clients.clear()
}
