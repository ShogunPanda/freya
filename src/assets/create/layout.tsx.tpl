import { parseContent } from '@freya/generation/generator.js'
import { Slide, SlideProps } from '@freya/generation/models.js'

export default function DefaultLayout({ slide, index }: SlideProps<Slide>): JSX.Element {
  const { title, content, notes } = slide

  return (
    <div key={`slide:${index}`} data-freya-id="slide" data-freya-index={index} className="freya__slide">
      <h1 dangerouslySetInnerHTML={{ __html: parseContent(title) }} />

      {content?.filter(Boolean).map((c: string, contentIndex: number) => (
        <h4 key={`content:${index}:${contentIndex}`} dangerouslySetInnerHTML={{ __html: parseContent(c) }} />
      ))}

      <template data-freya-id="slide-notes" dangerouslySetInnerHTML={{ __html: notes ?? '' }} />
    </div>
  )
}
