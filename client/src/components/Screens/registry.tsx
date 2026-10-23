import Player from '@/components/Widgets/widgets/Player/Player.tsx'
import Apps from '@/components/Widgets/widgets/Apps/Apps.tsx'
import Controls from '@/components/Widgets/widgets/Controls/Controls.tsx'
import Lyrics from '@/components/Widgets/widgets/Lyrics/Lyrics.tsx'
import Clock from '@/components/Widgets/widgets/Clock/Clock.tsx'
import Weather from '@/components/Widgets/widgets/Weather/Weather.tsx'
import System from '@/components/Widgets/widgets/System/System.tsx'
import Calendar from '@/components/Widgets/widgets/Calendar/Calendar.tsx'
import Mixer from '@/components/Widgets/widgets/Mixer/Mixer.tsx'
import Macros from '@/components/Widgets/widgets/Macros/Macros.tsx'

import { Topic } from '@/contexts/TopicsContext.tsx'
import { WidgetId } from '@/types/Config.js'

export const widgets: Record<WidgetId, { component: React.FC; topic?: Topic; weight?: number }> = {
  player: { component: Player, weight: 1.15 },
  apps: { component: Apps },
  controls: { component: Controls },
  lyrics: { component: Lyrics },
  clock: { component: Clock },
  weather: { component: Weather, topic: 'weather' },
  system: { component: System, topic: 'system' },
  calendar: { component: Calendar, topic: 'calendar' },
  mixer: { component: Mixer, topic: 'mixer' },
  macros: { component: Macros }
}
