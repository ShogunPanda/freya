import { getHighlighter, renderToHtml, type Highlighter, type Lang } from 'shiki'
import { type Slide } from '../slidesets/models.js'

const highlightersCache = new Map<string, Highlighter>()

// Add support for the command grammar
const consoleGrammar = {
  id: 'console',
  scopeName: 'source.console',
  grammar: {
    scopeName: 'source.console',
    patterns: [{ include: '#command' }, { include: '#output' }],
    repository: {
      command: {
        patterns: [
          {
            begin: '^[a-z-]+@[a-z-]+',
            end: '\n',
            name: 'string',
            patterns: [
              {
                match: ':',
                name: 'keyword.operator'
              },
              {
                match: '~',
                name: 'variable.function'
              },
              {
                match: '\\$',
                name: 'keyword.operator'
              },
              {
                match: '.+',
                name: 'punctuation.definition.bold'
              }
            ]
          }
        ]
      },
      output: {
        patterns: [{ match: '.+', name: 'comment' }]
      }
    }
  }
}

async function createHighlighter(language: string, theme: string): Promise<Highlighter> {
  const cacheKey = `${theme}:${language}`
  let highlighter = highlightersCache.get(cacheKey)

  if (!highlighter) {
    highlighter = await getHighlighter({ langs: [language as unknown as Lang], themes: [theme] })
    await highlighter.loadLanguage(consoleGrammar as any)
    highlightersCache.set(cacheKey, highlighter)
  }

  return highlighter
}

export function parseRanges(highlight: any): number[][] {
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

export async function renderCode(
  { content, language, numbers, highlight }: Required<Slide>['code'],
  theme: string = 'one-dark-pro'
): Promise<string> {
  if (!language) {
    language = 'javascript'
  }

  const highlighter = await createHighlighter(language, theme)

  const tokens = highlighter.codeToThemedTokens(content.trim(), language, 'one-dark-pro')
  const { fg, bg } = highlighter.getTheme(theme)

  let i = 0
  const ranges = parseRanges(highlight)

  return renderToHtml(tokens, {
    elements: {
      line({ className, children }: Record<string, unknown>): string {
        i++
        const nextRange = ranges[0]
        let baseClass = 'code__line'

        // There is a range to higlight
        if (nextRange) {
          // We have to highlight
          if (nextRange[0] <= i && nextRange[1] >= i) {
            baseClass += ' code__line__highlighted'

            // If it was a single line, make sure we move to the next range
            if (nextRange[0] === nextRange[1]) {
              ranges.shift()
            }
            // We're past the previous range, look for the next one
          } else if (nextRange[0] <= i) {
            ranges.shift()
          }
        }
        const lineNumberSpan = numbers !== false ? `<span class="code__line__number">${i}</span>` : ''
        return `<span class="${className} ${baseClass}">${lineNumberSpan}${children}</span>`
      }
    },
    fg,
    bg,
    themeName: theme
  }).replace('<pre class="', '<pre class="code__root ')
}
