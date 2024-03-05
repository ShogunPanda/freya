export type CSSClassToken = string | false | undefined | null

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
