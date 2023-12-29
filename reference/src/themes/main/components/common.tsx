import { type BuildContext } from 'dante'
import { useContext, type CSSProperties, type ReactNode } from 'react'
import { CSSClassesResolverContext, parseContent, renderNotes } from '../../../../../dist/index.js'
import { type Slide as FreyaSlide, type SlideProps, type Talk, type Theme } from '../../../../../src/index.js'
import { type Slide } from '../models.js'

interface SlideWrapperProps {
  context: BuildContext
  theme: Theme
  talk: Talk
  slide: Slide
  index: number
  className?: string
  style?: CSSProperties
  skipDecorations?: boolean
  defaultLogoColor?: 'black' | 'white'
  children: ReactNode
}

interface TextProps {
  text: string
  className?: string
}

type ComplexContentProps = SlideProps<Slide> & { raw: Record<string, any> }

type DecorationProps = Omit<SlideWrapperProps, 'skipDecorations' | 'children'>

export function Text({ text, className }: TextProps): JSX.Element {
  const resolveClasses = useContext(CSSClassesResolverContext)

  text = parseContent(text).replaceAll(/class="([^"]+)"/g, (_, classes) => `class="${resolveClasses(classes)}"`)

  return <span className={resolveClasses(className)} dangerouslySetInnerHTML={{ __html: text }} />
}

export function SlideWrapper({
  context,
  theme,
  talk,
  slide,
  index,
  style,
  className,
  skipDecorations,
  defaultLogoColor,
  children
}: SlideWrapperProps): JSX.Element {
  const resolveClasses = context.extensions.freya.resolveClasses

  const { foreground, background } = slide

  // These two should be moved to the SlideWrapper component
  const foregroundClass = foreground ? `theme@text-${foreground}` : ''
  const backgroundClass = background ? `theme@bg-${background}` : ''

  if (!defaultLogoColor) {
    defaultLogoColor = 'black'
  }

  return (
    <CSSClassesResolverContext.Provider value={resolveClasses}>
      <article
        data-freya-id="slide"
        data-freya-index={index}
        className={resolveClasses('freya@slide', `z-${index + 100}`, foregroundClass, backgroundClass, className)}
        style={style}
      >
        {children}
        <div data-freya-id="progress" className={resolveClasses('freya@slide__progress')} />

        <template data-freya-id="slide-notes" dangerouslySetInnerHTML={{ __html: renderNotes(slide as FreyaSlide) }} />
      </article>
    </CSSClassesResolverContext.Provider>
  )
}
