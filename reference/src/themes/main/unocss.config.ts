import { type UserConfig } from '@unocss/core'
import { type Theme as UnoTheme } from '@unocss/preset-mini'
import { unocssConfig } from '../../../../dist/rendering/unocss.config.js'

const config: UserConfig<UnoTheme> = { ...unocssConfig }

config.layers!.theme = 30

export default config
