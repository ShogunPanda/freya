import type { BuildContext } from '@perseveranza-pets/dante'
import type { VNode } from 'preact'
import type { Talk, Theme } from './slidesets/models.ts'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { rootDir } from '@perseveranza-pets/dante'
import { render } from 'preact-render-to-string'

export interface PageData {
  // eslint-disable-next-line @stylistic/quote-props
  '404': undefined
  index: { talks: Record<string, Talk>; common: Record<string, object>; script: string }
  assets: { theme: Theme; talk: Talk; commonImages: string[]; themeImages: string[]; talkImages: string[] }
  'speaker-notes': { talk: Talk }
}

export type PageRenderer<Name extends keyof PageData> = (
  context: BuildContext,
  data: PageData[Name]
) => VNode | Promise<VNode>

export async function renderProjectPage<Name extends keyof PageData>(
  name: Name,
  context: BuildContext,
  data: PageData[Name]
): Promise<string> {
  const path = resolve(rootDir, `src/pages/${name}.tsx`)
  if (!existsSync(path)) {
    return '<!doctype html><html><head></head><body></body></html>'
  }

  const { default: renderer } = (await import(pathToFileURL(path).href)) as { default: PageRenderer<Name> }
  if (typeof renderer !== 'function') {
    throw new Error(`src/pages/${name}.tsx must default-export a page renderer`)
  }
  return '<!doctype html>' + render(await renderer(context, data))
}
