#!/usr/bin/env node

import { Command, program } from 'commander'
import { readFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import { rootDir } from '../generation/loader.js'

const logger = pino({ transport: { target: 'pino-pretty' }, level: process.env.LOG_LEVEL ?? 'info' })
const packageInfo = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'))

program
  .name('freya')
  .description('Opinionated JSX based slides generator.')
  .option('-o, --only <string>', 'A comma separated list of talks to build.', '')
  .version(packageInfo.version, '-V, --version', 'Show version number')
  .helpOption('-h, --help', 'Show this help')
  .addHelpCommand(false)
  .showSuggestionAfterError(true)
  .allowUnknownOption(false)
  .action(() => {
    program.help()
  })

program
  .command('development')
  .description('Starts the development server')
  .option('-i, --ip <ip>', 'The IP to listen on', '::')
  .option('-p, --port <port>', 'The port to listen on', v => Number.parseInt(v, 10), 3000)
  .alias('dev')
  .alias('d')
  .action(async function devAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')
      const { developmentBuilder, setWhitelistedTalks } = await import('./builders.js')

      // Prepare the target directory
      const { ip, port } = this.optsWithGlobals()
      setWhitelistedTalks(this.optsWithGlobals().only)

      await localServer(ip, port, false)
      await developmentBuilder(logger, ip, port)
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('build')
  .description('Build all the slides')
  .alias('b')
  .action(async function buildAction(this: Command): Promise<void> {
    try {
      const { productionBuilder, setWhitelistedTalks } = await import('./builders.js')

      setWhitelistedTalks(this.optsWithGlobals().only)
      await productionBuilder()
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('server')
  .description('Serve built slides')
  .option('-i, --ip <ip>', 'The IP to listen on', '::')
  .option('-p, --port <port>', 'The port to listen on', v => Number.parseInt(v, 10), 3000)
  .alias('serve')
  .alias('s')
  .action(async function serveAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')

      const { ip, port } = this.optsWithGlobals()
      await localServer(ip, port, pino({ level: process.env.LOG_LEVEL ?? 'info' }))
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('jpeg')
  .description('Build all the slides as a set of JPEG images files')
  .alias('j')
  .action(async function exportJPEGAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')
      const { productionBuilder, setWhitelistedTalks } = await import('./builders.js')
      const { exportAllAsJPEGs } = await import('./exporters.js')

      // Prepare the target directory
      setWhitelistedTalks(this.optsWithGlobals().only)
      await productionBuilder('dist/tmp')
      const server = await localServer('127.0.0.1', 0, false, 'dist/tmp')
      await exportAllAsJPEGs((server.server.address() as AddressInfo).port)
      await server.close()
      await rm(resolve(rootDir, 'dist/tmp'), { force: true, recursive: true })
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('pdf')
  .description('Build all the slides as PDF files')
  .alias('p')
  .action(async function exportPDFAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')
      const { productionBuilder, setWhitelistedTalks } = await import('./builders.js')
      const { exportAllAsPDFs } = await import('./exporters.js')

      // Prepare the target directory
      setWhitelistedTalks(this.optsWithGlobals().only)
      await productionBuilder('dist/tmp')
      const server = await localServer('127.0.0.1', 0, false, 'dist/tmp')
      await exportAllAsPDFs((server.server.address() as AddressInfo).port)
      await server.close()
      await rm(resolve(rootDir, 'dist/tmp'), { force: true, recursive: true })
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program
  .command('deploy')
  .description('Build all the slides as HTML and PDF files ready to be deployed on Netlify')
  .alias('y')
  .action(async function deployAction(this: Command): Promise<void> {
    try {
      const { localServer } = await import('./server.js')
      const { productionBuilder, setWhitelistedTalks } = await import('./builders.js')
      const { exportAllAsPDFs } = await import('./exporters.js')

      // Prepare the target directory
      await rm(resolve(rootDir, 'dist/deploy/site'), { force: true, recursive: true })
      await mkdir(resolve(rootDir, 'dist/deploy/site/pdfs'), { recursive: true })

      // Export in HTML and PDF
      setWhitelistedTalks(this.optsWithGlobals().only)

      await productionBuilder('dist/deploy/site', true)
      const server = await localServer('127.0.0.1', 0, false, 'dist/deploy/site')
      await exportAllAsPDFs((server.server.address() as AddressInfo).port, 'dist/deploy/site/pdfs', true)
      await server.close()
    } catch (error) {
      logger.error(error)
      process.exit(1)
    }
  })

program.parse()
