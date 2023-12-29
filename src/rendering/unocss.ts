import { type UserConfig, type Variant, type VariantHandler } from '@unocss/core'
import { type Theme as UnoTheme } from '@unocss/preset-mini'

export function defineUnoConfig<Theme extends object = UnoTheme>(config: UserConfig<Theme>): UserConfig<Theme> {
  return config
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
