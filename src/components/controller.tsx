import type { VNode } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import { cleanCssClasses } from './styling.ts'
import { SvgIcon } from './svg.tsx'

interface ControllerProps {
  className?: string
}

function triggerAction(ev?: Event): void {
  ev?.preventDefault()

  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: (ev?.currentTarget as Element)?.getAttribute('data-freya-key') ?? '' })
  )
}

export function Controller({ className }: ControllerProps): VNode {
  const hasDocument = typeof document !== 'undefined' // This is needed on the server
  const [isFullScreen, setIsFullScreen] = useState(Boolean(hasDocument && document.fullscreenElement))

  const updateFullScreen = useCallback(() => {
    setIsFullScreen(Boolean(document?.fullscreenElement))
  }, [setIsFullScreen])

  useEffect(() => {
    window.addEventListener('freya:fullScreen:toggled', updateFullScreen, false)

    return () => {
      window.removeEventListener('freya:fullScreen:toggled', updateFullScreen, false)
    }
  }, [updateFullScreen])

  return (
    <nav className={cleanCssClasses('freya@controller', className)}>
      <a href="#" className={cleanCssClasses('action')} data-freya-key="ArrowLeft" onClick={triggerAction}>
        <SvgIcon name="arrow-left" className={cleanCssClasses('freya@svg-icon', 'icon')} />
      </a>
      <a href="#" className={cleanCssClasses('action')} data-freya-key="ArrowRight" onClick={triggerAction}>
        <SvgIcon name="arrow-right" className={cleanCssClasses('freya@svg-icon', 'icon')} />
      </a>
      <a href="#" className={cleanCssClasses('action')} data-freya-key="f" onClick={triggerAction}>
        <SvgIcon name={isFullScreen ? 'minimize' : 'maximize'} className={cleanCssClasses('freya@svg-icon', 'icon')} />
      </a>
      <a href="#" className={cleanCssClasses('action')} data-freya-key="g" onClick={triggerAction}>
        <SvgIcon name="navigator" className={cleanCssClasses('freya@svg-icon', 'icon')} />
      </a>
      <a href="#" className={cleanCssClasses('action')} data-freya-key="p" onClick={triggerAction}>
        <SvgIcon name="play" className={cleanCssClasses('freya@svg-icon', 'icon')} />
      </a>
      <a href="#" className={cleanCssClasses('action')} data-freya-key="c" onClick={triggerAction}>
        <SvgIcon name="close" className={cleanCssClasses('freya@svg-icon', 'icon')} />
      </a>
    </nav>
  )
}
