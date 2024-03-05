import { rootDir, type BuildContext } from '@perseveranza-pets/dante'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Comment, type Declaration, type Plugin } from 'postcss'
import { readFile } from './fs.js'
import { getTalk, getTheme } from './slidesets/loaders.js'
import { type Theme } from './slidesets/models.js'

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
  let theme: Theme | undefined

  if (!id || id === '404' || id === 'index' || id.endsWith('_assets') || id === 'speaker-notes') {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    cssFiles = [loadLayeredCss('page', fileURLToPath(new URL('./assets/styles/page.css', import.meta.url)))]
  } else {
    const talk = await getTalk(id)
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
    '@layer normalize, variables, reset, fonts, responsiveness, slideset, theme, talk, page;',
    loadLayeredCss('normalize', fileURLToPath(new URL('./assets/styles/normalize.css', import.meta.url))),
    loadLayeredCss('variables', fileURLToPath(new URL('./assets/styles/variables.css', import.meta.url))),
    loadLayeredCss('reset', fileURLToPath(new URL('./assets/styles/reset.css', import.meta.url))),
    loadLayeredCss('fonts', fileURLToPath(new URL('./assets/styles/fonts.css', import.meta.url))),
    loadLayeredCss('responsiveness', fileURLToPath(new URL('./assets/styles/responsiveness.css', import.meta.url))),
    ...cssFiles
  ])

  return layers.join('\n\n').replaceAll(/(freya|theme|talk)@/g, '$1\\@')
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

export const postcssPlugins: Plugin[] = [customUnitsPlugin()]
