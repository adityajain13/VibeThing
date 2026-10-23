import { useContext } from 'react'
import type { KeyboardEvent } from 'react'

import { UIContext } from '@/contexts/UIContext.tsx'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'
import LyricsView from '@/components/LyricsView/LyricsView.tsx'

const Lyrics: React.FC = () => {
  const { setFullscreen } = useContext(UIContext)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') setFullscreen('lyrics')
  }

  return (
    <BaseWidget onKeyDown={onKeyDown} onDoubleClick={() => setFullscreen('lyrics')}>
      <LyricsView size="small" />
    </BaseWidget>
  )
}

export default Lyrics
