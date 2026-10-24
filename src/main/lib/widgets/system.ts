import si from 'systeminformation'

import { publish, TopicProvider } from '../topics.js'
import { log, LogLevel } from '../utils.js'

export interface SystemData {
  cpu: { load: number; temperature: number | null; history: number[] }
  memory: { used: number; total: number; percent: number }
  gpu: {
    name: string
    load: number | null
    temperature: number | null
    memoryPercent: number | null
  } | null
  network: { down: number; up: number }
}

const FAST_MS = 2000
const SLOW_MS = 6000
const HISTORY = 40

let latest: SystemData | null = null
let fastTimer: NodeJS.Timeout | null = null
let slowTimer: NodeJS.Timeout | null = null
const history: number[] = []
let gpu: SystemData['gpu'] = null
let cpuTemp: number | null = null
let gpuFailed = false

async function slowUpdate() {
  try {
    const temp = await si.cpuTemperature()
    cpuTemp = typeof temp.main === 'number' && temp.main > 0 ? Math.round(temp.main) : null
  } catch {
    cpuTemp = null
  }

  if (gpuFailed) return
  try {
    const graphics = await si.graphics()
    // prefer a controller that reports utilization (usually the dGPU)
    const c =
      graphics.controllers.find(c => typeof c.utilizationGpu === 'number') ??
      graphics.controllers[0]
    if (!c) {
      gpu = null
      return
    }
    gpu = {
      name: (c.model || c.name || 'GPU').replace(/^NVIDIA\s+|GeForce\s+/gi, ''),
      load: typeof c.utilizationGpu === 'number' ? Math.round(c.utilizationGpu) : null,
      temperature:
        typeof c.temperatureGpu === 'number' ? Math.round(c.temperatureGpu) : null,
      memoryPercent:
        typeof c.memoryUsed === 'number' && c.memoryTotal
          ? Math.round((c.memoryUsed / c.memoryTotal) * 100)
          : null
    }
  } catch (err) {
    gpuFailed = true
    gpu = null
    log(`GPU stats unavailable: ${err}`, 'System', LogLevel.DEBUG)
  }
}

async function fastUpdate() {
  try {
    const [load, mem, net] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats().catch(() => [])
    ])

    const cpuLoad = Math.round(load.currentLoad)
    history.push(cpuLoad)
    if (history.length > HISTORY) history.shift()

    const down = net.reduce((s, n) => s + Math.max(0, n.rx_sec ?? 0), 0)
    const up = net.reduce((s, n) => s + Math.max(0, n.tx_sec ?? 0), 0)

    latest = {
      cpu: { load: cpuLoad, temperature: cpuTemp, history: [...history] },
      memory: {
        used: mem.active,
        total: mem.total,
        percent: Math.round((mem.active / mem.total) * 100)
      },
      gpu,
      network: { down: Math.round(down), up: Math.round(up) }
    }
    publish('system', latest)
  } catch (err) {
    log(`Failed to read system stats: ${err}`, 'System', LogLevel.WARN)
  }
}

export const systemProvider: TopicProvider = {
  topic: 'system',
  async start() {
    await slowUpdate()
    fastUpdate()
    fastTimer = setInterval(fastUpdate, FAST_MS)
    slowTimer = setInterval(slowUpdate, SLOW_MS)
  },
  stop() {
    if (fastTimer) clearInterval(fastTimer)
    if (slowTimer) clearInterval(slowTimer)
    fastTimer = null
    slowTimer = null
  },
  latest: () => latest
}
