import { createContext, type ComponentChildren, type VNode } from 'preact'
import { useContext } from 'preact/hooks'
import { type ClientContext, type ParsedSVG } from '../slidesets/models.js'

export type CSSClassToken = string | false | undefined | null

export type CSSClassesResolver = (...klasses: (CSSClassToken | CSSClassToken[])[]) => string
export type ImagesResolver = (theme: string, talk: string, url?: string) => string
export type SVGResolver = (theme: string, talk: string, url?: string) => ParsedSVG
export type MarkdownParser = (raw?: string) => string

interface HookMethods {
  resolveClasses: CSSClassesResolver
  resolveImage: ImagesResolver
  resolveSVG: SVGResolver
  parseContent: MarkdownParser
}

export type FreyaHookProps = ClientContext & HookMethods

export interface FreyaContextProps extends Partial<HookMethods> {
  context: ClientContext
  children?: ComponentChildren | ComponentChildren[]
}

export const FreyaContext = createContext<FreyaHookProps>(undefined as unknown as FreyaHookProps)

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

export function defaultImagesResolver(_theme: string, _talk: string, url?: string): string {
  return url ?? ''
}

export function defaultMarkdownParser(raw?: string): string {
  return raw ?? ''
}

export function defaultSVGResolver(_theme: string, _talk: string, _path?: string): ParsedSVG {
  return ['', undefined]
}

export function FreyaContextRoot({
  context,
  resolveClasses,
  resolveImage,
  resolveSVG,
  parseContent,
  children
}: FreyaContextProps): VNode {
  const value = {
    ...context,
    resolveClasses: resolveClasses ?? defaultCSSClassesResolver,
    resolveImage: resolveImage ?? defaultImagesResolver,
    resolveSVG: resolveSVG ?? defaultSVGResolver,
    parseContent: parseContent ?? defaultMarkdownParser
  }

  return <FreyaContext.Provider value={value}>{children}</FreyaContext.Provider>
}

export function useFreya(): FreyaHookProps {
  return useContext(FreyaContext)
}
