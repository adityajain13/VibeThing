// WMO weather interpretation codes, as used by Open-Meteo
export function describeWeather(code: number, isDay = true): { label: string; icon: string } {
  if (code === 0) return { label: isDay ? 'Clear' : 'Clear night', icon: isDay ? 'wb_sunny' : 'nights_stay' }
  if (code === 1) return { label: 'Mostly clear', icon: isDay ? 'wb_sunny' : 'nights_stay' }
  if (code === 2) return { label: 'Partly cloudy', icon: isDay ? 'wb_cloudy' : 'nights_stay' }
  if (code === 3) return { label: 'Overcast', icon: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'blur_on' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'grain' }
  if (code >= 61 && code <= 67) return { label: code >= 65 ? 'Heavy rain' : 'Rain', icon: 'water_drop' }
  if (code >= 71 && code <= 77) return { label: code >= 75 ? 'Heavy snow' : 'Snow', icon: 'ac_unit' }
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'water_drop' }
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'ac_unit' }
  if (code >= 95) return { label: 'Thunderstorm', icon: 'flash_on' }
  return { label: 'Unknown', icon: 'cloud' }
}
