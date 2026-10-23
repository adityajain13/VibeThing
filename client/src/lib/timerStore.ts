/**
 * Timer / stopwatch state lives outside React so it keeps running while the
 * widget is unmounted (the CarThing only mounts neighbouring screens).
 */

export type TimerMode = 'timer' | 'stopwatch'

export interface TimerState {
  mode: TimerMode
  /** timer: the length it was set to */
  setMs: number
  /** timer: when it will finish, if running */
  endsAt: number | null
  /** timer: what was left when paused */
  remainingMs: number
  /** timer: finished and not yet dismissed */
  done: boolean
  /** stopwatch: when the current run started, if running */
  swStartedAt: number | null
  /** stopwatch: time from earlier runs */
  swAccumMs: number
}

const listeners = new Set<() => void>()
const doneListeners = new Set<() => void>()
let state: TimerState = {
  mode: 'timer',
  setMs: 5 * 60 * 1000,
  endsAt: null,
  remainingMs: 5 * 60 * 1000,
  done: false,
  swStartedAt: null,
  swAccumMs: 0
}
let watch: ReturnType<typeof setInterval> | null = null

function set(patch: Partial<TimerState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
  ensureWatch()
}

function ensureWatch() {
  const needed = state.endsAt !== null
  if (needed && !watch) {
    watch = setInterval(() => {
      if (state.endsAt !== null && Date.now() >= state.endsAt) {
        set({ endsAt: null, remainingMs: 0, done: true })
        doneListeners.forEach(l => l())
      }
    }, 250)
  } else if (!needed && watch) {
    clearInterval(watch)
    watch = null
  }
}

export const timer = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  onDone(l: () => void) {
    doneListeners.add(l)
    return () => {
      doneListeners.delete(l)
    }
  },
  setMode: (mode: TimerMode) => set({ mode }),
  /** timer remaining / stopwatch elapsed, right now */
  value(): number {
    if (state.mode === 'timer') return state.endsAt !== null ? Math.max(0, state.endsAt - Date.now()) : state.remainingMs
    return state.swAccumMs + (state.swStartedAt !== null ? Date.now() - state.swStartedAt : 0)
  },
  running(): boolean {
    return state.mode === 'timer' ? state.endsAt !== null : state.swStartedAt !== null
  },
  toggle() {
    if (state.mode === 'timer') {
      if (state.done) return set({ done: false, remainingMs: state.setMs })
      if (state.endsAt !== null) set({ endsAt: null, remainingMs: Math.max(0, state.endsAt - Date.now()) })
      else if (state.remainingMs > 0) set({ endsAt: Date.now() + state.remainingMs })
    } else if (state.swStartedAt !== null) {
      set({ swAccumMs: state.swAccumMs + Date.now() - state.swStartedAt, swStartedAt: null })
    } else {
      set({ swStartedAt: Date.now() })
    }
  },
  reset() {
    if (state.mode === 'timer') set({ endsAt: null, remainingMs: state.setMs, done: false })
    else set({ swStartedAt: null, swAccumMs: 0 })
  },
  /** dial / presets while the timer is stopped */
  adjust(deltaMs: number) {
    if (state.mode !== 'timer' || state.endsAt !== null) return
    const next = Math.max(15 * 1000, Math.min(12 * 60 * 60 * 1000, (state.done ? state.setMs : state.remainingMs) + deltaMs))
    set({ setMs: next, remainingMs: next, done: false })
  },
  setLength(ms: number) {
    if (state.mode !== 'timer') return
    set({ setMs: ms, remainingMs: ms, endsAt: null, done: false })
  },
  dismiss: () => set({ done: false, remainingMs: state.setMs })
}

export function formatDuration(ms: number, tenths = false) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  const base = `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
  return tenths ? `${base}.${Math.floor((ms % 1000) / 100)}` : base
}
