import { type BuildContext } from 'dante'
import { SvgCloseIcon } from './svg.js'

interface PresenterProps {
  context: BuildContext
}

export function Presenter({ context }: PresenterProps): JSX.Element {
  return (
    <div data-freya-id="presenter:container" className={context.extensions.expandClasses('freya@presenter js@hidden')}>
      <div className={context.extensions.expandClasses('freya@presenter__overlay')} />

      <div className={context.extensions.expandClasses('freya@presenter__contents')}>
        <section data-freya-id="presenter" className={context.extensions.expandClasses('freya@presenter__layout')}>
          <div className={context.extensions.expandClasses('freya@presenter__header')}>
            <div className={context.extensions.expandClasses('freya@presenter__header__controls')}>
              <span
                data-freya-id="presenter:progress"
                className={context.extensions.expandClasses('freya@presenter__header__text')}
              >
                00/00
              </span>
              <a
                data-freya-id="presenter:reset"
                href="#"
                className={context.extensions.expandClasses(
                  'freya@presenter__header__action freya@presenter__timer__button'
                )}
              >
                &#x1F504;
              </a>
              <a
                data-freya-id="presenter:toggle"
                href="#"
                className={context.extensions.expandClasses(
                  'freya@presenter__header__action freya@presenter__timer__button'
                )}
              >
                &#x23EF;&#xFE0F;
              </a>
              <span
                data-freya-id="presenter:time"
                className={context.extensions.expandClasses(
                  'freya@presenter__header__text freya@presenter__timer__time'
                )}
              >
                00:00
              </span>
            </div>

            <a
              data-freya-id="presenter:close"
              href="#"
              className={context.extensions.expandClasses('freya@presenter__close')}
            >
              <SvgCloseIcon className={context.extensions.expandClasses('freya@presenter__close__image')} />
            </a>
          </div>

          <div
            data-freya-id="presenter:current"
            className={context.extensions.expandClasses('freya@presenter__slide--current')}
          />
          <div
            data-freya-id="presenter:next"
            className={context.extensions.expandClasses('freya@presenter__slide--preview freya@presenter__slide--next')}
          />

          <div data-freya-id="presenter:notes" className={context.extensions.expandClasses('freya@presenter__notes')}>
            Presenter notes
          </div>
        </section>
      </div>
    </div>
  )
}
