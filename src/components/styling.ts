import { type CSSClassToken } from './contexts.js'

const cssClassAlphabet = 'abcdefghijklmnopqrstuvwxyz'
const cssClassAlphabetLength = cssClassAlphabet.length

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
