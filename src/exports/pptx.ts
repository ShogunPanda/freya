import type { Command } from 'commander'
import type pino from 'pino'
import type { Page } from 'playwright'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createBuildContext, finalizePageCSS, loadFontsFile, rootDir } from '@perseveranza-pets/dante'
import JSZip from 'jszip'
import { chromium } from 'playwright'
import pptxgen from 'pptxgenjs'
import { js2xml, xml2js, type Element as XmlElement } from 'xml-js'
import { filterWhitelistedTalks, setWhitelistedTalks } from '../configuration.ts'
import { css, cssVisitor } from '../css.ts'
import { getAllTalks, getTalk, getTheme } from '../slidesets/loaders.ts'
import { ExportCache } from './cache.ts'
import { generateAllSlidesets } from './html.ts'

// PptxGenJS has no package module type; TSX can wrap its ESM entry in a second default export.
const PptxGenJS = (typeof pptxgen === 'function' ? pptxgen : pptxgen.default) as typeof pptxgen.default

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface Paint {
  color: string
  alpha: number
}

interface PptxObject extends Box {
  kind: 'text' | 'shape' | 'image'
  name: string
  order: number[]
  opacity: number
  rotation: number
  fill?: Paint
  radius?: number
  data?: string
  preview?: string
  text?: string
  fontFace?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  spacing?: number
  link?: string
  runs?: Pick<PptxObject, 'text' | 'fontFace' | 'fontSize' | 'fill' | 'opacity' | 'underline' | 'strike' | 'spacing'>[]
  lineSpacing?: number
  align?: 'left' | 'right'
}

interface PptxScene {
  objects: PptxObject[]
  warnings: string[]
}

interface EmbeddedFont {
  family: string
  weight: number
  italic: boolean
  typeface: string
  bold: boolean
  alias: string
  url: string
  ttf: Buffer
  eot: Buffer
  panose: string
  glyph: (codepoint: number) => number
}

/** Read complete, static TrueType faces and wrap them in uncompressed EOT for PresentationML. */
function readFont(
  ttf: Buffer,
  family: string,
  weight: number,
  italic: boolean,
  url: string,
  alias: string
): EmbeddedFont {
  if (ttf.length < 12 || ttf.readUInt32BE(0) !== 0x00010000) {
    throw new Error(`PPTX: ${family} ${weight} is not a TrueType font (${url}).`)
  }
  const tables = new Map<string, Buffer>()
  for (let index = 0; index < ttf.readUInt16BE(4); index++) {
    const offset = 12 + index * 16
    const start = ttf.readUInt32BE(offset + 8)
    const length = ttf.readUInt32BE(offset + 12)
    if (start + length > ttf.length) {
      throw new Error(`PPTX: truncated font ${family}.`)
    }
    tables.set(ttf.toString('ascii', offset, offset + 4), ttf.subarray(start, start + length))
  }
  if (tables.has('fvar')) {
    throw new Error(`PPTX: Google Fonts returned a variable font instead of a static ${family} ${weight} face.`)
  }
  const os2 = tables.get('OS/2')
  const head = tables.get('head')
  const names = tables.get('name')
  const cmap = tables.get('cmap')
  if (!os2 || os2.length < 78 || !head || !names || !cmap) {
    throw new Error(`PPTX: incomplete TrueType tables in ${family}.`)
  }
  const permissions = os2.readUInt16BE(8)
  if (permissions & 0x0200 || ((permissions & 0x000e) !== 0 && !(permissions & 0x0008))) {
    throw new Error(`PPTX: ${family} does not permit editable outline embedding.`)
  }
  function name(id: number): string {
    let fallback = ''
    for (let index = 0; index < names!.readUInt16BE(2); index++) {
      const offset = 6 + index * 12
      const platform = names!.readUInt16BE(offset)
      if (names!.readUInt16BE(offset + 6) !== id || ![0, 3].includes(platform)) {
        continue
      }
      const start = names!.readUInt16BE(4) + names!.readUInt16BE(offset + 10)
      const value = Buffer.from(names!.subarray(start, start + names!.readUInt16BE(offset + 8)))
        .swap16()
        .toString('utf16le')
      if (platform === 3 && names!.readUInt16BE(offset + 4) === 0x0409) {
        return value
      }
      fallback ||= value
    }
    return fallback
  }
  const typeface = name(1)
  if (!typeface || os2.readUInt16BE(4) !== weight || Boolean(os2.readUInt16BE(62) & 1) !== italic) {
    throw new Error(`PPTX: downloaded face does not match ${family} ${weight} ${italic ? 'italic' : 'normal'}.`)
  }
  let cmap4: Buffer | undefined
  let cmap12: Buffer | undefined
  for (let index = 0; index < cmap.readUInt16BE(2); index++) {
    const offset = 4 + index * 8
    const platform = cmap.readUInt16BE(offset)
    const encoding = cmap.readUInt16BE(offset + 2)
    if (platform !== 0 && !(platform === 3 && [1, 10].includes(encoding))) {
      continue
    }
    const table = cmap.subarray(cmap.readUInt32BE(offset + 4))
    if (table.readUInt16BE(0) === 12) {
      cmap12 = table
    } else if (table.readUInt16BE(0) === 4) {
      cmap4 = table
    }
  }
  function glyph(codepoint: number): number {
    if (cmap12) {
      let low = 0
      let high = cmap12.readUInt32BE(12) - 1
      while (low <= high) {
        const middle = (low + high) >>> 1
        const offset = 16 + middle * 12
        const start = cmap12.readUInt32BE(offset)
        const end = cmap12.readUInt32BE(offset + 4)
        if (codepoint < start) {
          high = middle - 1
        } else if (codepoint > end) {
          low = middle + 1
        } else {
          return cmap12.readUInt32BE(offset + 8) + codepoint - start
        }
      }
    }
    if (cmap4 && codepoint <= 0xffff) {
      const count = cmap4.readUInt16BE(6) / 2
      for (let index = 0; index < count; index++) {
        if (codepoint > cmap4.readUInt16BE(14 + index * 2)) {
          continue
        }
        if (codepoint < cmap4.readUInt16BE(16 + count * 2 + index * 2)) {
          return 0
        }
        const delta = cmap4.readInt16BE(16 + count * 4 + index * 2)
        const position = 16 + count * 6 + index * 2
        const range = cmap4.readUInt16BE(position)
        if (!range) {
          return (codepoint + delta) & 0xffff
        }
        const address = position + range + 2 * (codepoint - cmap4.readUInt16BE(16 + count * 2 + index * 2))
        const value = cmap4.readUInt16BE(address)
        return value ? (value + delta) & 0xffff : 0
      }
    }
    return 0
  }
  // W3C EOT §3.2: header integers are little-endian; the full SFNT payload stays big-endian.
  // https://www.w3.org/submissions/EOT/ specifies the uncompressed 0x00020001 structure.
  const header = Buffer.alloc(80)
  header.writeUInt32LE(ttf.length, 4)
  header.writeUInt32LE(0x00020001, 8)
  os2.copy(header, 16, 32, 42)
  header[26] = 1
  header[27] = Number(italic)
  header.writeUInt32LE(weight, 28)
  header.writeUInt16LE(permissions, 32)
  header.writeUInt16LE(0x504c, 34)
  for (let index = 0; index < 4; index++) {
    header.writeUInt32LE(os2.readUInt32BE(42 + index * 4), 36 + index * 4)
  }
  if (os2.length >= 86) {
    header.writeUInt32LE(os2.readUInt32BE(78), 52)
    header.writeUInt32LE(os2.readUInt32BE(82), 56)
  }
  header.writeUInt32LE(head.readUInt32BE(8), 60)
  const parts: Buffer[] = [header]
  for (const value of [typeface, name(2), name(5), name(4), '']) {
    const bytes = Buffer.from(value, 'utf16le')
    const prefix = Buffer.alloc(4)
    prefix.writeUInt16LE(bytes.length, 2)
    parts.push(prefix, bytes)
  }
  parts.push(ttf)
  const eot = Buffer.concat(parts)
  eot.writeUInt32LE(eot.length, 0)
  return {
    family,
    weight,
    italic,
    typeface,
    bold: Boolean(os2.readUInt16BE(62) & 32),
    alias,
    url,
    ttf,
    eot,
    panose: os2.subarray(32, 42).toString('hex'),
    glyph
  }
}

