import { createContext, type Context } from 'preact'
import { useContext } from 'preact/hooks'
import { type ClientContext as ClientContextModel, type ParsedSVG } from '../slidesets/models.js'
import { cleanCssClasses } from './styling.js'

export type CSSClassToken = string | false | undefined | null

export type CSSClassesResolver = (...klasses: (CSSClassToken | CSSClassToken[])[]) => string
export type ImagesResolver = (theme: string, talk: string, url?: string) => string
export type SVGResolver = (theme: string, talk: string, url?: string) => ParsedSVG
export type MarkdownParser = (raw?: string) => string

export interface ClientContextMethods {
  resolveClasses: CSSClassesResolver
  resolveImage: ImagesResolver
  resolveSVG: SVGResolver
  parseContent: MarkdownParser
}

export type ClientContextProps = ClientContextModel & ClientContextMethods

export interface SlideContextProps<SlideModel = Record<string, unknown>> {
  slide: SlideModel
  index: number
  previousIndex: number
  navigator?: boolean
  presenter?: boolean
}

export const ClientContextInstance = createContext<ClientContextProps>(undefined as unknown as ClientContextProps)
export const SlideContextInstance = createContext<SlideContextProps>(undefined as unknown as SlideContextProps)

export function defaultImagesResolver(_theme: string, _talk: string, url?: string): string {
  return url ?? ''
}

export function defaultMarkdownParser(raw?: string): string {
  return raw ?? ''
}

export function defaultSVGResolver(_theme: string, _talk: string, _path?: string): ParsedSVG {
  return ['', undefined]
}

export function createClientContextValue(context: ClientContextModel, hooks: ClientContextMethods): ClientContextProps {
  const { resolveClasses, resolveImage, resolveSVG, parseContent } = hooks

  return {
    ...context,
    resolveClasses: resolveClasses ?? cleanCssClasses,
    resolveImage: resolveImage ?? defaultImagesResolver,
    resolveSVG: resolveSVG ?? defaultSVGResolver,
    parseContent: parseContent ?? defaultMarkdownParser
  }
}

export function useClient(): ClientContextProps {
  return useContext(ClientContextInstance)
}

export function useSlide<SlideModel>(): SlideContextProps<SlideModel> {
  return useContext(SlideContextInstance as Context<SlideContextProps<SlideModel>>)
}
