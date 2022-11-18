import { createGenerator, CSSValue, UserConfig } from '@unocss/core'
import { Theme as UnoTheme } from '@unocss/preset-mini'
import { transformDirectives } from '@unocss/transformer-directives'
import MagicString from 'magic-string'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import postcssDiscardComments from 'postcss-discard-comments'
import postcssImport from 'postcss-import'
import postcssMinifySelector from 'postcss-minify-selectors'
import postcssNested from 'postcss-nested'
import postcssNormalizeWhitespace from 'postcss-normalize-whitespace'

function inlineCss(fonts: string, id: string): string | Promise<string> {
  id = id.replace(/^\/handled\//, '')

  if (id === 'virtual:theme-fonts') {
    return fonts
  } else if (id.startsWith('@freya')) {
    return readFile(fileURLToPath(new URL(`../assets/styles/${id.replace('@freya/', '')}`, import.meta.url)), 'utf8')
  }

  return `/*!!! not-found: ${id} */`
}

export function numericRule(property: string, value: string, unit: string = '', ratio: number = 1): CSSValue {
  const parsed = Number.parseFloat(value.replace('_', '.'))

  return { [property]: `${parsed * ratio}${unit}` }
}

export const systemFonts =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
export const systemMonospaceFonts = "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"

export async function finalizeCss(css: string, fonts: string, minify: boolean = true): Promise<string> {
  // Process them using postcss
  const processed = await postcss([
    postcssImport({
      resolve(id: string): string {
        return `/handled/${id}`
      },
      load: inlineCss.bind(null, fonts)
    }),
    postcssNested(),
    ...(minify
      ? [postcssDiscardComments({ removeAll: true }), postcssNormalizeWhitespace(), postcssMinifySelector()]
      : [])
  ]).process(css, {
    from: 'input.css',
    to: 'output.css'
  })

  return processed.css
}

export async function transformCSSFile(path: string, config: UserConfig): Promise<string> {
  // Create a generator
  const generator = createGenerator(config)

  // Trasform the file
  const code = new MagicString(await readFile(path, 'utf8'))
  await transformDirectives(code, generator, {})

  return code.toString()
}

export function defineUnoConfig<Theme extends {} = UnoTheme>(config: UserConfig<Theme>): UserConfig<Theme> {
  return config
}
