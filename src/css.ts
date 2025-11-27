import type { BuildContext } from '@perseveranza-pets/dante'
import type { TokenOrValue } from 'lightningcss'
import type { Talk, Theme } from './slidesets/models.ts'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rootDir } from '@perseveranza-pets/dante'
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
    id = id.endsWith('--notes') ? 'speaker-notes' : id.split('--').shift()!
  }

  let cssFiles: Promise<string>[]
  let talk: Talk | undefined
  let theme: Theme | undefined

  if (!id || id === '404' || id === 'index' || id.endsWith('_assets') || id === 'speaker-notes') {
    cssFiles = [loadLayeredCss('page', fileURLToPath(new URL('./assets/styles/page.css', import.meta.url)))]
  } else {
    talk = await getTalk(id)
    theme = await getTheme(talk.config.theme)

    cssFiles = [
      loadLayeredCss('slideset', fileURLToPath(new URL('./assets/styles/slideset.css', import.meta.url))),
      loadLayeredCss('reset', resolve(rootDir, 'src/themes', theme.id, 'reset.css'), true),
      loadLayeredCss('theme', resolve(rootDir, 'src/themes', theme.id, 'theme.css')),
      loadLayeredCss('talk', resolve(rootDir, 'src/talks', talk.id, 'talk.css'), true)
    ]
  }

  const layers = await Promise.all([
    '@layer normalize, variables, colors, reset, fonts, responsiveness, slideset, theme, talk, page;',
    loadLayeredCss('normalize', fileURLToPath(new URL('./assets/styles/normalize.css', import.meta.url))),
    loadLayeredCss('variables', fileURLToPath(new URL('./assets/styles/variables.css', import.meta.url))),
    loadLayeredCss('reset', fileURLToPath(new URL('./assets/styles/reset.css', import.meta.url))),
    loadLayeredCss('fonts', fileURLToPath(new URL('./assets/styles/fonts.css', import.meta.url))),
    loadLayeredCss('responsiveness', fileURLToPath(new URL('./assets/styles/responsiveness.css', import.meta.url))),
    ...cssFiles
  ])

  let css = layers.join('\n\n')

  const matcher = /^@import (['"])(@.+)(\1);$/m
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

      replacement = await readFile(url)
    } else if (id.startsWith('@theme/') && theme) {
      url = resolve(rootDir, 'src/themes', theme.id, id.replace('@theme/', ''))
    } else if (id.startsWith('@talk/') && talk) {
      url = resolve(rootDir, 'src/talks', talk.id, id.replace('@talk/', ''))
    } else if (id.startsWith('@./')) {
      url = resolve(rootDir, 'src', id.replace(/^@/, ''))
    }

    if (url) {
      replacement = await readFile(url)
    }

    css = css.replaceAll(mo[0], replacement)
  }

  return css.replaceAll(/((?:freya|theme|talk)(?:-(?:[a-z0-9-]+))?)@/g, '$1\\@')
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
