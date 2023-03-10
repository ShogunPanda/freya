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

async function inlineCss(config: UserConfig, fonts: string, id: string): Promise<string> {
  id = id.replace(/^\/handled\//, '')

  if (id === 'virtual:theme-fonts') {
    return fonts
  } else if (id.startsWith('@freya')) {
    const url = new URL(`../assets/styles/${id.replace('@freya/', '')}`, import.meta.url)

    return transformCSS(await readFile(fileURLToPath(url), 'utf8'), config)
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

export async function finalizeCss(
  config: UserConfig,
  css: string,
  fonts: string,
  minify: boolean = true
): Promise<string> {
  // Process them using postcss
  const processed = await postcss([
    postcssImport({
      resolve(id: string): string {
        return `/handled/${id}`
      },
      load: inlineCss.bind(null, config, fonts)
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

export async function transformCSS(css: string, config: UserConfig): Promise<string> {
  // Create a generator
  const generator = createGenerator(config)

  // Trasform the file
  const code = new MagicString(css)
  await transformDirectives(code, generator, {})

  return code.toString()
}

export async function transformCSSFile(path: string, config: UserConfig): Promise<string> {
  return transformCSS(await readFile(path, 'utf8'), config)
}

export function defineUnoConfig<Theme extends {} = UnoTheme>(config: UserConfig<Theme>): UserConfig<Theme> {
  return config
}
