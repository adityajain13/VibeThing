import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { useTopic } from '@/contexts/TopicsContext.tsx'
import { describeWeather } from '@/lib/weatherCodes.ts'

import { TopicError, WeatherData } from '@/types/Widgets.js'

import styles from './Weather.module.css'

function hourLabel(iso: string) {
  const h = parseInt(iso.slice(11, 13), 10)
  return `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`
}

const Weather: React.FC = () => {
  const data = useTopic<WeatherData | TopicError>('weather')

  if (!data || 'error' in data) {
    return (
      <BaseWidget className={styles.weather}>
        <div className={styles.empty}>
          <span className="material-icons">wb_cloudy</span>
          <p>{data && 'error' in data ? data.error : 'Loading weather…'}</p>
        </div>
      </BaseWidget>
    )
  }

  const now = describeWeather(data.current.code, data.current.isDay)

  return (
    <BaseWidget className={styles.weather}>
      <div className={styles.now}>
        <span className={`material-icons ${styles.icon}`}>{now.icon}</span>
        <div className={styles.temp}>
          <p className={`${styles.degrees} tnum`}>{data.current.temperature}°</p>
          <p className={styles.label}>{now.label}</p>
        </div>
        <div className={styles.side}>
          <p className={styles.place}>{data.location.split(',')[0]}</p>
          <p className="tnum">
            {data.today.max}° / {data.today.min}°
          </p>
          <p className="tnum">
            {data.today.precipitationChance > 0
              ? `${data.today.precipitationChance}% rain`
              : `Feels ${data.current.feelsLike}°`}
          </p>
        </div>
      </div>
      <div className={styles.hours}>
        {data.hourly.map(h => (
          <div key={h.time} className={styles.hour}>
            <p className={styles.hourTime}>{hourLabel(h.time)}</p>
            <span className="material-icons">{describeWeather(h.code, h.isDay).icon}</span>
            <p className="tnum">{h.temperature}°</p>
          </div>
        ))}
      </div>
    </BaseWidget>
  )
}

export default Weather
