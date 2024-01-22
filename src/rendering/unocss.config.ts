import { type CSSValue, type Rule } from '@unocss/core'
import { handler } from '@unocss/preset-mini/utils'
import presetWind from '@unocss/preset-wind'
import transformerDirectives from '@unocss/transformer-directives'
import { defineUnoConfig, layersVariant } from './unocss.js'

export type UnoRuleDefinition = [
  string | RegExp,
  Record<string, string> | ((v: string[]) => Record<string, string> | CSSValue)
]

export const systemFonts =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"

export const systemMonospaceFonts = "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"

export const customUnits: Record<string, [number, string]> = {
  ch: [1, 'ch'],
  em: [1, 'em'],
  rem: [1, 'rem'],
  p: [1, '%'],
  px: [1, 'px'],
  vw: [1, 'vw'],
  vh: [1, 'vh'],
  sp: [200, 'px']
}

export function parseNumericValue(raw: string, units: Record<string, [number, string]> = {}): string {
  const mo = raw.match(/(\d+(?:_\d+)?)([a-z]+)/)

  if (!mo) {
    return raw
  }

  const parsed = Number.parseFloat(mo[1].replace('_', '.'))
  const [ratio, unit] = units[mo[2]] ?? [1, 'px']

  return `${parsed * ratio}${unit}`
}

export function numericRule(property: string, value: string, unit: string = '', ratio: number = 1): CSSValue {
  const parsed = Number.parseFloat(value.replace('_', '.'))

  return { [property]: `${parsed * ratio}${unit}` }
}

export function transformCSSValue(value: string): string | undefined {
  return value.startsWith('$') ? handler.cssvar(value) : handler.bracket(value)
}

export function generateSpacing(customUnit: string, ratio: number, unit: string): Rule[] {
  const spacings: Rule[] = []
  const sides: Record<string, string[]> = {
    t: ['top'],
    b: ['bottom'],
    l: ['left'],
    r: ['right'],
    x: ['left', 'right'],
    y: ['top', 'bottom']
  }
  const modifiers: [string, number][] = [
    ['', 1],
    ['-', -1]
  ]

  for (const [short, long] of [
    ['p', 'padding'],
    ['m', 'margin']
  ]) {
    for (const [prefix, modifier] of modifiers) {
      spacings.push(
        [
          new RegExp(`^${prefix}${short}-(\\d+(?:_\\d+)?)${customUnit}$`),
          ([, d]) => numericRule(long, d, unit, ratio * modifier)
        ],
        [
          new RegExp(`^${prefix}${short}([tblrxy])-(\\d+(?:_\\d+)?)${customUnit}$`),
          ([, dir, value]) => {
            const values: CSSValue = {}

            for (const side of sides[dir]) {
              Object.assign(values, numericRule(`${long}-${side}`, value, unit, ratio * modifier))
            }

            return values
          }
        ]
      )
    }
  }

  return spacings
}

export function generateGaps(customUnit: string, ratio: number, unit: string): Rule[] {
  return [
    [
      new RegExp(`^gap-(\\d+(?:_\\d+)?)${customUnit}$`),
      ([, value]) => ({
        ...numericRule('grid-gap', value, unit, ratio),
        ...numericRule('gap', value, unit, ratio)
      })
    ],
    [
      new RegExp(`^gap-x-(\\d+(?:_\\d+)?)${customUnit}$`),
      ([, value]) => ({
        ...numericRule('grid-column-gap', value, unit, ratio),
        ...numericRule('column-gap', value, unit, ratio)
      })
    ],
    [
      new RegExp(`^gap-y-(\\d+(?:_\\d+)?)${customUnit}$`),
      ([, value]) => ({
        ...numericRule('grid-row-gap', value, unit, ratio),
        ...numericRule('row-gap', value, unit, ratio)
      })
    ]
  ]
}

export function generateBorders(customUnit: string, ratio: number, unit: string): Rule[] {
  const borders: Rule[] = [
    [new RegExp(`^border-(\\d+(?:_\\d+)?)${customUnit}$`), ([, d]) => numericRule('border-width', d, unit, ratio)]
  ]

  for (const [short, long] of [
    ['t', 'top'],
    ['b', 'bottom'],
    ['l', 'left'],
    ['r', 'right']
  ]) {
    borders.push([
      new RegExp(`^border-${short}-(\\d+(?:_\\d+)?)${customUnit}$`),
      ([, d]) => numericRule(`border-${long}-width`, d, unit, ratio)
    ])
  }

  return borders
}

export function generateRadiuses(customUnit: string, ratio: number, unit: string): Rule[] {
  const radiuses: Rule[] = [
    [new RegExp(`^rounded-(\\d+(?:_\\d+)?)${customUnit}$`), ([, d]) => numericRule('border-radius', d, unit, ratio)]
  ]

  for (const [short, long] of [
    ['t', ['top-left', 'top-right']],
    ['b', ['bottom-left', 'bottom-right']],
    ['l', ['top-left', 'bottom-left']],
    ['r', ['top-right', 'bottom-right']],
    ['tl', ['top-left']],
    ['tr', ['top-right']],
    ['bl', ['bottom-left']],
    ['br', ['bottom-right']]
  ]) {
    radiuses.push([
      new RegExp(`^rounded-${short}-(\\d+(?:_\\d+)?)${customUnit}$`),
      ([, d]) => {
        const r: CSSValue = {}

        for (const l of long) {
          Object.assign(r, numericRule(`border-${l}-radius`, d, unit, ratio))
        }

        return r
      }
    ])
  }

  return radiuses
}

