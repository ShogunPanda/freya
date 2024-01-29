import { type VNode } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import { useClient, type CSSClassToken } from './contexts.js'
import { SvgIcon } from './svg.js'

interface ControllerProps {
  className?: string
}

export const controllerCssClasses: CSSClassToken[] = [
  'freya@controller',
  'freya@controller__action',
  'freya@svg-icon',
  'freya@controller__action__icon'
]

function triggerAction(ev?: Event): void {
  ev?.preventDefault()

  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: (ev?.currentTarget as Element)?.getAttribute('data-freya-key') ?? '' })
  )
}

export function Controller({ className }: ControllerProps): VNode {
  const { resolveClasses } = useClient()
  const [isFullScreen, setIsFullScreen] = useState(Boolean(document.fullscreenElement))

  const updateFullScreen = useCallback(() => {
    setIsFullScreen(Boolean(document.fullscreenElement))
  }, [setIsFullScreen])
  useEffect(() => {
    window.addEventListener('freya:fullScreen:toggled', updateFullScreen, false)

    return () => {
      window.removeEventListener('freya:fullScreen:toggled', updateFullScreen, false)
    }
  }, [])

  return (
    <nav className={resolveClasses('freya@controller', className)}>
      <a
        href="#"
        className={resolveClasses('freya@controller__action')}
        data-freya-key="ArrowLeft"
        onClick={triggerAction}
      >
        <SvgIcon name="arrow-left" className={resolveClasses('freya@svg-icon', 'freya@controller__action__icon')} />
      </a>
      <a
        href="#"
        className={resolveClasses('freya@controller__action')}
        data-freya-key="ArrowRight"
        onClick={triggerAction}
      >
        <SvgIcon name="arrow-right" className={resolveClasses('freya@svg-icon', 'freya@controller__action__icon')} />
      </a>
      <a href="#" className={resolveClasses('freya@controller__action')} data-freya-key="f" onClick={triggerAction}>
        <SvgIcon
          name={isFullScreen ? 'minimize' : 'maximize'}
          className={resolveClasses('freya@svg-icon', 'freya@controller__action__icon')}
        />
      </a>
      <a href="#" className={resolveClasses('freya@controller__action')} data-freya-key="g" onClick={triggerAction}>
        <SvgIcon name="navigator" className={resolveClasses('freya@svg-icon', 'freya@controller__action__icon')} />
      </a>
      <a href="#" className={resolveClasses('freya@controller__action')} data-freya-key="p" onClick={triggerAction}>
        <SvgIcon name="play" className={resolveClasses('freya@svg-icon', 'freya@controller__action__icon')} />
      </a>
      <a href="#" className={resolveClasses('freya@controller__action')} data-freya-key="c" onClick={triggerAction}>
        <SvgIcon name="close" className={resolveClasses('freya@svg-icon', 'freya@controller__action__icon')} />
      </a>
    </nav>
  )
}
