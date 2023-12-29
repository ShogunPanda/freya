import { type BuildContext } from 'dante'
import { useContext } from 'react'
import { CSSClassesResolverContext } from './classes-resolver.js'
import { SvgCloseIcon } from './svg.js'

interface PresenterProps {
  context: BuildContext
}

export function Presenter(_props: PresenterProps): JSX.Element {
  const resolveClasses = useContext(CSSClassesResolverContext)

  return (
    <div data-freya-id="presenter:container" className={resolveClasses('freya@presenter js@hidden')}>
      <div className={resolveClasses('freya@presenter__overlay')} />

      <div className={resolveClasses('freya@presenter__contents')}>
        <section data-freya-id="presenter" className={resolveClasses('freya@presenter__layout')}>
          <div className={resolveClasses('freya@presenter__header')}>
            <div className={resolveClasses('freya@presenter__header__controls')}>
              <span data-freya-id="presenter:progress" className={resolveClasses('freya@presenter__header__text')}>
                00/00
              </span>
              <a
                data-freya-id="presenter:reset"
                href="#"
                className={resolveClasses('freya@presenter__header__action freya@presenter__timer__button')}
              >
                &#x1F504;
              </a>
              <a
                data-freya-id="presenter:toggle"
                href="#"
                className={resolveClasses('freya@presenter__header__action freya@presenter__timer__button')}
              >
                &#x23EF;&#xFE0F;
              </a>
              <span
                data-freya-id="presenter:time"
                className={resolveClasses('freya@presenter__header__text freya@presenter__timer__time')}
              >
                00:00
              </span>
            </div>

            <a data-freya-id="presenter:close" href="#" className={resolveClasses('freya@presenter__close')}>
              <SvgCloseIcon className={resolveClasses('freya@presenter__close__image')} />
            </a>
          </div>

          <div data-freya-id="presenter:current" className={resolveClasses('freya@presenter__slide--current')} />
          <div
            data-freya-id="presenter:next"
            className={resolveClasses('freya@presenter__slide--preview freya@presenter__slide--next')}
          />

          <div data-freya-id="presenter:notes" className={resolveClasses('freya@presenter__notes')}>
            Presenter notes
          </div>
        </section>
      </div>
    </div>
  )
}
