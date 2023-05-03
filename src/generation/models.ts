import pino from 'pino'

export interface FontsList {
  ranges: Record<string, string>
  families: Record<string, Record<string, Record<number, string>>>
}

export interface RawTheme {
  style: string
  images: string[]
  fonts: FontsList
}

export interface Theme extends RawTheme {
  id: string
  urls: Record<string, string>
  fontsStyles: string
  fontsUrls: string[]
  cacheKey: string
}

export interface BaseSlide {
  layout?: string
  title: string
  notes: string
  code?: {
    content: string
    language?: string
    numbers?: boolean
    highlight?: string
    rendered?: string
  }
  options: Record<string, any>
  classes: Record<string, any>
}

export interface Slide extends BaseSlide {
  [key: string]: any
}

export interface Config {
  theme: string
  urls: Record<string, string>
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
  slides: Slide[]
}

export interface Talk extends RawTalk {
  id: string
  slidesCount: number
  slidesPadding: number
  aspectRatio: number
  images: string[]
  cacheKey: string
}

export interface Pusher {
  key: string
  secret: string
  cluster: string
}

export interface ClientContext {
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
  environment: Context['environment']
  pusher?: Omit<Pusher, 'secret'> & { hostname?: string }
}

export interface Context {
  environment: 'development' | 'production'
  log: pino.BaseLogger
  talks: Set<string>
  slidesets: Record<string, string>
}

export interface SlideProps<T = Slide> {
  environment: Context['environment']
  theme: Theme
  talk: Talk
  slide: T
  index: number
}

export type SlideRenderer<T> = (props: SlideProps<T>) => JSX.Element

declare module 'fastify' {
  interface FastifyInstance {
    rootDir: string
  }
}