export function generatePositions(customUnit: string, ratio: number, unit: string): Rule[] {
  const positions: Rule[] = []
  for (const position of ['top', 'bottom', 'left', 'right']) {
    positions.push(
      [
        new RegExp(`^${position}-(\\d+(?:_\\d+)?)${customUnit}$`),
        ([, value]) => numericRule(position, value, unit, ratio)
      ],
      [
        new RegExp(`^-${position}-(\\d+(?:_\\d+)?)${customUnit}$`),
        ([, value]) => numericRule(position, value, unit, -ratio)
      ]
    )
  }

  return positions
}

export function generateDimensions(
  short: string,
  long: string,
  customUnit: string,
  ratio: number,
  unit: string
): Rule[] {
  const dimensions: Rule[] = []

  for (const prefix of ['', 'min-', 'max-']) {
    dimensions.push([
      new RegExp(`^${prefix}${short}-(\\d+(?:_\\d+)?)${customUnit}$`),
      ([, value]) => numericRule(`${prefix}${long}`, value, unit, ratio)
    ])
  }

  return dimensions
}

export function generateCustomUnits(): Rule[] {
  const rules: Rule[] = []

  for (const [customUnit, [ratio, unit]] of Object.entries(customUnits)) {
    rules.push(
      ...generateSpacing(customUnit, ratio, unit),
      ...generatePositions(customUnit, ratio, unit),
      ...generateGaps(customUnit, ratio, unit),
      ...generateBorders(customUnit, ratio, unit),
      ...generateRadiuses(customUnit, ratio, unit),
      ...generateDimensions('w', 'width', customUnit, ratio, unit),
      ...generateDimensions('h', 'height', customUnit, ratio, unit)
    )
  }

  return rules
}

export const layers: Record<string, number> = {
  components: 10,
  utilities: 11,
  default: 12,
  freya: 20
}

export const unocssConfig = defineUnoConfig({
  presets: [presetWind()],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      'fs-bg': 'var(--fs-color-bg)',
      'fs-bg-darker': 'var(--fs-color-bg-darker)',
      'fs-fg': 'var(--fs-color-fg)',
      'fs-grey': 'var(--fs-color-grey)',
      'fs-yellow': 'var(--fs-color-yellow)',
      'fs-blue': 'var(--fs-color-blue)'
    },
    boxShadow: {
      'freya-assets': '5px 5px 10px -5px'
    },
    shadowColor: {
      'freya-assets-shadow-color': 'var(--fs-color-shadow)'
    }
  },
  rules: [
    [/^flex-(\d+)$/, ([, value]: string[]) => ({ flex: `${value} ${value} 0%` })],
    ['flex-initial', { flex: 'initial' }], // This rule purposely overrides preset-mini one
    [
      /^transform-(.+)/,
      ([, value]: string[]) => {
        return { transform: transformCSSValue(value) }
      }
    ],
    [
      /^content-(\[.+\])/,
      ([, value]: string[]) => {
        return { content: transformCSSValue(value) }
      }
    ],
    [
      /^counter-reset-(.+)/,
      ([, value]: string[]) => {
        return { 'counter-reset': transformCSSValue(value) }
      }
    ],
    [
      /^counter-increment-(.+)/,
      ([, value]: string[]) => {
        return { 'counter-increment': transformCSSValue(value) }
      }
    ],
    [
      /^var-(.+?)-(.+)/,
      ([, name, value]: string[]) => {
        return { [`--${name}`]: transformCSSValue(value) }
      }
    ],
    ...generateCustomUnits(),
    ...generateBorders('', 1, 'px'),
    ...generateRadiuses('', 1, 'px'),
    [/^stroke-width-(\d+(?:_\d+)?)$/, ([, value]: string[]) => numericRule('stroke-width', value)],
    [/^line-height-(\d+(?:_\d+)?)$/, ([, value]: string[]) => numericRule('line-height', value, 'em')],
    [/^font-size-(\d+(?:_\d+)?)em$/, ([, value]: string[]) => numericRule('font-size', value, 'em')],
    [/^font-size-(\d+(?:_\d+)?)pt$/, ([, value]: string[]) => numericRule('font-size', value, 'px', 2.7)],
    [
      /^var-\[([^]+)\]-(.+)/,
      ([, name, value]: string[]) => {
        return { [`--${name}`]: transformCSSValue(value) }
      }
    ],
    ['font-system-fonts', { 'font-family': systemFonts }],
    ['font-monospace-system-fonts', { 'font-family': systemMonospaceFonts }],
    ['font-varela', { 'font-family': `"Varela Round", ${systemFonts}` }],
    ['font-noto-sans', { 'font-family': `'Noto Sans', ${systemMonospaceFonts}` }]
  ],
  layers,
  variants: [layersVariant],
  safelist: []
})

export default unocssConfig
