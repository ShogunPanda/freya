import hljs from 'highlight.js'
import { Slide } from '../generation/models.js'

hljs.registerLanguage('console', () => {
  return {
    case_insensitive: true,
    contains: [hljs.COMMENT('^[^$].*', '$')]
  }
})

function parseRanges(highlight: any): number[][] {
  return (highlight ?? '')
    .split(',')
    .map((raw: string) => {
      const parsed = raw
        .trim()
        .split('-')
        .map(r => Number.parseInt(r))
        .filter(r => !Number.isNaN(r))

      switch (parsed.length) {
        case 0:
          return null
        case 1:
          return [parsed[0], parsed[0]]
        default:
          return parsed.slice(0, 2)
      }
    })
    .filter(Boolean)
}

function separateLines(rendered: string): string {
  return '<div class="hljs-line">' + rendered.split('\n').join('</div><div class="hljs-line">') + '</div>'
}

function enhanceLines(rendered: string, highlight: string, numbers: boolean): string {
  const ranges = parseRanges(highlight)

  let i = 0
  rendered = rendered.replaceAll('<div class="hljs-line">', () => {
    i++
    const classes = ['hljs-line']

    const nextRange = ranges[0]
    // There is a range to higlight
    if (nextRange) {
      // We have to highlight
      if (nextRange[0] <= i && nextRange[1] >= i) {
        classes.push('hljs-line--highlighted')

        // If it was a single line, make sure we move to the next range
        if (nextRange[0] === nextRange[1]) {
          ranges.shift()
        }
        // We're past the previous range, look for the next one
      } else if (nextRange[0] <= i) {
        ranges.shift()
      }
    }

    // Add line and numbers information to the line
    let replacement = `<div class="${classes.join(' ')}">`

    if (numbers) {
      replacement += `<span class="hljs-line-number">${i}</span>`
    }

    return replacement
  })

  return rendered
}

export function Code({
  content,
  language,
  numbers,
  highlight,
  className
}: Required<Slide>['code'] & { className?: string }): JSX.Element {
  if (!language) {
    language = 'javascript'
  }

  // Render via highlight.js
  let rendered = hljs.highlight(content, { language, ignoreIllegals: true }).value.trim()

  // Wrap all lines in a div - The detection is very naive, assuming newlines are outside of tags
  rendered = separateLines(rendered)

  // Handle line numbers and highlights
  rendered = enhanceLines(rendered, highlight ?? '', numbers !== false)

  // Workarounds to render all characters properly
  rendered = rendered.replaceAll('$', '&#36;')

  return (
    <pre className={`hljs code ${className ?? ''}`}>
      <code className={`${language} language-${language}`} dangerouslySetInnerHTML={{ __html: rendered }} />
    </pre>
  )
}