async function downloadFont(family: string, weight: number, italic: boolean, alias: string): Promise<EmbeddedFont> {
  // A legacy, non-browser request asks Google for a static TTF, rather than WOFF2 or a variable face.
  // No text parameter: all glyphs in the supplied family/subsets remain available for editing.
  const request = new URL('https://fonts.googleapis.com/css')
  request.searchParams.set('family', `${family}:${weight}${italic ? 'italic' : ''}`)
  request.searchParams.set('subset', 'all')
  const response = await fetch(request, { headers: { 'User-Agent': 'Freya-PPTX' }, signal: AbortSignal.timeout(30000) })
  if (!response.ok) {
    throw new Error(
      `PPTX: Google Fonts cannot supply ${family} ${weight} ${italic ? 'italic' : 'normal'} (${response.status}).`
    )
  }
  const css = await response.text()
  const urls = [...css.matchAll(/url\(([^)]+)\)\s*format\(['"]truetype['"]\)/g)]
  if (urls.length !== 1) {
    throw new Error(`PPTX: expected one complete static TTF for ${family}, received ${urls.length}.`)
  }
  const url = urls[0][1].replaceAll(/['"]/g, '')
  if (new URL(url).hostname !== 'fonts.gstatic.com') {
    throw new Error(`PPTX: unexpected Google Fonts resource ${url}.`)
  }
  const font = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!font.ok) {
    throw new Error(`PPTX: downloading ${family} failed (${font.status}).`)
  }
  return readFont(Buffer.from(await font.arrayBuffer()), family, weight, italic, url, alias)
}

/** Load the very same complete faces into Chromium that will be embedded in the PPTX. */
async function prepareFonts(
  page: Page,
  sources: Record<string, string>,
  fonts: Map<string, EmbeddedFont>,
  downloadedFonts: Map<string, EmbeddedFont>,
  allowAllUnicodes: boolean
): Promise<void> {
  const snapshot = await page.evaluate(() => {
    const root = document.querySelector('.freya\\@slide')!
    const elements = [root, ...Array.from(root.querySelectorAll('*'))]
    return {
      defaultFamily: getComputedStyle(document.documentElement).fontFamily,
      entries: elements.flatMap((element, index) => {
        const style = getComputedStyle(element)
        if (!element.getClientRects().length || element.closest('svg')) {
          return []
        }
        const entries = Array.from(element.childNodes).flatMap((node, child) =>
          node.nodeType === Node.TEXT_NODE && node.textContent && (node.textContent.trim() || element.closest('pre'))
            ? [
                {
                  index,
                  child,
                  text: node.textContent,
                  family: style.fontFamily,
                  weight: Number.parseInt(style.fontWeight),
                  italic: style.fontStyle !== 'normal'
                }
              ]
            : []
        )
        // List markers have no text node, but extractSlide exports them as editable text.
        // Prepare their face even when the <li> contains only nested elements.
        if (element.tagName === 'LI' && style.listStyleType !== 'none') {
          const parent = element.parentElement
          const number = parent
            ? Array.from(parent.children).indexOf(element) + Number(parent.getAttribute('start') ?? 1)
            : 1
          entries.push({
            index,
            child: -1,
            text: style.listStyleType === 'decimal' ? `${number}.` : '•',
            family: style.fontFamily,
            weight: Number.parseInt(style.fontWeight),
            italic: style.fontStyle !== 'normal'
          })
        }
        return entries
      })
    }
  })
  const declared = new Map(Object.keys(sources).map(family => [family.toLowerCase(), family]))
  function choose(stack: string): string | undefined {
    return stack
      .split(',')
      .map(name => declared.get(name.trim().replaceAll(/['"]/g, '').toLowerCase()))
      .find(Boolean)
  }
  const defaultFamily = choose(snapshot.defaultFamily)
  const entries = snapshot.entries.map(entry => {
    let family = choose(entry.family)
    if (!family) {
      if (
        !defaultFamily ||
        !/^(system-ui|sans-serif|serif|-apple-system|BlinkMacSystemFont)(,|$)/i.test(entry.family)
      ) {
        throw new Error(`PPTX: font stack ${entry.family} is not declared in Google Fonts sources.`)
      }
      family = defaultFamily
    }
    return { ...entry, family, key: `${family}/${entry.weight}/${entry.italic}` }
  })
  const missing = [...new Map(entries.filter(entry => !fonts.has(entry.key)).map(entry => [entry.key, entry])).values()]
  const pending = missing.filter(entry => !downloadedFonts.has(entry.key))
  let next = 0
  if (pending.length) {
    // Drain every worker before propagating a failure, leaving no background requests behind.
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (next < pending.length) {
          const entry = pending[next++]
          const font = await downloadFont(entry.family, entry.weight, entry.italic, '')
          downloadedFonts.set(entry.key, font)
        }
      })
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason
      }
    }
  }
  // Assign aliases in document order, independently of download completion order.
  for (const entry of missing) {
    fonts.set(entry.key, { ...downloadedFonts.get(entry.key)!, alias: `FreyaPptx${fonts.size}` })
  }
  const assignments: { index: number; child: number; runs: { text: string; alias: string }[] }[] = []
  const slideFonts = new Set<EmbeddedFont>()
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
  for (const entry of entries) {
    const family = entry.family
    const primary = fonts.get(entry.key)!
    slideFonts.add(primary)
    const runs: { text: string; alias: string }[] = [{ text: '', alias: primary.alias }]
    for (const part of segmenter.segment(entry.text)) {
      let segment = part.segment
      // Preserve formatting controls only within complete Unicode emoji sequences.
      const emoji = /^\p{RGI_Emoji}$/v.test(segment)
      if (!emoji) {
        const invisible = segment.match(/\p{Default_Ignorable_Code_Point}/gu)
        if (invisible && !allowAllUnicodes) {
          const codes = [...new Set(invisible)].map(
            char => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`
          )
          throw new Error(
            `Unexpected invisible Unicode character ${codes.join(', ')} in ${JSON.stringify(entry.text)}; remove it or set options.allowAllUnicodes: true.`
          )
        }
        segment = segment.replaceAll(/\p{Default_Ignorable_Code_Point}/gu, '')
      }
      const codepoints = Array.from(segment, char => char.codePointAt(0)!).filter(
        code => ![9, 10, 13, 0x200d, 0xfe0e, 0xfe0f].includes(code)
      )
      const font = primary
      // Keep Unicode emoji in the theme font's text runs. Chromium and Office choose
      // their platform fallback; embedding an emoji face would override that choice.
      if (!emoji && !allowAllUnicodes && codepoints.some(code => !font.glyph(code))) {
        throw new Error(
          `PPTX: ${family} does not cover ${JSON.stringify(segment)}; declare a Google Fonts family covering these characters.`
        )
      }
      if (runs.at(-1)?.alias === font.alias) {
        runs.at(-1)!.text += segment
      } else {
        runs.push({ text: segment, alias: font.alias })
      }
    }
    assignments.push({ index: entry.index, child: entry.child, runs })
  }
  await page.evaluate(
    async ({ faces, assignments }) => {
      const root = document.querySelector('.freya\\@slide')!
      const elements = [root, ...Array.from(root.querySelectorAll('*'))]
      const nodes = assignments.map(assignment => elements[assignment.index].childNodes[assignment.child])
      for (const face of faces) {
        const font = new FontFace(face.alias, `url(data:font/ttf;base64,${face.data})`, {
          weight: String(face.weight),
          style: face.italic ? 'italic' : 'normal'
        })
        await font.load()
        // The shared Node/browser declarations omit FontFaceSet.add, supported by Chromium.
        const fontSet = document.fonts as FontFaceSet & { add: (font: FontFace) => FontFaceSet }
        fontSet.add(font)
      }
      const stylesheet = document.createElement('style')
      stylesheet.textContent = faces
        .map(face => `[data-pptx-font="${face.alias}"] { font-family: "${face.alias}" !important; }`)
        .join('\n')
      document.head.append(stylesheet)
      for (const [index, assignment] of assignments.entries()) {
        // Keep text within its existing element unless a glyph requires a separate fallback face.
        if (assignment.runs.length === 1) {
          const element = elements[assignment.index] as HTMLElement
          // Do not add a style attribute: themes may use span[style] for syntax highlighting.
          element.setAttribute('data-pptx-font', assignment.runs[0].alias)
          if (nodes[index]) {
            nodes[index].textContent = assignment.runs[0].text
          }
        } else {
          const replacements = assignment.runs.map(run => {
            const span = document.createElement('span')
            span.setAttribute('data-pptx-font', run.alias)
            span.textContent = run.text
            return span
          })
          nodes[index].replaceWith(...replacements)
        }
      }
      await document.fonts.ready
    },
    {
      // Transfer and load only faces used by this slide, not previous slides in the talk.
      faces: Array.from(slideFonts, font => ({
        alias: font.alias,
        weight: font.weight,
        italic: font.italic,
        data: font.ttf.toString('base64')
      })),
      assignments
    }
  )
}

/** Self-contained because Playwright serializes this function into the page. */
async function extractSlide(): Promise<PptxScene> {
  const root = document.querySelector<HTMLElement>('.freya\\@slide')
  if (!root) {
    throw new Error('PPTX: the document has no Freya slide.')
  }
  if (!root.querySelector('[data-pptx]') && !root.hasAttribute('data-pptx')) {
    throw new Error('PPTX: the theme must annotate its slide or elements with data-pptx.')
  }

  // Slide coordinates must not include the interactive viewport's scaling.
  root.style.transform = 'none'
  root.style.transformOrigin = '0 0'
  for (const animation of document.getAnimations()) {
    const end = animation.effect?.getComputedTiming().endTime
    if (typeof end === 'number' && Number.isFinite(end)) {
      animation.currentTime = end
      animation.pause()
    } else {
      animation.cancel()
    }
  }

  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
  const resources: Promise<unknown>[] = []
  const images = new Map<string, HTMLImageElement>()
  function loadImage(url: string): HTMLImageElement {
    const absolute = new URL(url, document.baseURI).href
    let image = images.get(absolute)
    if (!image) {
      image = new Image()
      image.src = absolute
      images.set(absolute, image)
      resources.push(
        image.decode().catch(() => {
          throw new Error(`PPTX: cannot decode image ${absolute}`)
        })
      )
    }
    return image
  }
  function backgroundURLs(style: CSSStyleDeclaration): string[] {
    return Array.from(style.backgroundImage.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g), match => {
      return match[1] ?? match[2] ?? match[3].trim()
    })
  }
  document.fonts.forEach(font => {
    resources.push(font.load())
  })
  for (const element of elements) {
    if (element instanceof HTMLImageElement && (element.currentSrc || element.src)) {
      element.loading = 'eager'
      loadImage(element.currentSrc || element.src)
    }
    for (const url of backgroundURLs(getComputedStyle(element))) {
      loadImage(url)
    }
  }
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.all(resources),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('PPTX: fonts or images did not load within 30 seconds.')), 30000)
      })
    ])
    await document.fonts.ready
  } finally {
    clearTimeout(timeout)
  }

  const origin = root.getBoundingClientRect()
  const objects: PptxObject[] = []
  const warnings = new Set<string>()
  const indexes = new Map(elements.map((element, index) => [element as Element, index]))
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = colorCanvas.height = 1
  const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true })!

  function label(element: Element): string {
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${Array.from(element.classList)
      .map(name => `.${name}`)
      .join('')}`
  }
  function warn(element: Element, message: string): void {
    warnings.add(`${label(element)}: ${message}`)
  }
  function paint(value: string): Paint {
    colorContext.clearRect(0, 0, 1, 1)
    colorContext.fillStyle = value
    colorContext.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = colorContext.getImageData(0, 0, 1, 1).data
    return { color: [r, g, b].map(component => component.toString(16).padStart(2, '0')).join(''), alpha: a / 255 }
  }
  function box(rect: DOMRect): Box {
    return { x: rect.x - origin.x, y: rect.y - origin.y, w: rect.width, h: rect.height }
  }
  function intersection(a: Box, b: Box): Box {
    const x = Math.max(a.x, b.x)
    const y = Math.max(a.y, b.y)
    return {
      x,
      y,
      w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x),
      h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y)
    }
  }
  function clipBox(element: Element): Box {
    let clip: Box = { x: 0, y: 0, w: origin.width, h: origin.height }
    for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      const bounds = box(parent.getBoundingClientRect())
      if (style.overflowX !== 'visible') {
        clip = intersection(clip, { x: bounds.x, y: clip.y, w: bounds.w, h: clip.h })
      }
      if (style.overflowY !== 'visible') {
        clip = intersection(clip, { x: clip.x, y: bounds.y, w: clip.w, h: bounds.h })
      }
    }
    return clip
  }
  function opacity(element: Element): number {
    let value = 1
    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
      value *= Number(getComputedStyle(parent).opacity)
      if (parent === root) {
        break
      }
    }
    return value
  }
  function order(element: Element, layer: number): number[] {
    const ancestors: Element[] = []
    for (let parent: Element | null = element; parent && parent !== root; parent = parent.parentElement) {
      ancestors.unshift(parent)
    }
    const result: number[] = []
    for (const ancestor of ancestors) {
      const style = getComputedStyle(ancestor)
      const stacking =
        style.zIndex !== 'auto' ||
        style.transform !== 'none' ||
        Number(style.opacity) < 1 ||
        style.isolation === 'isolate'
      if (stacking) {
        result.push(Number.parseInt(style.zIndex) || 0, indexes.get(ancestor) ?? 0)
      }
    }
    // A stacking context paints its own background before its negative-z children.
    result.push(element === root || (ancestors.at(-1) === element && result.length > 0 && layer < 0) ? -1000000 : 0)
    result.push(indexes.get(element) ?? 0, layer)
    return result
  }
  function base(element: Element, bounds: Box, layer: number): Omit<PptxObject, 'kind'> {
    return {
      ...bounds,
      name: label(element),
      order: order(element, layer),
      opacity: opacity(element),
      rotation: 0,
      link: element.closest('a')?.href
    }
  }

  function addShape(element: Element, bounds: Box, fill: Paint, radius: number = 0, layer: number = -2): void {
    if (!fill.alpha || bounds.w <= 0 || bounds.h <= 0) {
      return
    }
    const clipped = intersection(bounds, clipBox(element))
    if (!clipped.w || !clipped.h) {
      return
    }
    objects.push({ ...base(element, clipped, layer), kind: 'shape', fill, radius })
  }

  function redundantCodeBackground(element: Element, bounds: Box, fill: Paint): boolean {
    const pre = element.closest('pre.freya\\@code, pre[data-pptx="code"]')
    if (!pre || pre === element || fill.alpha !== 1) {
      return false
    }
    // An opaque fill over the same opaque ancestor color changes no pixels, even
    // when a code line is dimmed. Stop at a different fill or an image backdrop.
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      if (style.backgroundImage !== 'none' || style.mixBlendMode !== 'normal' || style.filter !== 'none') {
        return false
      }
      const background = paint(style.backgroundColor)
      if (background.alpha) {
        const rect = box(parent.getBoundingClientRect())
        const inset = Math.max(
          ...[
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomLeftRadius,
            style.borderBottomRightRadius
          ].map(value => Number.parseFloat(value) || 0)
        )
        const inside =
          bounds.x >= rect.x - 0.01 &&
          bounds.y >= rect.y - 0.01 &&
          bounds.x + bounds.w <= rect.x + rect.w + 0.01 &&
          bounds.y + bounds.h <= rect.y + rect.h + 0.01
        // Either central band is fully covered, including full-width lines below the rounded corners.
        const awayFromCorners =
          (bounds.x >= rect.x + inset && bounds.x + bounds.w <= rect.x + rect.w - inset) ||
          (bounds.y >= rect.y + inset && bounds.y + bounds.h <= rect.y + rect.h - inset)
        return background.alpha === 1 && background.color === fill.color && inside && awayFromCorners
      }
      if (parent === pre) {
        break
      }
    }
    return false
  }

  async function addRaster(element: Element, image: HTMLImageElement, bounds: Box, target: Box): Promise<void> {
    const visible = intersection(intersection(bounds, target), clipBox(element))
    if (!visible.w || !visible.h || !target.w || !target.h) {
      return
    }
    // Rasterize only the source image's crop, never text or surrounding slide content.
    const sx = ((visible.x - target.x) * image.naturalWidth) / target.w
    const sy = ((visible.y - target.y) * image.naturalHeight) / target.h
    const sw = (visible.w * image.naturalWidth) / target.w
    const sh = (visible.h * image.naturalHeight) / target.h
    const scale = Math.min(1, 4096 / Math.max(sw, sh))
    const sourceURL = new URL(image.src)
    const originalFormat = /\.(png|jpe?g)$/i.test(sourceURL.pathname) || /^data:image\/(png|jpeg)[;,]/i.test(image.src)
    // CSS scaling is represented by the PowerPoint bounds; only pixel crops/resampling need a canvas.
    if (
      originalFormat &&
      sx === 0 &&
      sy === 0 &&
      sw === image.naturalWidth &&
      sh === image.naturalHeight &&
      scale === 1
    ) {
      const data = await new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('GET', image.src)
        request.responseType = 'blob'
        request.timeout = 30000
        request.onload = () => {
          if (request.status !== 0 && (request.status < 200 || request.status >= 300)) {
            reject(new Error(`PPTX: cannot read image ${image.src} (${request.status}).`))
            return
          }
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error(`PPTX: cannot encode image ${image.src}.`))
          reader.readAsDataURL(request.response)
        }
        request.onerror = request.ontimeout = () => reject(new Error(`PPTX: cannot read image ${image.src}.`))
        request.send()
      })
      objects.push({ ...base(element, visible, -1), kind: 'image', data })
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw * scale))
    canvas.height = Math.max(1, Math.round(sh * scale))
    canvas.getContext('2d')!.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL('image/png')
    objects.push({ ...base(element, visible, -1), kind: 'image', data })
  }

  async function svgPreview(data: string, width: number, height: number): Promise<string> {
    const image = new Image()
    image.src = data
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(image, 0, 0, width, height)
    const preview = canvas.toDataURL('image/png')
    return preview
  }

  async function addImage(element: Element, image: HTMLImageElement, bounds: Box, target: Box): Promise<void> {
    const url = new URL(image.src)
    if (!/\.svg$/i.test(url.pathname) && !/^data:image\/svg\+xml[;,]/i.test(image.src)) {
      await addRaster(element, image, bounds, target)
      return
    }
    const visible = intersection(intersection(bounds, target), clipBox(element))
    if (!visible.w || !visible.h || !target.w || !target.h) {
      return
    }
    // XMLHttpRequest also reads local file URLs in the export browser; fetch does not.
    const source = await new Promise<string>((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('GET', image.src)
      request.timeout = 30000
      request.onload = () => {
        if (request.status === 0 || (request.status >= 200 && request.status < 300)) {
          resolve(request.responseText)
        } else {
          reject(new Error(`PPTX: cannot read SVG ${image.src} (${request.status}).`))
        }
      }
      request.onerror = request.ontimeout = () => reject(new Error(`PPTX: cannot read SVG ${image.src}.`))
      request.send()
    })
    const document = new DOMParser().parseFromString(source, 'image/svg+xml')
    const svg = document.documentElement
    if (svg.localName !== 'svg' || document.querySelector('parsererror')) {
      throw new Error(`PPTX: invalid SVG image ${image.src}.`)
    }
    // A nested viewport reproduces CSS positioning and clipping without rasterizing paths.
    // Sources with only intrinsic dimensions need a viewBox to scale with their CSS size.
    if (!svg.hasAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${image.naturalWidth} ${image.naturalHeight}`)
    }
    svg.setAttribute('x', String(target.x - visible.x))
    svg.setAttribute('y', String(target.y - visible.y))
    svg.setAttribute('width', String(target.w))
    svg.setAttribute('height', String(target.h))
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('width', String(visible.w))
    wrapper.setAttribute('height', String(visible.h))
    wrapper.setAttribute('viewBox', `0 0 ${visible.w} ${visible.h}`)
    wrapper.setAttribute('overflow', 'hidden')
    wrapper.append(svg)
    const data = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(wrapper))))}`
    const scale = Math.min(2, 4096 / Math.max(visible.w, visible.h))
    const preview = await svgPreview(
      data,
      Math.max(1, Math.ceil(visible.w * scale)),
      Math.max(1, Math.ceil(visible.h * scale))
    )
    objects.push({ ...base(element, visible, -1), kind: 'image', data, preview })
  }

  function imageTarget(element: Element, image: HTMLImageElement, bounds: Box, size: string, position: string): Box {
    let w = image.naturalWidth
    let h = image.naturalHeight
    if (['cover', 'contain', 'scale-down'].includes(size)) {
      const ratio =
        size === 'cover'
          ? Math.max(bounds.w / w, bounds.h / h)
          : Math.min(bounds.w / w, bounds.h / h, size === 'scale-down' ? 1 : Infinity)
      w *= ratio
      h *= ratio
    } else if (size === 'fill') {
      w = bounds.w
      h = bounds.h
    } else if (size !== 'none') {
      const sizes = size.split(/\s+/)
      const width = sizes[0]
      const height = sizes[1] ?? 'auto'
      if (width !== 'auto') {
        w = width.endsWith('%') ? (bounds.w * Number.parseFloat(width)) / 100 : Number.parseFloat(width)
      }
      if (height !== 'auto') {
        h = height.endsWith('%') ? (bounds.h * Number.parseFloat(height)) / 100 : Number.parseFloat(height)
      } else if (width !== 'auto') {
        h = (w * image.naturalHeight) / image.naturalWidth
      }
      if (width === 'auto' && height !== 'auto') {
        w = (h * image.naturalWidth) / image.naturalHeight
      }
    }
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      warn(element, `unsupported image size ${size}; using intrinsic size`)
      w = image.naturalWidth
      h = image.naturalHeight
    }
    const positions = position.split(/\s+/)
    if (positions.length > 2) {
      warn(element, `four-value image position ${position} is not supported`)
    }
    function offset(value: string, available: number): number {
      if (value === 'center') {
        return available / 2
      }
      if (value === 'right' || value === 'bottom') {
        return available
      }
      return value.endsWith('%') ? (available * Number.parseFloat(value)) / 100 : Number.parseFloat(value) || 0
    }
    return {
      x: bounds.x + offset(positions[0], bounds.w - w),
      y: bounds.y + offset(positions[1] ?? '50%', bounds.h - h),
      w,
      h
    }
  }

  function serializeSVG(element: SVGSVGElement): string {
    const clone = element.cloneNode(true) as SVGSVGElement
    // Expanding <use> inside a sibling clone preserves instance-specific CSS inheritance.
    let expansions = 0
    for (let use = clone.querySelector('use'); use; use = clone.querySelector('use')) {
      if (++expansions > 1000) {
        throw new Error('PPTX: recursive SVG references.')
      }
      const href = use.getAttribute('href') ?? use.getAttribute('xlink:href') ?? ''
      const source = href.startsWith('#')
        ? (clone.querySelector(`[id="${CSS.escape(href.slice(1))}"]`) ?? document.getElementById(href.slice(1)))
        : null
      if (!source) {
        warn(element, `unresolved SVG reference ${href}`)
        use.remove()
        continue
      }
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      for (const attribute of Array.from(use.attributes)) {
        if (!['href', 'xlink:href', 'x', 'y'].includes(attribute.name)) {
          group.setAttribute(attribute.name, attribute.value)
        }
      }
      if (use.hasAttribute('x') || use.hasAttribute('y')) {
        group.setAttribute(
          'transform',
          `translate(${use.getAttribute('x') ?? 0} ${use.getAttribute('y') ?? 0}) ${use.getAttribute('transform') ?? ''}`
        )
      }
      // A reference can target a leaf (<image>, <path>), not only an SVG container.
      if (['svg', 'symbol'].includes(source.localName)) {
        group.append(...Array.from(source.childNodes, node => node.cloneNode(true)))
      } else {
        group.append(source.cloneNode(true))
      }
      use.replaceWith(group)
    }
    clone.style.position = 'absolute'
    clone.style.pointerEvents = 'none'
    element.after(clone)
    try {
      const nodes = [clone, ...Array.from(clone.querySelectorAll<SVGElement>('*'))]
      const declarations = nodes.map(node => {
        const style = getComputedStyle(node)
        return [
          'fill',
          'stroke',
          'stroke-width',
          'fill-rule',
          'fill-opacity',
          'stroke-opacity',
          'stroke-linecap',
          'stroke-linejoin',
          'opacity',
          'color'
        ].map(property => [property, style.getPropertyValue(property)])
      })
      for (const [index, node] of nodes.entries()) {
        node.removeAttribute('style')
        node.removeAttribute('class')
        for (const [property, value] of declarations[index]) {
          node.style.setProperty(property, value)
        }
      }
      // Root opacity and rotation are applied to the PowerPoint object exactly once.
      clone.style.opacity = '1'
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const bounds = element.getBoundingClientRect()
      clone.setAttribute('width', String(bounds.width))
      clone.setAttribute('height', String(bounds.height))
      return new XMLSerializer().serializeToString(clone)
    } finally {
      clone.remove()
    }
  }

  function addText(element: Element, node: Text): void {
    const style = getComputedStyle(element)
    const pre = ['pre', 'pre-wrap', 'break-spaces'].includes(style.whiteSpace)
    const range = document.createRange()
    let fragment = ''
    let bounds: Box | undefined
    function flush(): void {
      if (!bounds || !fragment.trim()) {
        fragment = ''
        bounds = undefined
        return
      }
      const clipped = intersection(bounds, clipBox(element))
      if (clipped.w && clipped.h) {
        if (clipped.w < bounds.w - 1 || clipped.h < bounds.h - 1) {
          warn(element, 'partially clipped editable text is retained; internal text clipping is not reproduced')
        }
        const weight = Number.parseInt(style.fontWeight)
        let decoration = style.textDecorationLine
        for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) {
          decoration += ` ${getComputedStyle(parent).textDecorationLine}`
        }
        let text = fragment
        if (style.textTransform === 'uppercase') {
          text = text.toLocaleUpperCase(document.documentElement.lang || 'en')
        } else if (style.textTransform === 'lowercase') {
          text = text.toLocaleLowerCase(document.documentElement.lang || 'en')
        } else if (style.textTransform !== 'none') {
          warn(element, `text-transform ${style.textTransform} is not supported`)
        }
        objects.push({
          ...base(element, bounds, 1),
          kind: 'text',
          text,
          fill: paint(style.color),
          fontFace: style.fontFamily.split(',')[0].trim().replaceAll(/['"]/g, ''),
          fontSize: Number.parseFloat(style.fontSize),
          bold: weight >= 600,
          italic: style.fontStyle !== 'normal',
          underline: decoration.includes('underline'),
          strike: decoration.includes('line-through'),
          spacing: Number.parseFloat(style.letterSpacing) || 0,
          link: element.closest('a')?.href
        })
      }
      fragment = ''
      bounds = undefined
    }
    // Browser-measured line fragments retain wrapping without rasterizing editable text.
    // Justified paragraphs split at words because their space expansion is browser-specific.
    // Measure whole graphemes so ZWJ emoji, flags and combining marks cannot be split across objects.
    const segmenter = new Intl.Segmenter(document.documentElement.lang || 'en', { granularity: 'grapheme' })
    for (const { segment: character, index: start } of segmenter.segment(node.data)) {
      range.setStart(node, start)
      range.setEnd(node, start + character.length)
      const rect = range.getBoundingClientRect()
      if (!rect.width || !rect.height || (character === '\n' && pre)) {
        if (character === '\n' && pre) {
          flush()
        }
        continue
      }
      const next = box(rect)
      if (bounds && (Math.abs(next.y - bounds.y) > 1 || next.x < bounds.x - 1)) {
        flush()
      }
      if (style.textAlign === 'justify' && /\s/.test(character)) {
        flush()
        continue
      }
      fragment += pre || !/\s/.test(character) ? character : ' '
      bounds = bounds
        ? { x: bounds.x, y: bounds.y, w: next.x + next.w - bounds.x, h: Math.max(bounds.h, next.h) }
        : next
    }
    flush()
  }

  for (const element of elements) {
    const annotation = element.closest('[data-pptx]')
    if (
      !annotation ||
      element.closest('[data-pptx="ignore"]') ||
      (element.closest('svg') && !(element instanceof SVGSVGElement))
    ) {
      continue
    }
    const mode = annotation.getAttribute('data-pptx')!
    if (!['group', 'text', 'image', 'shape', 'svg', 'code'].includes(mode)) {
      throw new Error(`PPTX: unknown data-pptx="${mode}" on ${label(annotation)}`)
    }
    const style = getComputedStyle(element)
    const bounds = box(element.getBoundingClientRect())
    if (style.display === 'none' || style.visibility !== 'visible' || !opacity(element) || !bounds.w || !bounds.h) {
      continue
    }
    for (const property of ['filter', 'backdrop-filter', 'clip-path', 'mask-image', 'box-shadow', 'text-shadow']) {
      const value = style.getPropertyValue(property)
      if (value && value !== 'none') {
        warn(element, `${property}: ${value} is not supported`)
      }
    }
    if (style.mixBlendMode !== 'normal') {
      warn(element, `mix-blend-mode ${style.mixBlendMode} is not supported`)
    }
    if (Number(style.opacity) < 1 && element.children.length) {
      warn(element, 'group opacity is applied per object; overlapping children may composite differently')
    }
    for (const pseudo of ['::before', '::after']) {
      const content = getComputedStyle(element, pseudo).content
      if (content && !['none', 'normal', '""'].includes(content)) {
        warn(element, `${pseudo} generated content is not exported`)
      }
    }
    const rotation =
      style.transform === 'none'
        ? 0
        : (Math.atan2(new DOMMatrix(style.transform).b, new DOMMatrix(style.transform).a) * 180) / Math.PI
    if (style.transform !== 'none' && !(element instanceof SVGSVGElement)) {
      warn(element, 'CSS transform is only supported natively on SVG objects')
    }
    const fill = paint(style.backgroundColor)
    const radius = Number.parseFloat(style.borderTopLeftRadius) || 0
    for (const rect of Array.from(element.getClientRects())) {
      const bounds = box(rect)
      if (!redundantCodeBackground(element, bounds, fill)) {
        addShape(element, bounds, fill, radius)
      }
    }
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      const width = Number.parseFloat(style[`border${side}Width`])
      const borderStyle = style[`border${side}Style`]
      if (width > 0 && borderStyle !== 'none') {
        if (borderStyle !== 'solid') {
          warn(element, `border style ${borderStyle} is approximated as solid`)
        }
        const border = { ...bounds }
        if (side === 'Top' || side === 'Bottom') {
          border.h = width
          border.y += side === 'Bottom' ? bounds.h - width : 0
        } else {
          border.w = width
          border.x += side === 'Right' ? bounds.w - width : 0
        }
        addShape(element, border, paint(style[`border${side}Color`]), 0, 0)
      }
    }
    const backgrounds = backgroundURLs(style)
    if (style.backgroundImage.includes('gradient(') || backgrounds.length > 1) {
      warn(element, 'gradients and multiple background layers are not supported')
    }
    if (backgrounds.length === 1) {
      const image = images.get(new URL(backgrounds[0], document.baseURI).href)!
      if (style.backgroundRepeat !== 'no-repeat') {
        warn(element, 'background repetition is not supported')
      }
      await addImage(
        element,
        image,
        bounds,
        imageTarget(element, image, bounds, style.backgroundSize, style.backgroundPosition)
      )
    }
    if (element instanceof HTMLImageElement) {
      const image = images.get(new URL(element.currentSrc || element.src, document.baseURI).href)!
      await addImage(element, image, bounds, imageTarget(element, image, bounds, style.objectFit, style.objectPosition))
    } else if (element instanceof SVGSVGElement) {
      const contentBox = { ...bounds }
      const left = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth)
      const top = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth)
      contentBox.x += left
      contentBox.y += top
      contentBox.w -= left + Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderRightWidth)
      contentBox.h -= top + Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth)
      const svg = serializeSVG(element)
      const data = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
      const preview = await svgPreview(
        data,
        Math.max(1, Math.ceil(contentBox.w * 2)),
        Math.max(1, Math.ceil(contentBox.h * 2))
      )
      objects.push({
        ...base(element, contentBox, 0),
        kind: 'image',
        rotation,
        data,
        preview
      })
    } else if (['CANVAS', 'VIDEO', 'IFRAME'].includes(element.tagName)) {
      warn(element, `${element.tagName.toLowerCase()} is not exported`)
    } else {
      if (element.tagName === 'LI' && style.listStyleType !== 'none') {
        const parent = element.parentElement
        const number = parent
          ? Array.from(parent.children).indexOf(element) + Number(parent.getAttribute('start') ?? 1)
          : 1
        const text = style.listStyleType === 'decimal' ? `${number}.` : '•'
        if (!['decimal', 'disc'].includes(style.listStyleType)) {
          warn(element, `list marker ${style.listStyleType} is approximated as a bullet`)
        }
        const fontSize = Number.parseFloat(style.fontSize)
        objects.push({
          ...base(element, { x: bounds.x - fontSize, y: bounds.y, w: fontSize, h: fontSize * 1.4 }, 1),
          kind: 'text',
          text,
          fontFace: style.fontFamily.split(',')[0].replaceAll(/['"]/g, ''),
          fontSize,
          fill: paint(style.color)
        })
      }
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          addText(element, child as Text)
        }
      }
    }
  }
  // Uniform, unwrapped code can be edited as one rich-text block, including dimmed/highlighted lines.
  for (const pre of elements.filter(element => element.matches('pre.freya\\@code, pre[data-pptx="code"]'))) {
    const lines = Array.from(pre.children).filter(element => element.classList.contains('line'))
    if (!lines.length || pre.closest('[data-pptx="ignore"]')) {
      continue
    }
    const members = new Set([pre, ...Array.from(pre.querySelectorAll('*'))].map(element => indexes.get(element)))
    const existing = objects.filter(object => object.kind === 'text' && members.has(object.order.at(-2)))
    if (!existing.length) {
      continue
    }
    const style = getComputedStyle(pre)
    const fontSize = Number.parseFloat(getComputedStyle(lines[0]).fontSize)
    const lineSpacing =
      lines.length > 1
        ? lines[1].getBoundingClientRect().top - lines[0].getBoundingClientRect().top
        : Number.parseFloat(style.lineHeight)
    const prepared: PptxObject[] = []
    let supported = lineSpacing > 0 && ['pre', 'nowrap'].includes(style.whiteSpace) && !pre.textContent?.includes('\t')
    for (const numbers of [false, true]) {
      const runs: NonNullable<PptxObject['runs']> = []
      const rectangles: Box[] = []
      let firstLineTop: number | undefined
      for (const [lineIndex, line] of lines.entries()) {
        if (
          Math.abs(line.getBoundingClientRect().top - lines[0].getBoundingClientRect().top - lineIndex * lineSpacing) >
          1
        ) {
          supported = false
        }
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement!
          if (Boolean(parent.closest('.line-number')) !== numbers || !node.textContent) {
            continue
          }
          const computed = getComputedStyle(parent)
          if (
            Number.parseFloat(computed.fontSize) !== fontSize ||
            computed.transform !== 'none' ||
            computed.verticalAlign !== 'baseline'
          ) {
            supported = false
          }
          const range = document.createRange()
          range.selectNodeContents(node)
          const rect = box(range.getBoundingClientRect())
          if (rect.w && rect.h) {
            rectangles.push(rect)
            firstLineTop ??= rect.y - lineIndex * lineSpacing
          }
          runs.push({
            text: node.textContent,
            fontFace: computed.fontFamily.split(',')[0].trim().replaceAll(/['"]/g, ''),
            fontSize,
            fill: paint(computed.color),
            opacity: opacity(parent),
            underline: computed.textDecorationLine.includes('underline'),
            strike: computed.textDecorationLine.includes('line-through'),
            spacing: Number.parseFloat(computed.letterSpacing) || 0
          })
        }
        if (lineIndex < lines.length - 1) {
          runs.push({ ...(runs.at(-1) ?? existing[0]), text: '\n' })
        }
      }
      if (!rectangles.length) {
        continue
      }
      const left = Math.min(...rectangles.map(rect => rect.x))
      const right = Math.max(...rectangles.map(rect => rect.x + rect.w))
      const height = Math.max(...rectangles.map(rect => rect.h)) + (lines.length - 1) * lineSpacing
      const bounds = { x: left, y: firstLineTop!, w: right - left + (numbers ? 0 : fontSize), h: height }
      const clip = intersection(bounds, clipBox(pre))
      if (clip.w < right - left - 1 || clip.h < bounds.h - 1) {
        supported = false
      }
      prepared.push({
        ...base(pre, bounds, 1),
        // Paint the combined text after descendant token backgrounds, as the original text was.
        order: [...order(pre, 1).slice(0, -2), Math.max(...Array.from(members, index => index ?? 0)) + 1, 1],
        kind: 'text',
        name: `${label(pre)}:${numbers ? 'line-numbers' : 'code'}`,
        fontFace: runs[0].fontFace,
        fontSize,
        runs,
        lineSpacing,
        align: numbers ? 'right' : 'left'
      })
    }
    if (!supported) {
      warn(pre, 'code block retains measured fragments because its wrapping, spacing or geometry is not uniform')
      continue
    }
    for (let index = objects.length - 1; index >= 0; index--) {
      if (existing.includes(objects[index])) {
        objects.splice(index, 1)
      }
    }
    objects.push(...prepared)
  }
  objects.sort((a, b) => {
    for (let i = 0; i < Math.max(a.order.length, b.order.length); i++) {
      const difference = (a.order[i] ?? 0) - (b.order[i] ?? 0)
      if (difference) {
        return difference
      }
    }
    return 0
  })
  return { objects, warnings: Array.from(warnings) }
}

