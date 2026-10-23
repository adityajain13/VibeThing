import { useOption } from '@/lib/useOption.ts'
import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { useTopic } from '@/contexts/TopicsContext.tsx'

import { SystemData } from '@/types/Widgets.js'

import styles from './System.module.css'

function rate(bytesPerSec: number) {
  const bits = bytesPerSec * 8
  if (bits >= 1e9) return `${(bits / 1e9).toFixed(1)} Gb/s`
  if (bits >= 1e6) return `${(bits / 1e6).toFixed(1)} Mb/s`
  if (bits >= 1e3) return `${Math.round(bits / 1e3)} kb/s`
  return `${Math.round(bits)} b/s`
}

function gb(bytes: number) {
  return (bytes / 1024 ** 3).toFixed(1)
}

const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  const n = 40
  const pts = values.slice(-n)
  if (pts.length < 2) return <svg className={styles.spark} />
  const w = 200
  const h = 50
  const step = w / (n - 1)
  const offset = (n - pts.length) * step
  const line = pts.map((v, i) => `${offset + i * step},${h - (v / 100) * h}`).join(' ')
  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={`${offset},${h} ${line} ${w},${h}`} className={styles.area} />
      <polyline points={line} className={styles.line} />
    </svg>
  )
}

const Meter: React.FC<{ label: string; value: number | null; detail?: string }> = ({
  label,
  value,
  detail
}) => (
  <div className={styles.meter}>
    <div className={styles.meterHead}>
      <span className={styles.meterLabel}>{label}</span>
      <span className={`${styles.meterValue} tnum`}>
        {detail ?? (value === null ? '–' : `${value}%`)}
      </span>
    </div>
    <div className={styles.bar}>
      <div className={styles.fill} style={{ width: `${value ?? 0}%` }} />
    </div>
  </div>
)

const System: React.FC = () => {
  const data = useTopic<SystemData>('system')
  const showGraph = useOption('system', 'showGraph')
  const showGpu = useOption('system', 'showGpu')
  const showNetwork = useOption('system', 'showNetwork')

  if (!data) {
    return (
      <BaseWidget className={styles.system}>
        <p className={styles.loading}>Reading your PC…</p>
      </BaseWidget>
    )
  }

  return (
    <BaseWidget className={styles.system}>
      <div className={styles.cpu}>
        <div>
          <p className={styles.cpuLabel}>CPU</p>
          <p className={`${styles.cpuValue} tnum`}>
            {data.cpu.load}
            <span>%</span>
          </p>
          {data.cpu.temperature !== null && (
            <p className={`${styles.sub} tnum`}>{data.cpu.temperature}°C</p>
          )}
        </div>
        {showGraph && <Sparkline values={data.cpu.history} />}
      </div>
      <Meter
        label="Memory"
        value={data.memory.percent}
        detail={`${gb(data.memory.used)} / ${gb(data.memory.total)} GB`}
      />
      {showGpu && data.gpu && (
        <Meter
          label={data.gpu.name}
          value={data.gpu.load}
          detail={
            data.gpu.load === null
              ? undefined
              : `${data.gpu.load}%${data.gpu.temperature !== null ? `  ${data.gpu.temperature}°C` : ''}`
          }
        />
      )}
      {showNetwork && (
        <div className={`${styles.net} tnum`}>
          <span>
            <span className="material-icons">south</span>
            {rate(data.network.down)}
          </span>
          <span>
            <span className="material-icons">north</span>
            {rate(data.network.up)}
          </span>
        </div>
      )}
    </BaseWidget>
  )
}

export default System
