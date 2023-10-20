import { SvgCloseIcon } from './svg.js'

export function Presenter(): JSX.Element {
  return (
    <div data-freya-id="presenter:container" className="freya__presenter hidden">
      <div className="freya__presenter__overlay" />

      <div className="freya__presenter__contents">
        <section data-freya-id="presenter" className="freya__presenter__layout">
          <div className="freya__presenter__header">
            <div className="freya__presenter__header__controls">
              <span data-freya-id="presenter:progress">00/00</span>
              <a data-freya-id="presenter:reset" href="#" className="freya__presenter__timer__button">
                &#x1F504;
              </a>
              <a data-freya-id="presenter:toggle" href="#" className="freya__presenter__timer__button">
                &#x23EF;&#xFE0F;
              </a>
              <span data-freya-id="presenter:time" className="freya__presenter__timer__time">
                00:00
              </span>
            </div>

            <a data-freya-id="presenter:close" href="#" className="freya__presenter__close">
              <SvgCloseIcon />
            </a>
          </div>

          <div data-freya-id="presenter:current" className="freya__presenter__slide--current" />
          <div
            data-freya-id="presenter:next"
            className="freya__presenter__slide--preview freya__presenter__slide--next"
          />

          <div data-freya-id="presenter:notes" className="freya__presenter__notes">
            Presenter notes
          </div>
        </section>
      </div>
    </div>
  )
}