/** Supply real SVG previews and keep clickable text independent of Office hyperlink theme styles. */
async function finalizePptx(
  data: ArrayBuffer | Blob | Uint8Array | string,
  previews: Map<string, string>,
  fonts: EmbeddedFont[]
): Promise<Buffer> {
  const archive = await JSZip.loadAsync(data)
  function child(node: XmlElement, name: string): XmlElement | undefined {
    return node.elements?.find(element => element.name === name)
  }
  function descendants(node: XmlElement, name: string): XmlElement[] {
    const matches: XmlElement[] = []
    for (const element of node.elements ?? []) {
      if (element.name === name) {
        matches.push(element)
      }
      matches.push(...descendants(element, name))
    }
    return matches
  }
  for (const name of Object.keys(archive.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
    // Whitespace-only rich text runs contain code indentation and must survive XML rewriting.
    const document = xml2js(await archive.file(name)!.async('string'), {
      captureSpacesBetweenElements: true
    }) as XmlElement
    for (const paragraph of descendants(document, 'a:p')) {
      // PptxGenJS repeats paragraph properties for each rich-text run; DrawingML allows only one.
      const properties = child(paragraph, 'a:pPr')
      paragraph.elements = paragraph.elements?.filter(element => element.name !== 'a:pPr' || element === properties)
    }
    const relsName = posix.join(posix.dirname(name), '_rels', `${posix.basename(name)}.rels`)
    const rels = xml2js(await archive.file(relsName)!.async('string')) as XmlElement
    const targets = new Map(
      descendants(rels, 'Relationship').map(relation => [
        String(relation.attributes!.Id),
        posix.normalize(posix.join(posix.dirname(name), String(relation.attributes!.Target)))
      ])
    )
    for (const picture of descendants(document, 'p:pic')) {
      const blip = descendants(picture, 'a:blip')[0]
      const svg = descendants(picture, 'asvg:svgBlip')[0]
      if (!blip || !svg) {
        continue
      }
      const svgPath = targets.get(String(svg.attributes!['r:embed']))!
      const pngPath = targets.get(String(blip.attributes!['r:embed']))!
      const svgData = await archive.file(svgPath)!.async('base64')
      const preview = previews.get(svgData)
      if (!preview) {
        throw new Error(`PPTX: missing SVG preview for ${svgPath}`)
      }
      // PptxGenJS cannot render SVG previews in Node; preserve both image relationships.
      archive.file(pngPath, Buffer.from(preview.split(',')[1], 'base64'))
    }
    for (const shape of descendants(document, 'p:sp')) {
      const properties = child(child(shape, 'p:nvSpPr') ?? {}, 'p:cNvPr')
      if (!properties) {
        continue
      }
      for (const run of [...descendants(shape, 'a:rPr'), ...descendants(shape, 'a:defRPr')]) {
        const link = child(run, 'a:hlinkClick')
        if (!link) {
          continue
        }
        // Each exported text fragment has one URL. A shape-level link leaves its CSS
        // color/decoration intact even in viewers that ignore Office's hlinkClr extension.
        if (!child(properties, 'a:hlinkClick')) {
          properties.elements ??= []
          properties.elements.unshift({ type: 'element', name: 'a:hlinkClick', attributes: link.attributes })
        }
        run.elements = run.elements!.filter(element => element !== link)
      }
    }
    archive.file(name, js2xml(document))
  }
  const presentation = xml2js(await archive.file('ppt/presentation.xml')!.async('string')) as XmlElement
  const root = child(presentation, 'p:presentation')!
  root.attributes = { ...root.attributes, embedTrueTypeFonts: '1', saveSubsetFonts: '0' }
  const relationships = xml2js(await archive.file('ppt/_rels/presentation.xml.rels')!.async('string')) as XmlElement
  const rels = child(relationships, 'Relationships')!
  const types = xml2js(await archive.file('[Content_Types].xml')!.async('string')) as XmlElement
  const contentTypes = child(types, 'Types')!
  let nextID =
    Math.max(
      0,
      ...descendants(relationships, 'Relationship').map(
        rel => Number(String(rel.attributes?.Id).replace('rId', '')) || 0
      )
    ) + 1
  const families = new Map<string, XmlElement>()
  const slots = new Set<string>()
  for (const [index, font] of fonts.entries()) {
    const slot = font.italic ? (font.bold ? 'boldItalic' : 'italic') : font.bold ? 'bold' : 'regular'
    const key = `${font.typeface}/${slot}`
    if (slots.has(key)) {
      throw new Error(`PPTX: conflicting embedded font faces for ${key}.`)
    }
    slots.add(key)
    let entry = families.get(font.typeface)
    if (!entry) {
      entry = {
        type: 'element',
        name: 'p:embeddedFont',
        elements: [
          {
            type: 'element',
            name: 'p:font',
            attributes: { typeface: font.typeface, panose: font.panose, charset: '1' }
          }
        ]
      }
      families.set(font.typeface, entry)
    }
    const rid = `rId${nextID++}`
    const target = `fonts/font${index + 1}.fntdata`
    archive.file(`ppt/${target}`, font.eot)
    rels.elements!.push({
      type: 'element',
      name: 'Relationship',
      attributes: {
        Id: rid,
        Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font',
        Target: target
      }
    })
    contentTypes.elements!.push({
      type: 'element',
      name: 'Override',
      attributes: { PartName: `/ppt/${target}`, ContentType: 'application/x-fontdata' }
    })
    entry.elements!.push({ type: 'element', name: `p:${slot}`, attributes: { 'r:id': rid } })
  }
  const slotOrder = ['p:font', 'p:regular', 'p:bold', 'p:italic', 'p:boldItalic']
  for (const family of families.values()) {
    family.elements!.sort((a, b) => slotOrder.indexOf(a.name!) - slotOrder.indexOf(b.name!))
  }
  // CT_Presentation places embeddedFontLst after notesSz/smartTags and before custom shows/default text styles.
  const children = root.elements!
  const afterFonts = [
    'p:custShowLst',
    'p:photoAlbum',
    'p:custDataLst',
    'p:kinsoku',
    'p:defaultTextStyle',
    'p:modifyVerifier',
    'p:extLst'
  ]
  const position = children.findIndex(node => afterFonts.includes(node.name!))
  children.splice(position < 0 ? children.length : position, 0, {
    type: 'element',
    name: 'p:embeddedFontLst',
    elements: Array.from(families.values())
  })
  archive.file('ppt/presentation.xml', js2xml(presentation))
  archive.file('ppt/_rels/presentation.xml.rels', js2xml(relationships))
  archive.file('[Content_Types].xml', js2xml(types))
  const properties = xml2js(await archive.file('docProps/app.xml')!.async('string')) as XmlElement
  const headings = child(descendants(properties, 'HeadingPairs')[0], 'vt:vector')!
  const titles = child(descendants(properties, 'TitlesOfParts')[0], 'vt:vector')!
  const variants = headings.elements!.filter(element => element.name === 'vt:variant')
  const parts = titles.elements!.filter(element => element.name === 'vt:lpstr')
  let partOffset = 0
  for (let index = 0; index < variants.length; index += 2) {
    const heading = child(variants[index], 'vt:lpstr')?.elements?.[0].text
    const count = child(variants[index + 1], 'vt:i4')!
    const previous = Number(count.elements![0].text)
    if (heading === 'Fonts Used') {
      const names: XmlElement[] = Array.from(families.keys(), typeface => ({
        type: 'element',
        name: 'vt:lpstr',
        elements: [{ type: 'text', text: typeface }]
      }))
      parts.splice(partOffset, previous, ...names)
      count.elements = [{ type: 'text', text: String(names.length) }]
      break
    }
    partOffset += previous
  }
  titles.elements = parts
  titles.attributes!.size = String(parts.length)
  archive.file('docProps/app.xml', js2xml(properties))
  // Raster images already have their own compression; ZIP deflation mostly adds CPU cost.
  for (const file of Object.values(archive.files)) {
    if (/\.(png|jpe?g|gif|webp)$/i.test(file.name)) {
      file.options.compression = 'STORE'
    }
  }
  return archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/** All PPTX-specific orchestration stays here; HTML/PDF exports own their output directories. */
export async function exportPptx(command: Command, logger: pino.Logger, destination?: string): Promise<string[]> {
  const { directory, only, concurrency = 4, force = false } = command.optsWithGlobals()
  const start = performance.now()
  setWhitelistedTalks(only)
  const output = resolve(rootDir, destination ?? directory)
  const exported: string[] = []
  const relativeOutput = relative(process.cwd(), output)
  const displayOutput = relativeOutput.startsWith('..') ? relativeOutput : `./${relativeOutput}`
  logger.info(`Exporting PPTXs into ${displayOutput} ...`)
  await mkdir(output, { recursive: true })
  const temporary = await mkdtemp(join(output, '.pptx-'))
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    const context = createBuildContext(logger, true, temporary)
    context.extensions.freya = {
      export: true,
      exportingFormat: 'pptx',
      fonts: await loadFontsFile(fileURLToPath(new URL('../assets/styles/fonts.yml', import.meta.url))),
      talks: filterWhitelistedTalks(context, await getAllTalks())
    }
    const selected = context.extensions.freya.talks as Set<string>
    if (!selected.size) {
      throw new Error('PPTX: no talks matched the selection.')
    }
    const require = createRequire(import.meta.url)
    const versions: Record<string, string> = {}
    for (const [name, path] of Object.entries({
      freya: fileURLToPath(new URL('../../package.json', import.meta.url)),
      dante: resolve(dirname(require.resolve('@perseveranza-pets/dante')), '../package.json'),
      pptxgenjs: resolve(dirname(require.resolve('pptxgenjs')), '../package.json'),
      playwright: require.resolve('playwright/package.json'),
      jszip: require.resolve('jszip/package.json')
    })) {
      versions[name] = JSON.parse(await readFile(path, 'utf8')).version
    }
    const cache = await ExportCache.open(rootDir, output, 'pptx', {
      versions,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      buildVersion: process.env.FREYA_BUILD_VERSION ?? process.env.DANTE_BUILD_VERSION
    })
    const talks = new Set<string>()
    let checked = 0
    for (const id of selected) {
      const matches = await cache.matches(id)
      const progress = `[${String(++checked).padStart(String(selected.size).length, '0')}/${selected.size}]`
      if (!force && matches) {
        exported.push(id)
        logger.info(`${progress} Skipping exporting of slideset ${id} as contents have not changed.`)
      } else {
        talks.add(id)
      }
    }
    if (!talks.size) {
      logger.info(`Exporting completed in ${(performance.now() - start).toFixed(2)}ms.`)
      return exported
    }
    context.extensions.freya.talks = talks
    logger.info(`Exporting slideset(s): ${[...talks].join(', ')}`)
    logger.info('Preparing slidesets ...')
    const preparationStart = performance.now()
    const documents = await generateAllSlidesets(context)
    logger.info(`Preparation completed in ${(performance.now() - preparationStart).toFixed(2)}ms.`)
    logger.info('Exporting slidesets ...')
    browser = await chromium.launch({ args: ['--allow-file-access-from-files'] })
    let completedTalks = 0
    const downloadedFonts = new Map<string, EmbeddedFont>()
    for (const id of talks) {
      const talkStart = performance.now()
      const talkProgress = `[${completedTalks + 1}/${talks.size}]`
      let currentSlide: string | undefined
      try {
        const talk = await getTalk(id)
        const theme = await getTheme(talk.config.theme)
        const sources = { ...context.extensions.freya.fonts.sources, ...theme.fonts.sources } as Record<string, string>
        for (const [family, source] of Object.entries(sources)) {
          if (new URL(source).hostname !== 'fonts.googleapis.com') {
            throw new Error(`PPTX: ${family} must declare a Google Fonts source.`)
          }
        }
        const fonts = new Map<string, EmbeddedFont>()
        const usedFonts = new Set<EmbeddedFont>()
        const { width, height } = talk.config.dimensions
        const presentation = new PptxGenJS()
        const previews = new Map<string, string>()
        // A 13 1/3 inch canvas keeps typical 2000px Freya slides within PowerPoint limits.
        const scale = 40 / 3 / width
        presentation.defineLayout({ name: 'FREYA', width: width * scale, height: height * scale })
        presentation.layout = 'FREYA'
        presentation.title = talk.document.title
        presentation.author = talk.document.author?.name ?? ''
        presentation.subject = talk.document.abstract ?? ''
        const pages: Page[] = []
        const warnings: { slide: number; message: string }[] = []
        try {
          for (let index = 0; index < Math.min(concurrency, talk.slides.length); index++) {
            pages.push(await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 }))
          }
          const talkDir = join(temporary, id)
          await mkdir(talkDir, { recursive: true })
          const styleContext = { ...context, currentPage: join(talkDir, '01.html') }
          const head = finalizePageCSS(styleContext, '</head>', await css(styleContext), cssVisitor)
          for (let offset = 0; offset < talk.slides.length; offset += pages.length) {
            const batch = talk.slides.slice(offset, offset + pages.length)
            const gates = batch.map(() => Promise.withResolvers<void>())
            // Font aliases are assigned in slide order; page loading and extraction overlap.
            // Settle the whole batch before throwing so cleanup cannot race ongoing work.
            const results = await Promise.allSettled(
              batch.map(async (source, slot) => {
                const index = offset + slot
                const page = pages[slot]
                try {
                  const name = `${id}/${String(index + 1).padStart(talk.slidesPadding, '0')}.html`
                  const file = join(temporary, name)
                  await writeFile(file, documents[name].replace('</head>', head))
                  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 30000 })
                  if (slot > 0) {
                    await gates[slot - 1].promise
                  }
                  await prepareFonts(page, sources, fonts, downloadedFonts, source.options?.allowAllUnicodes === true)
                  gates[slot].resolve()
                  const scene = await page.evaluate(extractSlide)
                  return scene
                } finally {
                  // Preserve the ordering chain even if a page fails before acquiring its turn.
                  if (slot > 0) {
                    await gates[slot - 1].promise
                  }
                  gates[slot].resolve()
                }
              })
            )
            for (const [slot, result] of results.entries()) {
              const index = offset + slot
              const source = batch[slot]
              currentSlide = `slide ${index + 1} (${source.title ?? source.layout})`
              if (result.status === 'rejected') {
                throw result.reason
              }
              const scene = result.value
              const slide = presentation.addSlide()
              slide.background = { color: 'FFFFFF' }
              slide.addNotes(source.notes ?? '')
              for (const object of scene.objects) {
                const bounds = { x: object.x * scale, y: object.y * scale, w: object.w * scale, h: object.h * scale }
                const transparency = Math.max(0, Math.min(100, 100 * (1 - object.opacity * (object.fill?.alpha ?? 1))))
                if (object.kind === 'text') {
                  const font = Array.from(fonts.values()).find(font => font.alias === object.fontFace)
                  if (!font) {
                    throw new Error(
                      `PPTX: ${id} slide ${index + 1}, ${object.name}: font ${object.fontFace} was not prepared for embedding.`
                    )
                  }
                  usedFonts.add(font)
                  const content =
                    object.runs?.map(run => {
                      const face = Array.from(fonts.values()).find(font => font.alias === run.fontFace)
                      if (!face) {
                        throw new Error(`PPTX: unprepared code font ${run.fontFace}.`)
                      }
                      usedFonts.add(face)
                      return {
                        text: run.text === '\n' ? '' : run.text!,
                        options: {
                          breakLine: run.text === '\n',
                          fontFace: face.typeface,
                          fontSize: run.fontSize! * scale * 72,
                          bold: face.bold,
                          italic: face.italic,
                          color: run.fill?.color,
                          transparency: 100 * (1 - run.opacity * (run.fill?.alpha ?? 1)),
                          underline: { style: run.underline ? ('sng' as const) : ('none' as const) },
                          strike: run.strike,
                          charSpacing: (run.spacing ?? 0) * scale * 72
                        }
                      }
                    }) ?? object.text!
                  slide.addText(content, {
                    ...bounds,
                    objectName: object.name,
                    fontFace: font.typeface,
                    fontSize: object.fontSize! * scale * 72,
                    bold: font.bold,
                    italic: font.italic,
                    strike: object.strike,
                    underline: { style: object.underline ? 'sng' : 'none' },
                    color: object.fill?.color,
                    transparency,
                    charSpacing: (object.spacing ?? 0) * scale * 72,
                    margin: 0,
                    breakLine: false,
                    wrap: false,
                    fit: 'none',
                    valign: object.runs ? 'top' : 'middle',
                    align: object.align,
                    lineSpacing: object.lineSpacing ? object.lineSpacing * scale * 72 : undefined,
                    paraSpaceAfter: 0,
                    paraSpaceBefore: 0,
                    hyperlink: object.link ? { url: object.link } : undefined
                  })
                } else if (object.kind === 'shape') {
                  slide.addShape(object.radius ? presentation.ShapeType.roundRect : presentation.ShapeType.rect, {
                    ...bounds,
                    objectName: object.name,
                    rectRadius: (object.radius ?? 0) * scale,
                    fill: { color: object.fill!.color, transparency },
                    line: { color: object.fill!.color, transparency: 100 }
                  })
                } else {
                  if (object.preview) {
                    previews.set(object.data!.split(',')[1], object.preview)
                  }
                  slide.addImage({
                    ...bounds,
                    objectName: object.name,
                    data: object.data,
                    rotate: object.rotation,
                    transparency,
                    hyperlink: object.link ? { url: object.link } : undefined
                  })
                }
              }
              warnings.push(...scene.warnings.map(message => ({ slide: index + 1, message })))
              logger.debug(
                `PPTX ${id} ${index + 1}/${talk.slides.length}: ${scene.objects.length} objects, ${scene.warnings.length} fidelity notes.`
              )
            }
          }
          const target = join(output, `${id}.pptx`)
          const staged = join(temporary, `${id}.pptx`)
          currentSlide = undefined
          const defaultFont = Array.from(usedFonts).find(font => font.weight === 400 && !font.italic)
          if (defaultFont) {
            presentation.theme = { headFontFace: defaultFont.typeface, bodyFontFace: defaultFont.typeface }
          }
          const data = await presentation.write({ outputType: 'nodebuffer' })
          await writeFile(staged, await finalizePptx(data, previews, Array.from(usedFonts)))
          await rename(staged, target)
          await cache.record(id)
          // Remove only this talk's legacy sidecars after publishing its replacement successfully.
          await Promise.all([
            rm(join(output, `${id}.pptx-fonts.zip`), { force: true }),
            rm(join(output, `${id}.pptx-report.json`), { force: true })
          ])
          exported.push(id)
          logger.debug(`PPTX written: ${target}`)
          const progress = `[${++completedTalks}/${talks.size}]`
          logger.info(
            `${progress} Slideset ${id} with ${talk.slides.length} slides exported in ${(performance.now() - talkStart).toFixed(2)}ms.`
          )
          const indent = ' '.repeat(progress.length + 1)
          for (const [index, warning] of warnings.entries()) {
            logger.debug(`${indent}[${index + 1}/${warnings.length}] Slide ${warning.slide}: ${warning.message}`)
          }
        } finally {
          await Promise.all(pages.map(page => page.close()))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
          `${talkProgress} Error while exporting slideset ${id}: ${currentSlide ? `${currentSlide}: ` : ''}${message.replace(/^PPTX: /, '')}`,
          { cause: error }
        )
      }
    }
    await cache.save(temporary)
  } finally {
    try {
      await browser?.close()
    } finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }
  logger.info(`Exporting completed in ${(performance.now() - start).toFixed(2)}ms.`)
  return exported
}
