import type { Command } from 'commander'
import type pino from 'pino'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { builder, createBuildContext, loadFontsFile, rootDir } from '@perseveranza-pets/dante'
import { InvalidArgumentError } from 'commander'
import { pusherConfig, setWhitelistedTalks } from './configuration.ts'
import { exportPDFs } from './export.ts'
import { exportPptx } from './pptx.ts'

function applyOnlyOption(command: Command): void {
  command.hook('preAction', () => {
    setWhitelistedTalks(command.optsWithGlobals().only as string)
  })
}

async function performBuild(command: Command, logger: pino.Logger): Promise<void> {
  try {
    // Build in production mode
    const { directory: staticDir, only }: Record<string, string> = command.optsWithGlobals()
    setWhitelistedTalks(only)
    const absoluteStaticDir = resolve(rootDir, staticDir)
    const context = createBuildContext(logger, true, absoluteStaticDir)
    context.extensions.freya = { netlify: true }

    await builder(context)
  } catch (error) {
    logger.error(error)
    process.exit(1)
  }
}

async function performPDF(command: Command, logger: pino.Logger): Promise<string[]> {
  // Build in production mode.
  const { directory: staticDir, only }: Record<string, string> = command.optsWithGlobals()
  setWhitelistedTalks(only)
  const absoluteStaticDir = resolve(rootDir, staticDir)
  const context = createBuildContext(logger, true, absoluteStaticDir)
  context.extensions.freya = {
    export: true,
    fonts: await loadFontsFile(fileURLToPath(new URL('./assets/styles/fonts.yml', import.meta.url)))
  }

  const output = resolve(absoluteStaticDir, 'pdf')
  const relativeOutput = relative(process.cwd(), output)
  const displayOutput = relativeOutput.startsWith('..') ? relativeOutput : `./${relativeOutput}`
  logger.info(`Exporting PDFs into ${displayOutput} ...`)
  const { concurrency = 3, scale = 2 } = command.optsWithGlobals()
  return exportPDFs(context, output, concurrency as number, scale as number)
}

export function setupCLI(program: Command, logger: pino.Logger): void {
  program
    .name('freya')
    .description('Opinionated JSX based slides generator.')
    .option('-o, --only <string>', 'A comma separated list of talks to build.', '')

  for (const command of program.commands) {
    if (command.name() === 'build') {
      command.description('Builds all the slidesets')
    } else if (command.name() === 'server') {
      command.description('Serves slidesets locally')
    }

    if (['development', 'build'].includes(command.name())) {
      applyOnlyOption(command)
    }
  }

  program
    .command('pdf')
    .description('Exports one screenshot-based PDF per slideset')
    .option('-d, --directory <dir>', 'The base output directory (PDFs are written to its pdf subdirectory)', 'dist')
    .option(
      '-c, --concurrency <number>',
      'Maximum browsers and maximum tabs per browser',
      value => {
        const concurrency = Number(value)
        if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(concurrency)) {
          throw new InvalidArgumentError('Concurrency must be a positive integer.')
        }
        return concurrency
      },
      3
    )
    .option(
      '-s, --scale <NUM>',
      'Screenshot pixel density multiplier',
      value => {
        const scale = Number(value)
        if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(scale)) {
          throw new InvalidArgumentError('Scale must be a positive integer.')
        }
        return scale
      },
      2
    )
    .alias('p')
    .action(async function pdfAction(this: Command): Promise<void> {
      try {
        await performPDF(this, logger)
      } catch (error) {
        logger.error(error)
        process.exitCode = 1
      }
    })

  program
    .command('pptx')
    .description('Exports editable PowerPoint presentations from annotated slide layouts')
    .option('-d, --directory <dir>', 'The directory where to export PPTX files and fidelity reports', 'pptx')
    .alias('x')
    .action(async function pptxAction(this: Command): Promise<void> {
      try {
        await exportPptx(this, logger)
      } catch (error) {
        logger.error(error)
        process.exitCode = 1
      }
    })

  program
    .command('deploy')
    .description('Build all the slidesets as HTML and PDF files ready to be deployed on Netlify')
    .option('-d, --directory <dir>', 'The directory where to build and serve files from', 'dist')
    .alias('y')
    .action(async function deployAction(this: Command): Promise<void> {
      try {
        await performBuild(this, logger)
        const exported = await performPDF(this, logger)

        const { directory: staticDir }: Record<string, string> = this.optsWithGlobals()

        await rm(resolve(rootDir, staticDir, 'deploy'), { force: true, recursive: true })
        await cp(resolve(rootDir, staticDir, 'html'), resolve(rootDir, staticDir, 'deploy/site'), { recursive: true })
        // Publish only PDFs generated by this invocation, not stale files from earlier selections.
        const pdfDirectory = resolve(rootDir, staticDir, 'deploy/site/pdfs')
        await rm(pdfDirectory, { recursive: true, force: true })
        await mkdir(pdfDirectory, { recursive: true })
        for (const id of exported) {
          const destination = resolve(pdfDirectory, `${id}.pdf`)
          await mkdir(dirname(destination), { recursive: true })
          await cp(resolve(rootDir, staticDir, 'pdf', `${id}.pdf`), destination)
        }
        await cp(resolve(rootDir, staticDir, 'netlify.toml'), resolve(rootDir, staticDir, 'deploy/netlify.toml'), {
          recursive: true
        })

        if (pusherConfig) {
          await cp(resolve(rootDir, staticDir, 'functions'), resolve(rootDir, staticDir, 'deploy/site/functions'), {
            recursive: true
          })
        }
      } catch (error) {
        logger.error(error)
        process.exitCode = 1
      }
    })
}
