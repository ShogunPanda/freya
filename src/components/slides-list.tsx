import { type BuildContext } from 'dante'
import { useContext } from 'react'
import { CSSClassesResolverContext } from './classes-resolver.js'
import { SvgCloseIcon } from './svg.js'

interface SlidesListProps {
  context: BuildContext
  count: number
}

export function SlidesList({ count }: SlidesListProps): JSX.Element {
  const resolveClasses = useContext(CSSClassesResolverContext)

  const slides: number[] = []
  for (let i = 0; i < count; i++) {
    slides.push(i)
  }

  return (
    <section data-freya-id="list:container" className={resolveClasses('freya@slides js@hidden')}>
      <div className={resolveClasses('freya@slides__overlay')} />

      <div data-freya-id="list:scrollview" className={resolveClasses('freya@slides__contents')}>
        <a data-freya-id="list:close" href="#" className={resolveClasses('freya@slides__close')}>
          <SvgCloseIcon className={resolveClasses('freya@slides__close__image')} />
        </a>

        <nav data-freya-id="list" className={resolveClasses('freya@slides__list')}>
          {slides.map(index => {
            return (
              <div
                key={`slides-list:${index}`}
                data-freya-id="list:slide-wrapper"
                data-freya-index={index + 1}
                className={resolveClasses('freya@slides__wrapper')}
              >
                <div
                  data-freya-id="list:slide-placeholder"
                  className={resolveClasses('js@slide js@slides__wrapper--active')}
                />
                <span className={resolveClasses('freya@slides__wrapper__number')}>{index + 1}</span>
              </div>
            )
          })}
        </nav>
      </div>
    </section>
  )
}
