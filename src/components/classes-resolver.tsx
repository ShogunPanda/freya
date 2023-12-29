import { createContext, type ReactNode } from 'react'

export type CSSClassToken = string | false | undefined | null

export type CSSClassesResolver = (...klasses: (CSSClassToken | CSSClassToken[])[]) => string

interface CSSClassResolverProps {
  resolver?: CSSClassesResolver
  children?: ReactNode
}

export const CSSClassesResolverContext = createContext<CSSClassesResolver>(undefined as unknown as CSSClassesResolver)

export function sanitizeClassName(...raw: CSSClassToken[]): string {
  return raw
    .filter(c => c && typeof c === 'string')
    .join(' ')
    .replaceAll('\n', '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

export function defaultCSSClassesResolver(...klasses: (CSSClassToken | CSSClassToken[])[]): string {
  return sanitizeClassName(...(klasses.flat(Number.MAX_VALUE).filter(Boolean) as string[]))
}

export function CSSClassResolver({ resolver, children }: CSSClassResolverProps): JSX.Element {
  const currentResolver = resolver ?? defaultCSSClassesResolver
  return <CSSClassesResolverContext.Provider value={currentResolver}>{children}</CSSClassesResolverContext.Provider>
}
