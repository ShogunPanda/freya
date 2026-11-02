import type { BuildContext } from '@perseveranza-pets/dante'
import type { TokenOrValue } from 'lightningcss'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rootDir } from '@perseveranza-pets/dante'
import { transform } from 'lightningcss'
import { readFile } from './fs.ts'
import { getTalk, getTheme } from './slidesets/loaders.ts'

interface Dimension {
  type: 'dimension'
  value: number
  unit: string
}

interface ColorAtRule {
  name: 'color'
  prelude: {
    value: {
      components: { value: string }[]
    }
  }
  loc: unknown
}

export type CustomUnits = Record<string, [number, string]>

export interface CustomUnitPluginOptions {
  units?: CustomUnits
}

export const customUnits: CustomUnits = {
  pt: [2.7, 'px'],
  sp: [200, 'px']
}

async function loadLayeredCss(layer: string, path: string, emptyOnFailures: boolean = false): Promise<string> {
  try {
    const contents = await readFile(path)

    return `
      @layer ${layer} {
        ${contents}
      }
    `
  } catch (e) {
    if (!emptyOnFailures) {
      throw e
    }

    return `
      @layer ${layer} {}
    `
  }
}

export async function css(context: BuildContext): Promise<string> {
  let id = basename(context.currentPage ?? '', '.html')

  if (id && context.extensions.freya.export) {
    id = id === 'speaker-notes' ? id : basename(dirname(context.currentPage!))
  }

  // Project-owned system pages supply their complete document and styling.
  if (
    !id ||
    id === '404' ||
    id === 'index' ||
    id.endsWith('_assets') ||
    id.endsWith('_speaker-notes') ||
    id === 'speaker-notes'
  ) {
    return ''
  }

  const talk = await getTalk(id)
  const theme = await getTheme(talk.config.theme)

  const cssFiles = [
    `@layer variables {
        :root {
          --freya-slide-width: ${talk.config.dimensions.width}px;
          --freya-slide-height: ${talk.config.dimensions.height}px;
        }
      }`,
    loadLayeredCss('slideset', fileURLToPath(new URL('./assets/styles/slideset.css', import.meta.url))),
    loadLayeredCss('reset', resolve(rootDir, 'src/themes', theme.id, 'reset.css'), true),
    loadLayeredCss('variables', resolve(rootDir, 'src/themes', theme.id, 'variables.css'), true),
    loadLayeredCss('colors', resolve(rootDir, 'src/themes', theme.id, 'colors.css'), true),
    loadLayeredCss('theme', resolve(rootDir, 'src/themes', theme.id, theme.style ?? 'theme.css')),
    loadLayeredCss('talk', resolve(rootDir, 'src/talks', talk.id, 'talk.css'), true)
  ]

  const layers = await Promise.all([
    '@layer normalize, variables, reset, fonts, responsiveness, slideset, theme, talk, colors;',
    loadLayeredCss('normalize', fileURLToPath(new URL('./assets/styles/normalize.css', import.meta.url))),
    loadLayeredCss('variables', fileURLToPath(new URL('./assets/styles/variables.css', import.meta.url))),
    loadLayeredCss('reset', fileURLToPath(new URL('./assets/styles/reset.css', import.meta.url))),
    loadLayeredCss('responsiveness', fileURLToPath(new URL('./assets/styles/responsiveness.css', import.meta.url))),
    ...cssFiles
  ])

  return resolveCSSImports(layers.join('\n\n'), theme.id, talk.id)
}

