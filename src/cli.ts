import { type Command } from 'commander'
import {
  builder,
  compileSourceCode,
  createBuildContext,
  initializeSyntaxHighlighting,
  localServer,
  rootDir
} from 'dante'
import { cp, rm } from 'node:fs/promises'
import { type AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import type pino from 'pino'
import { pusherConfig, setWhitelistedTalks } from './configuration.js'
import { createAllPDFs, exportAllAsPNGs } from './export.js'

function applyOnlyOption(command: Command): void {
  command.hook('preAction', () => {
    setWhitelistedTalks(command.optsWithGlobals().only as string)
  })
}

async function performExport(command: Command, logger: pino.Logger, netlify: boolean): Promise<void> {
  try {
    // Build in production mode
    const { directory: staticDir, only }: Record<string, string> = command.optsWithGlobals()
    setWhitelistedTalks(only)
    const absoluteStaticDir = resolve(rootDir, staticDir)
    const buildContext = createBuildContext(logger, true, absoluteStaticDir)
    buildContext.extensions.netlify = netlify

    await compileSourceCode(logger)
    await initializeSyntaxHighlighting(logger)
    await builder(buildContext)

    // Start the server
    const server = await localServer({
      ip: '0.0.0.0',
      port: 0,
      logger: false,
      isProduction: true,
      staticDir: resolve(rootDir, staticDir)
    })

    // Export as PNGs
    await exportAllAsPNGs(logger, staticDir, (server.server.address() as AddressInfo).port)
    await server.close()

    // Create PDFs
    await createAllPDFs(logger, staticDir)
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
      await performExport(this, logger, false)
    })

  program
    .command('deploy')
    .description('Build all the slidesets as HTML and PDF files ready to be deployed on Netlify')
    .option('-d, --directory <dir>', 'The directory where to build and serve files from', 'dist')
    .alias('y')
    .action(async function deployAction(this: Command): Promise<void> {
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
