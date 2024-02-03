import {
  baseTemporaryDirectory,
  builder,
  compileSourceCode,
  createBuildContext,
  initializeSyntaxHighlighting,
  loadFontsFile,
  rootDir
} from '@perseveranza-pets/dante'
import { type Command } from 'commander'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type pino from 'pino'
import { pusherConfig, setWhitelistedTalks } from './configuration.js'
import { createAllPDFs, ensureMagick, exportAllAsPNGs } from './export.js'

function applyOnlyOption(command: Command): void {
  command.hook('preAction', () => {
    setWhitelistedTalks(command.optsWithGlobals().only as string)
  })
}

async function performBuild(command: Command, logger: pino.Logger): Promise<void> {
  try {
    await ensureMagick()

    // Build in production mode
    const { directory: staticDir, only }: Record<string, string> = command.optsWithGlobals()
    setWhitelistedTalks(only)
    const absoluteStaticDir = resolve(rootDir, staticDir)
    const context = createBuildContext(logger, true, absoluteStaticDir)
    context.extensions.freya = { netlify: true }

    await compileSourceCode(logger)
    await initializeSyntaxHighlighting(logger)
    await builder(context)
  } catch (error) {
    logger.error(error)
    process.exit(1)
  }
}

async function performExport(command: Command, logger: pino.Logger, skipCompilation: boolean = false): Promise<void> {
  try {
    await ensureMagick()

    // Build in production mode
    const { directory: staticDir, only }: Record<string, string> = command.optsWithGlobals()
    setWhitelistedTalks(only)
    const absoluteStaticDir = resolve(rootDir, staticDir)
    const context = createBuildContext(logger, true, absoluteStaticDir)
    context.extensions.freya = {
      export: true,
      fonts: await loadFontsFile(fileURLToPath(new URL('./assets/styles/fonts.yml', import.meta.url)))
    }

    // Temporarily disable logging
    const oldLogger = context.logger

    if (skipCompilation) {
      const newLogger = context.logger.child({}, { level: 'warn' })
      context.logger = newLogger
    }

    // Prepare building
    if (!skipCompilation) {
      await compileSourceCode(context.logger)
      await initializeSyntaxHighlighting(context.logger)
    }

    // Setup the environment
    process.env.DANTE_BUILD_FILE_PATH = fileURLToPath(new URL('./export.js', import.meta.url))
    context.root = await mkdtemp(resolve(baseTemporaryDirectory, 'export-'))

    // Build the files first
    await builder(context)

    // Restore regular logging
    if (skipCompilation) {
      context.logger = oldLogger
    }

    // Now create a PNG for each file
    await exportAllAsPNGs(context, staticDir)

    // Create PDFs
    await createAllPDFs(context, staticDir)

    // Remove the temporary directory
    await rm(context.root, { force: true, recursive: true })
  } catch (error) {
    logger.error(error)
    process.exit(1)
  }
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
    .command('export')
    .description('Builds all the slidesets as a set of PNG images files and a combined PDF file')
    .option('-d, --directory <dir>', 'The directory where to build and serve files from', 'dist')
    .alias('e')
    .action(async function exportAction(this: Command): Promise<void> {
      await performExport(this, logger)
    })

  program
    .command('deploy')
    .description('Build all the slidesets as HTML and PDF files ready to be deployed on Netlify')
    .option('-d, --directory <dir>', 'The directory where to build and serve files from', 'dist')
    .alias('y')
    .action(async function deployAction(this: Command): Promise<void> {
      await performBuild(this, logger)
      await performExport(this, logger, true)

      const { directory: staticDir }: Record<string, string> = this.optsWithGlobals()

      await rm(resolve(rootDir, staticDir, 'deploy'), { force: true, recursive: true })
      await cp(resolve(rootDir, staticDir, 'html'), resolve(rootDir, staticDir, 'deploy/site'), { recursive: true })
      await cp(resolve(rootDir, staticDir, 'pdf'), resolve(rootDir, staticDir, 'deploy/site/pdfs'), { recursive: true })
      await cp(resolve(rootDir, staticDir, 'netlify.toml'), resolve(rootDir, staticDir, 'deploy/netlify.toml'), {
        recursive: true
      })

      if (pusherConfig) {
        await cp(resolve(rootDir, staticDir, 'functions'), resolve(rootDir, staticDir, 'deploy/site/functions'), {
          recursive: true
        })
      }
    })
}
