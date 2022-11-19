import pino from 'pino'
import { Mode } from './mode.js'

export interface FontsList {
  ranges: Record<string, string>
  families: Record<string, Record<string, Record<number, string>>>
}

export interface RawTheme {
  style: string
  images: Array<string>
  fonts: FontsList
}

export interface Theme extends RawTheme {
  id: string
  fontsStyles: string
  fontsUrls: Array<string>
}

export interface BaseSlide {
  layout?: string
  title: string
  notes: string
  options: Record<string, any>
  classes: Record<string, any>
}

export interface Slide extends BaseSlide {
  [key: string]: any
}

export interface Config {
  theme: string
  dimensions: {
    width: number
    height: number
  }
}

export interface BaseDocument {
  title: string
  author: Record<string, any>
}

export interface Document extends BaseDocument {
  [key: string]: any
}

export interface RawTalk {
  config: Config
  document: Document
  slides: Array<Slide>
}

export interface Talk extends RawTalk {
  id: string
  slidesCount: number
  slidesPadding: number
  aspectRatio: number
  images: Array<string>
}

export interface ClientContext {
  mode: Mode
  id: string
  title: string
  dimensions: {
    width: number
    height: number
  }
  slidesCount: number
  slidesPadding: number
  aspectRatio: number
  current: number
}

export interface SlideProps<T = Slide> {
  theme: Theme
  talk: Talk
  slide: T
  index: number
}

export type SlideRenderer<T> = (props: SlideProps<T>) => JSX.Element

export interface Context {
  log: pino.BaseLogger
  talks: Set<string>
  slidesets: Record<string, string>
}

declare module 'fastify' {
  interface FastifyInstance {
    talks: Set<string>
    slidesets: Record<string, string>
  }
}
