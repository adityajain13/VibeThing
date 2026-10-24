import axios from 'axios'

export async function getSocketPassword() {
  const res = await axios.get('./ws-password')
  return res.data.replace('\n', '')
}

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
