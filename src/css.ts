import { rootDir, type BuildContext } from '@perseveranza-pets/dante'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Comment, Declaration, Rule, type AtRule, type Plugin } from 'postcss'
import { readFile } from './fs.js'
import { getTalk, getTheme } from './slidesets/loaders.js'
import { type Talk, type Theme } from './slidesets/models.js'

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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    cssFiles = [loadLayeredCss('page', fileURLToPath(new URL('./assets/styles/page.css', import.meta.url)))]
  } else {
    talk = await getTalk(id)
    theme = await getTheme(talk.config.theme)

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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

export function declareColorPlugin(): Plugin {
  const colorMatcher = /color\(([a-z0-9-_.$@]+)\s*,\s*([a-z0-9-_.$@]+)\)/i

  return {
    postcssPlugin: 'freya.declare-colors',
    AtRule(node: AtRule) {
      if (node.name !== 'apply') {
        return
      }

      const mo = node.params.match(colorMatcher)

      if (!mo) {
        return
      }

      const bg = new Rule({ selector: `&bg-${mo[1]}` })
      bg.append(new Declaration({ prop: 'background-color', value: `var(--${mo[2]})` }))
      const fg = new Rule({ selector: `&fg-${mo[1]}` })
      fg.append(new Declaration({ prop: 'color', value: `var(--${mo[2]})` }))

      node.after(bg)
      node.after(fg)
      node.remove()
    }
  }
}

export function customUnitsPlugin({ units }: CustomUnitPluginOptions = {}): Plugin {
  if (!units) {
    units = customUnits
  }

  const matcher = new RegExp(`(?<value>\\d+(?:\\.\\d+)?)--(?<unit>${Object.keys(units).join('|')})`, 'g')

  return {
    postcssPlugin: 'freya.custom-units',
    Declaration(node: Declaration) {
      if (!node.value.match(matcher)) {
        return
      }

      const originalValue = node.value

      node.value = node.value.replaceAll(matcher, (_, value: string, custom: string) => {
        const [ratio, unit] = units![custom]
        const parsed = parseFloat(value)

        const converted = `${(parsed * ratio).toFixed(3)}${unit}`
        node.before(new Comment({ text: `${originalValue} = ${converted}` }))
        return converted
      })
    }
  }
}

export const postcssPlugins: Plugin[] = [declareColorPlugin(), customUnitsPlugin()]
