import { SvgCloseIcon } from './svg.js'

interface SlidesListProps {
  count: number
}

export function SlidesList({ count }: SlidesListProps): JSX.Element {
  const slides: number[] = []
  for (let i = 0; i < count; i++) {
    slides.push(i)
  }

  return (
    <section data-freya-id="list:container" className="freya__slides hidden">
      <div className="freya__slides__overlay" />

      <div className="freya__slides__contents">
        <a data-freya-id="list:close" href="#" className="freya__slides__close">
          <SvgCloseIcon />
        </a>

        <nav data-freya-id="list" className="freya__slides__list">
          {slides.map(index => {
            return (
              <div
                key={`slides-list:${index}`}
                data-freya-id="list:slide-wrapper"
                data-freya-index={index + 1}
                className="freya__slides__wrapper"
              >
                <span className="freya__slides__wrapper__number">{index + 1}</span>
              </div>
            )
          })}
        </nav>
      </div>
    </section>
  )
}
