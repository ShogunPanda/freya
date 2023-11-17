import { type UserConfig } from '@unocss/core'
import { type Theme as UnoTheme } from '@unocss/preset-mini'

export function defineUnoConfig<Theme extends object = UnoTheme>(config: UserConfig<Theme>): UserConfig<Theme> {
  return config
}

export * from './code.js'
export * from './qr.js'
export * from './svg.js'
