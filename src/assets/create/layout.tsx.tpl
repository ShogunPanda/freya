import { useContext } from 'react'
import { CSSClassesResolverContext, Slide, SlideProps, parseContent } from 'freya-slides'

export default function DefaultLayout({ context, slide, index }: SlideProps<Slide>): JSX.Element {
  const resolveClasses = context.extensions.freya.resolveClasses
  const { title, content, notes } = slide

  return (
    <CSSClassesResolverContext.Provider value={resolveClasses}>
      <div
        key={`slide:${index}`}
        data-freya-id="slide"
        data-freya-index={index}
        className={resolveClasses('freya@slide')}
      >
        <h1 dangerouslySetInnerHTML={{ __html: parseContent(title) }} />

        {content
          ?.filter(Boolean)
          .map((c: string, contentIndex: number) => (
            <h4 key={`content:${index}:${contentIndex}`} dangerouslySetInnerHTML={{ __html: parseContent(c) }} />
          ))}

        <template data-freya-id="slide-notes" dangerouslySetInnerHTML={{ __html: notes ?? '' }} />
      </div>
    </CSSClassesResolverContext.Provider>
  )
}