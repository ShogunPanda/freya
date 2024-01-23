import { type Fonts } from '@perseveranza-pets/dante'
import { type VNode } from 'preact'
import { type Pusher } from '../configuration.js'

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

export interface CodeDefinition {
  content: string
  language?: string
  numbers?: boolean
  highlight?: string
  rendered?: string
  classes: Record<string, string>
}

export interface BaseSlide {
  layout?: string
  title: string
  notes: string
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
  fonts: Fonts
}

export interface Theme extends RawTheme {
  id: string
  urls: Record<string, string>
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
