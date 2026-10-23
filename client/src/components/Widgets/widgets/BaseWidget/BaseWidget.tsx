import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'

import styles from './BaseWidget.module.css'

interface BaseWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Draw the widget without a panel background (e.g. the clock) */
  bare?: boolean
}

/**
 * Panel every widget lives in. It's focusable so the knob/buttons can
 * select it, and exposes its size as data attributes so widgets can switch
 * layouts with plain attribute selectors (the CarThing runs Chrome 69, so
 * no container queries).
 */
const BaseWidget = React.forwardRef<HTMLDivElement, BaseWidgetProps>(
  ({ children, bare, className, ...props }, ref) => {
    const outerRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLDivElement>(null)
    useImperativeHandle(ref, () => innerRef.current as HTMLDivElement)

    const [size, setSize] = useState({ h: 'tall', w: 'wide' })

    useEffect(() => {
      const el = outerRef.current
      if (!el) return
      const measure = () => {
        const { width, height } = el.getBoundingClientRect()
        const h = height < 170 ? 'short' : height < 300 ? 'mid' : 'tall'
        const w = width < 300 ? 'narrow' : 'wide'
        setSize(s => (s.h === h && s.w === w ? s : { h, w }))
      }
      measure()
      const RO = (window as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
      if (!RO) {
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }
      const ro = new RO(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    return (
      <div
        className={styles.widget}
        ref={outerRef}
        data-bare={bare === true}
        data-h={size.h}
        data-w={size.w}
      >
        <div
          id="widget"
          data-widget
          {...props}
          className={`${styles.inner} ${className ?? ''}`}
          ref={innerRef}
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    )
  }
)

export default BaseWidget
