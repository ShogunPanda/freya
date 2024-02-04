import { type CSSClassToken } from './contexts.js'

const cssClassAlphabet = 'abcdefghijklmnopqrstuvwxyz'
const cssClassAlphabetLength = cssClassAlphabet.length

export const cssClassExpansionPriorities = [
  /^var-/,
  /^(relative|absolute|fixed|sticky)$/,
  /^(block|inline|inline-block|flex|grid)$/,
  /^display-/,
  /^flex-(col|row|\d+)/,
  /^grid-areas-/,
  /^grid-(auto-)?(cols|rows)-/,
  /^grid-area-/,
  /^gap-/,
  /^[whz]-/,
  /^(min|max)-[whz]-/,
  /^(-?)(top|bottom|left|right)-/,
  /^(-?)([mp])-/,
  /^(-?)([mp][xy])-/,
  /^(-?)([mp][tblr])-/,
  /^border-(?![tblr]-)/,
  /^border-/,
  /^rounded-(?!([xytblr]+)-)/,
  /^rounded-/,
  /^(self-)?(items|justify|align)-/,
  /^space-(between|around)$/,
  /^self-center$/,
  /^content-/,
  /^(bg|text|color)-/,
  /^(font-size|line-height)-/,
  /^(stroke|fill)-/,
  /^font-(extralight|light|normal|semibold|bold)$/,
  /^underline$/,
  /^font-/,
  /^leading-/,
  /^whitespace-/,
  /^transform-/,
  /^shadow-/,
  /^opacity-/,
  /^overflow-/,
  /^object-/,
  /^cursor-/,
  /^counter-/,
  /^pointer-events-none|select-none$/
]

export function tokenizeCssClasses(...klasses: (CSSClassToken | CSSClassToken[])[]): string[] {
  return klasses
    .flat(Number.MAX_SAFE_INTEGER)
    .filter(k => k)
    .map(k => (k as string).split(/\s+/))
    .flat(Number.MAX_SAFE_INTEGER)
    .map(k => (k as string).trim())
    .filter(k => k)
}

export function cleanCssClasses(...klasses: (CSSClassToken | CSSClassToken[])[]): string {
  return tokenizeCssClasses(...klasses)
    .filter(Boolean)
    .join(' ')
}

export function sortCssClasses(klass: string, i: number): string {
  if (klass.includes('@')) {
    return klass
  }

  i += 31 // This is to avoid generating the layer "ad", which might be forbidden from ads detectors

  let layer = ''
  do {
    let index = i % cssClassAlphabetLength
    i = i / cssClassAlphabetLength

    if (index - 1 === -1) {
      index = cssClassAlphabetLength
      i--
    }

    layer = cssClassAlphabet.charAt(index - 1) + layer
  } while (i >= 1)

  return `${layer}@${klass}`
}