async function resolveCSSImports(
  css: string,
  theme?: string,
  talk?: string,
  imports: Record<string, string> = {}
): Promise<string> {
  const matcher = /^[\t ]*@import[\t ]+(['"])(@[^'"\r\n]+)\1;[\t ]*$/m
  let mo: RegExpMatchArray | null = ['']
  while (mo) {
    mo = css.match(matcher)

    if (!mo) {
      break
    }

    const id = mo[2]
    let url
    let replacement = `/* ERROR: import "${id}" not found */`

    if (id.startsWith('@freya/')) {
      url = fileURLToPath(new URL(`./assets/styles/${id.replace('@freya/', '')}`, import.meta.url))
    } else if (id.startsWith('@theme/') && theme) {
      url = resolve(rootDir, 'src/themes', theme, id.replace('@theme/', ''))
    } else if (id.startsWith('@talk/') && talk) {
      url = resolve(rootDir, 'src/talks', talk, id.replace('@talk/', ''))
    } else if (id.startsWith('@./')) {
      url = resolve(rootDir, 'src', id.replace(/^@/, ''))
    } else {
      const separator = id.indexOf('/')
      const alias = id.slice(1, separator)
      if (separator > 1 && Object.hasOwn(imports, alias)) {
        url = resolve(imports[alias], id.slice(separator + 1))
      }
    }

    if (url) {
      replacement = await readFile(url)
    }

    css = css.replaceAll(mo[0], replacement)
  }

  return css.replaceAll(/((?:freya|theme|talk)(?:-(?:[a-z0-9-]+))?)@/g, '$1\\@')
}

/** Compile a project stylesheet without injecting Freya's default styles. */
export async function compileCSS(
  path: string | URL,
  context: Pick<BuildContext, 'isProduction'> & Partial<Pick<BuildContext, 'extensions'>>
): Promise<string> {
  const filename = path instanceof URL ? fileURLToPath(path) : resolve(rootDir, path)
  const imports: Record<string, string> = {}
  for (const [alias, directory] of Object.entries(
    (context.extensions?.freya?.cssImports ?? {}) as Record<string, string>
  )) {
    if (!alias || /[@/]/.test(alias) || ['freya', 'theme', 'talk', '.'].includes(alias)) {
      throw new Error(`Invalid or reserved CSS import alias "${alias}"`)
    }
    const expanded = directory === '~' || directory.startsWith('~/') ? homedir() + directory.slice(1) : directory
    if (!isAbsolute(expanded)) {
      throw new Error(`CSS import alias "${alias}" requires an absolute path or a path starting with ~/`)
    }
    Object.defineProperty(imports, alias, { value: expanded, enumerable: true })
  }
  const source = await resolveCSSImports(await readFile(filename), undefined, undefined, imports)
  const { code } = transform({
    filename,
    code: Buffer.from(source),
    minify: context.isProduction,
    sourceMap: false,
    customAtRules: {
      color: { prelude: '<custom-ident>+' }
    },
    visitor: cssVisitor
  })
  return code.toString()
}

export const cssVisitor = {
  Token: {
    // Custom dimension visitor
    dimension(token: Dimension) {
      const declaration = customUnits[token.unit.replace('--', '')]

      if (!declaration) {
        return
      }

      const [ratio, unit] = declaration

      return {
        type: 'token',
        value: {
          type: 'dimension',
          value: token.value * ratio,
          unit
        }
      } as TokenOrValue
    }
  },
  Rule: {
    custom: {
      // Custom color rule
      color(rule: ColorAtRule) {
        const [name, color] = rule.prelude.value.components.map(c => c.value)

        return [
          {
            type: 'style',
            value: {
              selectors: [[{ type: 'class', name: `theme@fg-${name}` }]],
              loc: rule.loc,
              declarations: {
                declarations: [
                  {
                    property: 'custom',
                    value: {
                      name: 'color',
                      value: [
                        {
                          type: 'var',
                          value: {
                            name: {
                              ident: `--${color}`
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          },
          {
            type: 'style',
            value: {
              selectors: [[{ type: 'class', name: `theme@bg-${name}` }]],
              loc: rule.loc,
              declarations: {
                declarations: [
                  {
                    property: 'custom',
                    value: {
                      name: 'background-color',
                      value: [
                        {
                          type: 'var',
                          value: {
                            name: {
                              ident: `--${color}`
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    }
  }
}
