import { useContext } from 'react'

import { ConfigContext } from '@/contexts/ConfigContext.tsx'

import { optionValue } from './textSlots.ts'

/** A widget's show/hide option from the desktop app (defaults to shown) */
export function useOption(group: string, key: string): boolean {
  const { options } = useContext(ConfigContext)
  return optionValue(options, group, key)
}
