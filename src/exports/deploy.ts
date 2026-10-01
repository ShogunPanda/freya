import type { Command } from 'commander'
import type pino from 'pino'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { rootDir } from '@perseveranza-pets/dante'
import { pusherConfig } from '../configuration.ts'
import { performBuild } from './html.ts'
import { performPDF } from './pdf.ts'
import { exportPptx } from './pptx.ts'

export async function deploy(command: Command, logger: pino.Logger): Promise<void> {
  const { directory, pdf = true, pptx = true } = command.optsWithGlobals()
  await performBuild(command, logger)
  const exportedPDFs = pdf ? await performPDF(command, logger) : []
  const pptxOutput = resolve(rootDir, directory, 'pptx')
  const exportedPPTXs = pptx ? await exportPptx(command, logger, pptxOutput) : []
  const output = resolve(rootDir, directory)
  await rm(resolve(output, 'deploy'), { force: true, recursive: true })
  await cp(resolve(output, 'html'), resolve(output, 'deploy/site'), { recursive: true })
  // Remove copied/stale artifacts even when their format is disabled.
  await rm(resolve(output, 'deploy/site/pdfs'), { recursive: true, force: true })
  await rm(resolve(output, 'deploy/site/pptx'), { recursive: true, force: true })
  for (const [enabled, ids, source, target, extension] of [
    [pdf, exportedPDFs, resolve(output, 'pdf'), 'pdfs', 'pdf'],
    [pptx, exportedPPTXs, pptxOutput, 'pptx', 'pptx']
  ] as const) {
    if (!enabled) {
      continue
    }
    const destination = resolve(output, 'deploy/site', target)
    await mkdir(destination, { recursive: true })
    // Include verified cache hits, but never files from unrelated selections.
    for (const id of ids) {
      const file = resolve(destination, `${id}.${extension}`)
      await mkdir(dirname(file), { recursive: true })
      await cp(resolve(source, `${id}.${extension}`), file)
    }
  }
  await cp(resolve(output, 'netlify.toml'), resolve(output, 'deploy/netlify.toml'))
  if (pusherConfig) {
    await cp(resolve(output, 'functions'), resolve(output, 'deploy/site/functions'), { recursive: true })
  }
}
