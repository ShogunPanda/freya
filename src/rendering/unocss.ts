import { type UserConfig, type Variant, type VariantHandler } from '@unocss/core'
import { type Theme as UnoTheme } from '@unocss/preset-mini'
import { compressCSSClasses } from 'dante/html-utils'

export function defineUnoConfig<Theme extends object = UnoTheme>(config: UserConfig<Theme>): UserConfig<Theme> {
  return config
}

export function compressLayers(layers: Record<string, number>): Map<string, string> {
  const compressedLayers = new Map()

  compressCSSClasses(Object.keys(layers), compressedLayers, new Map(), new Set(), 0, '')

  return compressedLayers
}

export const layersVariant: Variant<UnoTheme> = {
  name: 'talks-layer-matcher',
  match(matcher: string): string | VariantHandler {
    const mo = matcher.match(/^(?<layer>([^@]+))@(?<matcher>.+)$/)

    if (!mo) {
      return matcher
    }

    return {
      matcher: mo.groups!.matcher,
      layer: mo.groups!.layer
    }
  }
}
