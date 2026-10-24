import { useContext } from 'react'

import { ConfigContext } from '@/contexts/ConfigContext.tsx'

import { choiceValue, optionValue, sliderValue } from './textSlots.ts'

/** A widget's show/hide option from the desktop app (defaults to shown) */
export function useOption(group: string, key: string): boolean {
  const { options } = useContext(ConfigContext)
  return optionValue(options, group, key)
}

export function useSlider(group: string, key: string): number {
  const { options } = useContext(ConfigContext)
  return sliderValue(options, group, key)
}

export function useChoice(group: string, key: string): string {
  const { options } = useContext(ConfigContext)
  return choiceValue(options, group, key)
}
