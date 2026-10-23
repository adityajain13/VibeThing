import { createRoot } from 'react-dom/client'

import { AppBlurContextProvider } from '@/contexts/AppBlurContext.tsx'
import { ConfigContextProvider } from '@/contexts/ConfigContext.tsx'
import { MediaContextProvider } from '@/contexts/MediaContext.tsx'
import { SleepContextProvider } from '@/contexts/SleepContext.tsx'
import { SocketContextProvider } from '@/contexts/SocketContext.tsx'
import { TopicsContextProvider } from '@/contexts/TopicsContext.tsx'
import { UIContextProvider } from '@/contexts/UIContext.tsx'

import App from '@/App.tsx'

import './index.css'
import '@fontsource-variable/manrope'
import '@fontsource-variable/open-sans'
import '@fontsource/material-icons'

const root = createRoot(document.getElementById('root')!)

root.render(
  <SocketContextProvider>
    <ConfigContextProvider>
      <TopicsContextProvider>
        <UIContextProvider>
          <AppBlurContextProvider>
            <SleepContextProvider>
              <MediaContextProvider>
                <App />
              </MediaContextProvider>
            </SleepContextProvider>
          </AppBlurContextProvider>
        </UIContextProvider>
      </TopicsContextProvider>
    </ConfigContextProvider>
  </SocketContextProvider>
)
