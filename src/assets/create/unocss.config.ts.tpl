import { defineUnoConfig, getTalk, getTalks, numericRule, systemFonts, systemMonospaceFonts } from 'freya-slides'
import { CSSValue, Rule } from '@unocss/core'
import presetWind from '@unocss/preset-wind'
import transformerDirectives from '@unocss/transformer-directives'

function generateSpacing(customUnit: string, ratio: number, unit: string): Array<Rule> {
  const spacings: Array<Rule> = []
  const sides: Record<string, Array<string>> = {
    t: ['top'],
    b: ['bottom'],
    l: ['left'],
    r: ['right'],
    x: ['left', 'right'],
    y: ['top', 'bottom']
  }
  const modifiers: Array<[string, number]> = [
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

function generateGaps(customUnit: string, ratio: number, unit: string): Array<Rule> {
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

function generateBorders(customUnit: string, ratio: number, unit: string): Array<Rule> {
  const borders: Array<Rule> = [
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

function generateRadiuses(customUnit: string, ratio: number, unit: string): Rule[] {
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

function generatePositions(customUnit: string, ratio: number, unit: string): Array<Rule> {
  const positions: Array<Rule> = []
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

function generateDimensions(short: string, long: string, customUnit: string, ratio: number, unit: string): Array<Rule> {
  const dimensions: Array<Rule> = []

  for (const prefix of ['', 'min-', 'max-']) {
    dimensions.push([
      new RegExp(`^${prefix}${short}-(\\d+(?:_\\d+)?)${customUnit}$`),
      ([, value]) => numericRule(`${prefix}${long}`, value, unit, ratio)
    ])
  }

  return dimensions
}

function generateCustomUnits(): Array<Rule> {
  const customUnits: Array<[string, number, string]> = [
    ['sp', 200, 'px'],
    ['p', 1, '%']
  ]
  const rules: Array<Rule> = []

  for (const [customUnit, ratio, unit] of customUnits) {
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

const talks = await getTalks()
const safelist = new Set<string>()

for (const id of talks) {
  const talk = await getTalk(id)

  for (const slide of talk.slides) {
    for (const value of Object.values(slide.classes ?? {})) {
      for (const klass of value.split(' ')) {
        safelist.add(klass)
      }
    }
  }
}

export default defineUnoConfig({
  presets: [presetWind()],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      nfDarkGrey: '#272d3a',
      nfLightGrey: '#f2f2f0',
      nfDarkestBlue: '#130048',
      nfBrunchPink: '#fb7a9c',
      nfMidnightBlue: '#194caa',
      nfNeonBlue: '#2165e3',
      nfOrangeSplit: '#ecb22e'
    }
  },
  rules: [
    [/^flex-(\d+)$/, ([, value]: Array<string>) => ({ flex: `${value} ${value} 0%` })],
    ['flex-row', { 'flex-direction': 'row' }],
    [/^grid-([a-z]+)$/, ([, value]: Array<string>) => ({ 'grid-area': value })],
    ...generateCustomUnits(),
    ...generateBorders('', 1, 'px'),
    ...generateBorders('', 1, 'px'),
    [/^stroke-width-(\d+(?:_\d+)?)$/, ([, value]: Array<string>) => numericRule('stroke-width', value)],
    [/^line-height-(\d+(?:_\d+)?)$/, ([, value]: Array<string>) => numericRule('line-height', value, 'em')],
    [/^font-size-(\d+(?:_\d+)?)em$/, ([, value]: Array<string>) => numericRule('font-size', value, 'em')],
    [/^font-size-(\d+(?:_\d+)?)pt$/, ([, value]: Array<string>) => numericRule('font-size', value, 'px', 2.7)],
    ['font-system-fonts', { 'font-family': systemFonts }],
    ['font-monospace-system-fonts', { 'font-family': systemMonospaceFonts }]
  ],
  safelist: ['hidden', ...safelist]
})
