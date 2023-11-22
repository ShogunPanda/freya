import { type BuildContext } from 'dante'
import { SvgCloseIcon } from './svg.js'

interface SlidesListProps {
  context: BuildContext
  count: number
}

export function SlidesList({ context, count }: SlidesListProps): JSX.Element {
  const slides: number[] = []
  for (let i = 0; i < count; i++) {
    slides.push(i)
  }

  return (
    <section data-freya-id="list:container" className={context.extensions.expandClasses('freya@slides js@hidden')}>
      <div className={context.extensions.expandClasses('freya@slides__overlay')} />

      <div data-freya-id="list:scrollview" className={context.extensions.expandClasses('freya@slides__contents')}>
        <a data-freya-id="list:close" href="#" className={context.extensions.expandClasses('freya@slides__close')}>
          <SvgCloseIcon className={context.extensions.expandClasses('freya@slides__close__image')} />
        </a>

        <nav data-freya-id="list" className={context.extensions.expandClasses('freya@slides__list')}>
          {slides.map(index => {
            return (
              <div
                key={`slides-list:${index}`}
                data-freya-id="list:slide-wrapper"
                data-freya-index={index + 1}
                className={context.extensions.expandClasses('freya@slides__wrapper')}
              >
                <div
                  data-freya-id="list:slide-placeholder"
                  className={context.extensions.expandClasses('js@slide js@slides__wrapper--active')}
                />
                <span className={context.extensions.expandClasses('freya@slides__wrapper__number')}>{index + 1}</span>
              </div>
            )
          })}
        </nav>
      </div>
    </section>
  )
}
