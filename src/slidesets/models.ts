import { type VNode } from 'preact'
import { type Pusher } from '../configuration.js'

export interface FontsList {
  ranges: Record<string, string>
  families: Record<string, Record<string, Record<number, string>>>
}

export type ParsedSVG = [string, string | undefined]

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

export type Document = BaseDocument & Record<string, any>

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

export type Slide = BaseSlide & Record<string, any>

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
}

export interface ClientContext {
  version: string
  id: string
  talk: Talk
  theme: Theme
  assets: {
    content: Record<string, string>
    images: Record<string, string>
    svgs: Record<string, ParsedSVG>
    svgsDefinitions: string[]
  }
  css: {
    keepExpanded: boolean
    classes: Record<string, string[]>
    compressedClasses: Record<string, string>
  }
  dimensions: {
    width: number
    height: number
  }
  isProduction: boolean
  isExporting: boolean
  pusher?: Omit<Pusher, 'secret'> & { hostname?: string }
  data?: Record<string, any>
  serverData?: Record<string, any>
}

export interface SlideProps<T = Slide> {
  slide: T
  index: number
  className?: string
}

export type SlideRenderer<T> = (props: SlideProps<T>) => VNode
